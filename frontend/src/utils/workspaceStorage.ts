/**
 * Manages persisting and restoring workspace handles and session state using IndexedDB.
 */

import { createNativeDirectoryHandle } from './nativeFsAdapter';

const DB_NAME = 'ApkRtoolWorkspaceDB';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_session';
const KEY_HANDLE = 'last_dir_handle';
const KEY_TABS = 'last_open_tabs';
const KEY_ACTIVE_TAB = 'last_active_tab';
const KEY_RECENTS = 'recent_workspaces';

const LS_WORKSPACE_PATH = 'apkrtool_last_workspace_path';
const LS_OPEN_TABS = 'apkrtool_last_open_tabs';
const LS_ACTIVE_TAB = 'apkrtool_last_active_tab';
const LS_RECENTS = 'apkrtool_recent_workspaces';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorkspaceState(
  handle: FileSystemDirectoryHandle,
  openTabPaths: string[] = [],
  activeTabPath: string | null = null
): Promise<void> {
  try {
    // 1. Electron persistent path storage (no permission reset on restart)
    const absPath = (handle as any).path || (await resolveDirectoryPath(handle));
    if (absPath) {
      localStorage.setItem(LS_WORKSPACE_PATH, absPath);
      localStorage.setItem(LS_OPEN_TABS, JSON.stringify(openTabPaths));
      localStorage.setItem(LS_ACTIVE_TAB, activeTabPath || '');
    }

    // 2. IndexedDB storage (browser mode fallback - skip if native handle to avoid DataCloneError)
    if (!('path' in handle && typeof (handle as any).path === 'string')) {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(handle, KEY_HANDLE);
      store.put(openTabPaths, KEY_TABS);
      store.put(activeTabPath, KEY_ACTIVE_TAB);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    await addRecentWorkspace(handle);
  } catch (err) {
    console.warn('[WorkspaceStorage] Failed to save workspace state:', err);
  }
}

export async function addRecentWorkspace(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const absPath = (handle as any).path || (await resolveDirectoryPath(handle)) || '';

    // Save in localStorage for Electron
    try {
      const raw = localStorage.getItem(LS_RECENTS);
      let list: Array<{ name: string; path: string }> = raw ? JSON.parse(raw) : [];
      list = list.filter((item) => item.name !== handle.name && (!absPath || item.path !== absPath));
      list.unshift({ name: handle.name, path: absPath });
      if (list.length > 10) list = list.slice(0, 10);
      localStorage.setItem(LS_RECENTS, JSON.stringify(list));
    } catch {}

    // Save in IndexedDB for browser (only if standard clonable handle)
    if (!('path' in handle && typeof (handle as any).path === 'string')) {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const recentsReq = store.get(KEY_RECENTS);
      recentsReq.onsuccess = () => {
        let list: Array<{ name: string; handle: FileSystemDirectoryHandle }> = recentsReq.result || [];
        list = list.filter((item) => item.name !== handle.name);
        list.unshift({ name: handle.name, handle });
        if (list.length > 10) list = list.slice(0, 10);
        const writeTx = db.transaction(STORE_NAME, 'readwrite');
        writeTx.objectStore(STORE_NAME).put(list, KEY_RECENTS);
      };
    }
  } catch (err) {
    console.warn('[WorkspaceStorage] Failed to add recent workspace:', err);
  }
}

export async function getRecentWorkspaces(): Promise<Array<{ name: string; handle: FileSystemDirectoryHandle }>> {
  const electronAPI = (window as any).electronAPI;

  // Prefer localStorage native handles in Electron
  if (electronAPI?.isElectron) {
    try {
      const raw = localStorage.getItem(LS_RECENTS);
      if (raw) {
        const list: Array<{ name: string; path: string }> = JSON.parse(raw);
        const result: Array<{ name: string; handle: FileSystemDirectoryHandle }> = [];
        for (const item of list) {
          if (item.path) {
            const h = createNativeDirectoryHandle(item.path) as unknown as FileSystemDirectoryHandle;
            result.push({ name: item.name, handle: h });
          }
        }
        if (result.length > 0) return result;
      }
    } catch {}
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY_RECENTS);
    return await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function clearRecentWorkspaces(): Promise<void> {
  localStorage.removeItem(LS_RECENTS);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY_RECENTS);
  } catch {}
}

export async function getLastWorkspace(): Promise<{
  handle: FileSystemDirectoryHandle;
  openTabPaths: string[];
  activeTabPath: string | null;
} | null> {
  // 1. Electron Native Auto-Restore: bypasses Chromium's permission prompts completely!
  const electronAPI = (window as any).electronAPI;
  const savedNativePath = localStorage.getItem(LS_WORKSPACE_PATH);

  if (electronAPI?.isElectron && savedNativePath && electronAPI.fsExists) {
    try {
      const exists = await electronAPI.fsExists(savedNativePath);
      if (exists) {
        const handle = createNativeDirectoryHandle(savedNativePath) as unknown as FileSystemDirectoryHandle;
        let openTabPaths: string[] = [];
        try {
          const raw = localStorage.getItem(LS_OPEN_TABS);
          if (raw) openTabPaths = JSON.parse(raw);
        } catch {}
        const activeTabPath = localStorage.getItem(LS_ACTIVE_TAB) || null;

        return {
          handle,
          openTabPaths: Array.isArray(openTabPaths) ? openTabPaths : [],
          activeTabPath,
        };
      }
    } catch (err) {
      console.warn('[WorkspaceStorage] Native workspace restore check failed:', err);
    }
  }

  // 2. Browser IndexedDB fallback
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const handleReq = store.get(KEY_HANDLE);
    const tabsReq = store.get(KEY_TABS);
    const activeReq = store.get(KEY_ACTIVE_TAB);

    const [handle, openTabPaths, activeTabPath] = await Promise.all([
      new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        handleReq.onsuccess = () => resolve(handleReq.result || null);
        handleReq.onerror = () => reject(handleReq.error);
      }),
      new Promise<string[]>((resolve) => {
        tabsReq.onsuccess = () => resolve(tabsReq.result || []);
        tabsReq.onerror = () => resolve([]);
      }),
      new Promise<string | null>((resolve) => {
        activeReq.onsuccess = () => resolve(activeReq.result || null);
        activeReq.onerror = () => resolve(null);
      }),
    ]);

    if (!handle) return null;

    // Verify permission
    if ((handle as any).queryPermission) {
      let status = await (handle as any).queryPermission({ mode: 'readwrite' });
      if (status !== 'granted' && (handle as any).requestPermission) {
        try {
          status = await (handle as any).requestPermission({ mode: 'readwrite' });
        } catch {
          // May fail if not triggered by user gesture in non-Electron browsers
        }
      }
      if (status !== 'granted') {
        const readStatus = await (handle as any).queryPermission({ mode: 'read' });
        if (readStatus !== 'granted') return null;
      }
    }

    // Verify directory is accessible on disk
    const iter = (handle as any).values();
    await iter.next();

    return {
      handle,
      openTabPaths: openTabPaths || [],
      activeTabPath: activeTabPath || null,
    };
  } catch (err) {
    console.warn('[WorkspaceStorage] Failed to restore workspace handle:', err);
    return null;
  }
}

export async function clearWorkspaceState(): Promise<void> {
  localStorage.removeItem(LS_WORKSPACE_PATH);
  localStorage.removeItem(LS_OPEN_TABS);
  localStorage.removeItem(LS_ACTIVE_TAB);

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY_HANDLE);
    store.delete(KEY_TABS);
    store.delete(KEY_ACTIVE_TAB);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[WorkspaceStorage] Failed to clear workspace state:', err);
  }
}

/**
 * Resolves the underlying absolute filesystem path of a DirectoryHandle
 * by inspecting child files using Electron's webUtils.getPathForFile.
 */
export async function resolveDirectoryPath(dirHandle: FileSystemDirectoryHandle): Promise<string | null> {
  if ((dirHandle as any).path && typeof (dirHandle as any).path === 'string') {
    return (dirHandle as any).path;
  }

  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.getPathForFile) return null;

  try {
    // 1. Check common root files first
    for (const testName of ['apktool.yml', 'AndroidManifest.xml', 'package.json']) {
      try {
        const fh = await dirHandle.getFileHandle(testName);
        const file = await fh.getFile();
        const fullPath = electronAPI.getPathForFile(file);
        if (fullPath) {
          const sep = fullPath.includes('\\') ? '\\' : '/';
          return fullPath.substring(0, fullPath.lastIndexOf(sep));
        }
      } catch {}
    }

    // 2. Iterate any file directly inside the root
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === 'file') {
        try {
          const file = await entry.getFile();
          const fullPath = electronAPI.getPathForFile(file);
          if (fullPath) {
            const sep = fullPath.includes('\\') ? '\\' : '/';
            return fullPath.substring(0, fullPath.lastIndexOf(sep));
          }
        } catch {}
      }
    }

    // 3. Fallback: Check 1 level deep inside child directories
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === 'directory') {
        try {
          for await (const subEntry of (entry as any).values()) {
            if (subEntry.kind === 'file') {
              const file = await subEntry.getFile();
              const fullPath = electronAPI.getPathForFile(file);
              if (fullPath) {
                const sep = fullPath.includes('\\') ? '\\' : '/';
                const parentDir = fullPath.substring(0, fullPath.lastIndexOf(sep));
                return parentDir.substring(0, parentDir.lastIndexOf(sep));
              }
            }
          }
        } catch {}
      }
    }

    // 4. Fallback for empty folder: probe with temporary hidden marker
    try {
      const marker = await dirHandle.getFileHandle('.apkr_loc', { create: true });
      const f = await marker.getFile();
      const fullPath = electronAPI.getPathForFile(f);
      try { await dirHandle.removeEntry('.apkr_loc'); } catch {}
      if (fullPath) {
        const sep = fullPath.includes('\\') ? '\\' : '/';
        return fullPath.substring(0, fullPath.lastIndexOf(sep));
      }
    } catch {}
  } catch (err) {
    console.warn('[resolveDirectoryPath] Error resolving path:', err);
  }

  return null;
}
