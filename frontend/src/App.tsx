import { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import Navbar from './components/Navbar';
import ActivityBar from './components/ActivityBar';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import BuildLogModal from './components/BuildLogModal';
import SkillsModal from './components/SkillsModal';
import McpModal from './components/McpModal';
import SettingsModal from './components/SettingsModal';
import AiAgentPanel, { ChatMessage } from './components/AiAgentPanel';
import BottomPanel, { BottomTabType } from './components/BottomPanel';
import {
  createDirectoryRecursive,
  getFileHandleRecursive,
  crawlDirectory,
  deleteEntryRecursive,
  renameEntry,
} from './utils/fsHelper';
import {
  saveWorkspaceState,
  getLastWorkspace,
  clearWorkspaceState,
  resolveDirectoryPath,
  clearRecentWorkspaces,
} from './utils/workspaceStorage';
import { createNativeDirectoryHandle } from './utils/nativeFsAdapter';
import { RefreshCw, ArrowUpCircle, Download, CheckCircle2, X } from 'lucide-react';
import { useI18n } from './utils/i18n';

interface Tab {
  name: string;
  path: string;
  handle: FileSystemFileHandle;
}

// ---------------------------------------------------------------------------
// High-Speed Directory Cache & Parallel Batch Writer
// Uses an in-memory O(1) directory handle cache to eliminate 99% of Chromium IPC
// traversals and keepExistingData: false to bypass swap-file pre-copy overhead.
// ---------------------------------------------------------------------------
async function writeZipToDirectory(
  zip: JSZip,
  rootHandle: FileSystemDirectoryHandle,
  onProgress: (written: number, total: number) => void,
  batchSize = 24,
  uiThrottle = 150
): Promise<number> {
  const entries = Object.values(zip.files);
  const fileEntries = entries.filter((e) => !e.dir);
  const total = fileEntries.length;
  let written = 0;
  let lastUiUpdate = 0;

  // 1. Directory Handle Cache — avoids repetitive IPC tree-traversals
  const dirCache = new Map<string, FileSystemDirectoryHandle>();
  dirCache.set('', rootHandle);

  const getOrMakeDir = async (dirPath: string): Promise<FileSystemDirectoryHandle> => {
    if (dirCache.has(dirPath)) return dirCache.get(dirPath)!;
    const slashIdx = dirPath.lastIndexOf('/');
    const parentPath = slashIdx === -1 ? '' : dirPath.slice(0, slashIdx);
    const folderName = slashIdx === -1 ? dirPath : dirPath.slice(slashIdx + 1);
    const parentHandle = await getOrMakeDir(parentPath);
    const handle = await parentHandle.getDirectoryHandle(folderName, { create: true });
    dirCache.set(dirPath, handle);
    return handle;
  };

  // Pre-create and cache all directory handles hierarchically (shortest path first)
  const dirPaths = [...new Set(
    entries
      .map((e) => {
        const normalized = e.name.replace(/\\/g, '/').replace(/^\.?\//, '');
        const full = e.dir ? normalized.replace(/\/$/, '') : normalized;
        const slash = full.lastIndexOf('/');
        return slash === -1 ? '' : full.slice(0, slash);
      })
      .filter(Boolean)
  )].sort((a, b) => a.split('/').length - b.split('/').length);

  for (const dp of dirPaths) {
    try {
      await getOrMakeDir(dp);
    } catch (e) {
      console.warn(`[DirCache] Error creating dir "${dp}":`, e);
    }
  }

  // 2. Write files in parallel micro-batches using O(1) directory cache
  for (let i = 0; i < fileEntries.length; i += batchSize) {
    const batch = fileEntries.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (zipEntry) => {
        try {
          const cleanName = zipEntry.name.replace(/\\/g, '/').replace(/^\.?\//, '');
          const slash = cleanName.lastIndexOf('/');
          const dirPath = slash === -1 ? '' : cleanName.slice(0, slash);
          const fileName = slash === -1 ? cleanName : cleanName.slice(slash + 1);

          const parentHandle = dirCache.get(dirPath) || await getOrMakeDir(dirPath);
          const fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
          
          // Use uint8array directly — avoids character decoding / buffer copying
          const data = await zipEntry.async('uint8array');
          
          // keepExistingData: false bypasses Chromium's swap-file pre-copy overhead
          const writable = await (fileHandle as any).createWritable({ keepExistingData: false });
          await writable.write(data);
          await writable.close();
        } catch (err) {
          console.warn(`[WriteZip] Skipped "${zipEntry.name}":`, err);
        } finally {
          written++;
          if (written - lastUiUpdate >= uiThrottle || written === total) {
            lastUiUpdate = written;
            onProgress(written, total);
          }
        }
      })
    );
  }

  return written;
}

// ---------------------------------------------------------------------------
// Packs an entire workspace DirectoryHandle into JSZip with binary STORE flags
// ---------------------------------------------------------------------------
async function createWorkspaceZip(
  dirHandle: FileSystemDirectoryHandle,
  options?: {
    onProgress?: (count: number) => void;
    onLog?: (msg: string) => void;
  }
): Promise<{ zip: JSZip; fileCount: number; binaryCount: number }> {
  const zipObj = new JSZip();
  let fileCount = 0;
  let binaryCount = 0;

  const addToZip = async (handle: FileSystemDirectoryHandle, prefix: string) => {
    for await (const [name, entry] of (handle as any).entries()) {
      const entryPath = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'directory') {
        await addToZip(entry as FileSystemDirectoryHandle, entryPath);
      } else {
        const file = await (entry as FileSystemFileHandle).getFile();
        const ext = name.toLowerCase();
        const pathLower = entryPath.toLowerCase();

        const isTrueBinary =
          /\.(png|jpg|jpeg|gif|webp|bmp|ico)$/i.test(ext) ||
          /\.(so|a|dylib|dll)$/i.test(ext) ||
          /\.(arsc|dex|ap_|jar|aar|class)$/i.test(ext) ||
          /\.(ttf|otf|woff|woff2|eot)$/i.test(ext) ||
          /\.(ogg|mp3|mp4|m4a|wav|webm|mkv)$/i.test(ext) ||
          /\.(zip|apk)$/i.test(ext) ||
          /\.(db|sqlite)$/i.test(ext) ||
          /\.kotlin_builtins$/i.test(ext) ||
          /\.(bin|dat|raw)$/i.test(ext) ||
          (pathLower.includes('/lib/') && ext.endsWith('.so'));

        const data = new Uint8Array(await file.arrayBuffer());

        if (isTrueBinary) {
          binaryCount++;
          if (binaryCount <= 5 && options?.onLog) {
            options.onLog(`🔒 Binary file (STORE mode): ${name}`);
          }
        }

        zipObj.file(entryPath, data, {
          binary: true,
          compression: isTrueBinary ? 'STORE' : 'DEFLATE',
        });

        fileCount++;
        if (options?.onProgress && fileCount % 50 === 0) {
          options.onProgress(fileCount);
        }
      }
    }
  };

  await addToZip(dirHandle, '');
  return { zip: zipObj, fileCount, binaryCount };
}

// ---------------------------------------------------------------------------
export default function App() {
  // Workspace
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [fileList, setFileList] = useState<Array<{ path: string; handle: FileSystemFileHandle }>>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Idle');

  // Tabs
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState('');
  const lastSavedContents = useRef('');

  // Synchronization refs for live watcher & event listeners
  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const activeTabPathRef = useRef(activeTabPath);
  activeTabPathRef.current = activeTabPath;
  const fileContentsRef = useRef(fileContents);
  fileContentsRef.current = fileContents;
  const prevActiveTabRef = useRef<string | null>(null);
  const dirHandleRef = useRef(dirHandle);
  dirHandleRef.current = dirHandle;

  const handleCloseTab = useCallback((tabPath: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === tabPath);
      const next = prev.filter((t) => t.path !== tabPath);
      if (activeTabPathRef.current === tabPath) {
        setActiveTabPath(next.length > 0 ? next[Math.max(0, idx - 1)].path : null);
      }
      return next;
    });
  }, []);

  // Layout
  const [activePanel, setActivePanel] = useState<'explorer' | 'ai' | 'settings' | 'modifier'>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Status bar
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBuildLogOpen, setIsBuildLogOpen] = useState(false);

  // Decompiler (default apktool for maximum speed, matching APK Tool M)
  const [decompilerType, setDecompilerType] = useState<'jadx' | 'apktool'>('apktool');

  // Compiler / Build
  const [compilerBackend, setCompilerBackend] = useState<'aapt' | 'aapt2'>('aapt2'); // default aapt2 — reliable for modern Android apps
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStatus, setBuildStatus] = useState('');
  const [buildProgress, setBuildProgress] = useState<number>(-1); // -1 = indeterminate
  const [buildLog, setBuildLog] = useState<string[]>([]); // Detailed build log for diagnostics
  const [isDecompiling, setIsDecompiling] = useState(false);
  const [decompileStatus, setDecompileStatus] = useState('');
  // Real progress: 0-100. -1 = indeterminate (upload/server phase)
  const [decompileProgress, setDecompileProgress] = useState<number>(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // AI Agent & Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('apkrtool_gemini_key') || '');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Auto-Updater State (GitHub Releases)
  const { t } = useI18n();
  const [updateInfo, setUpdateInfo] = useState<{
    status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
    version?: string;
    percent?: number;
    error?: string;
  } | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onUpdaterStatus) return;

    const unsub = electronAPI.onUpdaterStatus((data: any) => {
      setUpdateInfo(data);
      if (data?.status === 'available' || data?.status === 'downloading' || data?.status === 'downloaded') {
        setShowUpdateBanner(true);
      }
    });

    return () => {
      unsub?.();
    };
  }, []);

  const handleUpdateAndRestart = () => {
    const electronAPI = (window as any).electronAPI;
    electronAPI?.updaterRestart?.();
  };

  // Bottom Dock Panel (Terminal, APK Runner, Output, Problems)
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomTabType>('terminal');
  const [realWorkspacePath, setRealWorkspacePath] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings
  const [autoSave, setAutoSave] = useState(true);
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem('apkrtool_editor_theme') || 'one-dark-pro');

  const handleSetTheme = (newTheme: string) => {
    setEditorTheme(newTheme);
    localStorage.setItem('apkrtool_editor_theme', newTheme);
  };

  const handleSetGeminiApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('apkrtool_gemini_key', key);
  };

  // Fullscreen & Window styling synchronizer
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    electronAPI.isFullscreen?.().then((fs: boolean) => {
      setIsFullscreen(fs);
      if (fs) document.body.classList.add('window-fullscreen');
      else document.body.classList.remove('window-fullscreen');
    });

    const unsubFs = electronAPI.onFullscreenChanged?.((fs: boolean) => {
      setIsFullscreen(fs);
      if (fs) document.body.classList.add('window-fullscreen');
      else document.body.classList.remove('window-fullscreen');
    });

    return () => {
      unsubFs?.();
    };
  }, []);

  const handleToggleFullscreen = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.toggleFullscreen) {
      const fs = await electronAPI.toggleFullscreen();
      setIsFullscreen(fs);
      if (fs) document.body.classList.add('window-fullscreen');
      else document.body.classList.remove('window-fullscreen');
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
        document.body.classList.add('window-fullscreen');
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
        document.body.classList.remove('window-fullscreen');
      }
    }
  };

  const handleToggleTerminal = () => {
    if (isBottomPanelOpen && bottomPanelTab === 'terminal') {
      setIsBottomPanelOpen(false);
    } else {
      setIsBottomPanelOpen(true);
      setBottomPanelTab('terminal');
    }
  };

  const handleOpenApkRunner = () => {
    setIsBottomPanelOpen(true);
    setBottomPanelTab('apk-runner');
  };

  // ---- Global hotkeys -------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((p) => !p);
      }
      if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (dirHandle) setIsCommandPaletteOpen((p) => !p);
        else setStatusMessage('⚠️ Open a workspace folder first (File → Open Workspace Folder).');
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFileAs();
      } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveFile();
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewWindow();
      } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewTextFile();
      }
      if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
      if (ctrl && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseEditor();
      }
      if (ctrl && e.key === ',') {
        e.preventDefault();
        handlePreferences();
      }
      if (ctrl && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        handleToggleTerminal();
      }
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirHandle, openTabs, activeTabPath, fileContents, isBottomPanelOpen, bottomPanelTab, isFullscreen]);

  // ---- Load file into editor when active tab changes -----------------------
  useEffect(() => {
    const prevPath = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTabPath;

    // Flush unsaved edits to previous file handle before loading new tab
    if (prevPath && prevPath !== activeTabPath && fileContentsRef.current !== lastSavedContents.current) {
      const prevActive = openTabsRef.current.find((t) => t.path === prevPath);
      if (prevActive) {
        const isBin = /\.(so|png|jpg|jpeg|gif|webp|ico|svg|bmp|arsc|dex|jar|bin|dat|ttf|otf|woff|woff2|ogg|mp3|wav|m4a|mp4|webm|flac|aar|class|apk|zip)$/i.test(prevActive.name);
        if (!isBin) {
          (async () => {
            try {
              const w = await prevActive.handle.createWritable();
              await w.write(fileContentsRef.current);
              await w.close();
            } catch {}
          })();
        }
      }
    }

    const active = openTabs.find((t) => t.path === activeTabPath);
    if (!active) {
      setFileContents('');
      lastSavedContents.current = '';
      return;
    }
    (async () => {
      try {
        const isBinaryOrMedia = /\.(so|png|jpg|jpeg|gif|webp|ico|svg|bmp|arsc|dex|jar|bin|dat|ttf|otf|woff|woff2|ogg|mp3|wav|m4a|mp4|webm|flac|aar|class|apk|zip)$/i.test(
          active.name
        );

        if (isBinaryOrMedia) {
          setFileContents('');
          lastSavedContents.current = '';
          setStatusMessage(`Opened ${active.name}`);
          return;
        }

        const file = await active.handle.getFile();
        const text = await file.text();
        setFileContents(text);
        lastSavedContents.current = text;
        setStatusMessage(`Opened: ${active.name}`);
      } catch {
        setStatusMessage('⚠️ Failed to read file — permission may have expired.');
      }
    })();
  }, [activeTabPath]);

  // ---- Auto-save (every 3 s if buffer dirty) --------------------------------
  useEffect(() => {
    if (!autoSave || !activeTabPath) return;
    const active = openTabs.find((t) => t.path === activeTabPath);
    if (!active) return;
    const isBinaryOrMedia = /\.(so|png|jpg|jpeg|gif|webp|ico|svg|bmp|arsc|dex|jar|bin|dat|ttf|otf|woff|woff2|ogg|mp3|wav|m4a|mp4|webm|flac|aar|class|apk|zip)$/i.test(
      active.name
    );
    if (isBinaryOrMedia) return;

    const id = setInterval(() => {
      if (fileContents !== lastSavedContents.current) handleSaveActiveFile();
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, activeTabPath, fileContents]);

  // ---- Index workspace (background) ----------------------------------------
  const indexWorkspace = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setIsIndexing(true);
    try {
      const files = await crawlDirectory(handle);
      setFileList(files);
      setStatusMessage(`Indexed ${files.length} files.`);
    } catch {
      setStatusMessage('⚠️ Failed to index workspace.');
    } finally {
      setIsIndexing(false);
    }
  }, []);

  // ---- Workspace auto-restore on launch -------------------------------------
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await getLastWorkspace();
        if (!saved || !isMounted) return;

        setDirHandle(saved.handle);

        const restoredTabs: Tab[] = [];
        for (const tabPath of saved.openTabPaths) {
          try {
            const fh = await getFileHandleRecursive(saved.handle, tabPath, { create: false });
            restoredTabs.push({
              name: tabPath.split('/').pop() || tabPath,
              path: tabPath,
              handle: fh,
            });
          } catch {
            // File may have been deleted externally while app was closed
          }
        }

        if (isMounted) {
          setOpenTabs(restoredTabs);
          if (saved.activeTabPath && restoredTabs.some((t) => t.path === saved.activeTabPath)) {
            setActiveTabPath(saved.activeTabPath);
          } else if (restoredTabs.length > 0) {
            setActiveTabPath(restoredTabs[0].path);
          }

          setRefreshTrigger((p) => p + 1);
          indexWorkspace(saved.handle);
          setStatusMessage(`Restored workspace: ${saved.handle.name}`);

          const realPath = await resolveDirectoryPath(saved.handle);
          if (realPath) {
            setRealWorkspacePath(realPath);
            if ((window as any).electronAPI?.watchWorkspace) {
              await (window as any).electronAPI.watchWorkspace(realPath);
            }
          }
        }
      } catch (err) {
        console.warn('[App] Workspace auto-restore failed:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [indexWorkspace]);

  // ---- Persist workspace and tabs across sessions ---------------------------
  useEffect(() => {
    if (dirHandle) {
      saveWorkspaceState(
        dirHandle,
        openTabs.map((t) => t.path),
        activeTabPath
      );
    }
  }, [dirHandle, openTabs, activeTabPath]);

  // ---- Live file tree auto-update on external filesystem changes & focus ---
  useEffect(() => {
    if (!dirHandle) return;

    const electronAPI = (window as any).electronAPI;

    const handleExternalChange = async () => {
      const currentDir = dirHandleRef.current;
      if (!currentDir) return;

      // 1. Silent file tree refresh (updates expanded nodes without collapsing or flickering)
      setRefreshTrigger((p) => p + 1);

      // 2. Refresh search index in background
      indexWorkspace(currentDir);

      // 3. Prune deleted tabs if files were removed externally
      const currentTabs = openTabsRef.current;
      for (const tab of currentTabs) {
        try {
          await tab.handle.getFile();
        } catch {
          handleCloseTab(tab.path);
        }
      }

      // 4. Reload active editor file if modified externally without unsaved editor changes
      const currentActivePath = activeTabPathRef.current;
      const activeTab = currentTabs.find((t) => t.path === currentActivePath);
      if (activeTab && fileContentsRef.current === lastSavedContents.current) {
        try {
          const file = await activeTab.handle.getFile();
          const text = await file.text();
          if (text !== lastSavedContents.current) {
            setFileContents(text);
            lastSavedContents.current = text;
          }
        } catch {}
      }
    };

    let cleanupWatcher: (() => void) | undefined;
    if (electronAPI?.onWorkspaceChanged) {
      cleanupWatcher = electronAPI.onWorkspaceChanged(() => {
        handleExternalChange();
      });
    }

    const onFocus = () => {
      handleExternalChange();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      if (cleanupWatcher) cleanupWatcher();
      window.removeEventListener('focus', onFocus);
    };
  }, [dirHandle, indexWorkspace, handleCloseTab]);

  // ---- Open workspace directory ---------------------------------------------
  const handleOpenDirectory = async () => {
    try {
      let handle: FileSystemDirectoryHandle;
      const electronAPI = (window as any).electronAPI;

      if (electronAPI?.dialogOpenDirectory) {
        const selectedPath = await electronAPI.dialogOpenDirectory();
        if (!selectedPath) return; // User cancelled
        handle = createNativeDirectoryHandle(selectedPath) as unknown as FileSystemDirectoryHandle;
      } else if ('showDirectoryPicker' in window) {
        try {
          handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        } catch (pickerErr: any) {
          if (pickerErr?.name === 'AbortError') return;
          // Fallback without options in case options object is not supported by environment
          handle = await (window as any).showDirectoryPicker();
        }
      } else {
        throw new Error('File System Access API (showDirectoryPicker) is not supported in this environment.');
      }

      setDirHandle(handle);
      setOpenTabs([]);
      setActiveTabPath(null);
      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(handle);
      await saveWorkspaceState(handle, [], null);

      const realPath = (handle as any).path || (await resolveDirectoryPath(handle));
      if (realPath) {
        setRealWorkspacePath(realPath);
        if (electronAPI?.watchWorkspace) {
          await electronAPI.watchWorkspace(realPath);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[OpenDirectory error]:', err);
        const isElectron = !!(window as any).electronAPI?.isElectron;
        const msg = isElectron
          ? `Gagal membuka folder: ${err?.message || err?.name || 'Akses ditolak'}. Pastikan folder memiliki izin baca/tulis.`
          : 'Browser File System Access API is required. Please use Chrome or Edge and allow permission.';
        alert(msg);
      }
    }
  };

  const handleCloseWorkspace = () => {
    clearWorkspaceState();
    (window as any).electronAPI?.unwatchWorkspace?.();
    setRealWorkspacePath(null);
    setDirHandle(null);
    setFileList([]);
    setOpenTabs([]);
    setActiveTabPath(null);
    setFileContents('');
    setStatusMessage('Workspace closed.');
  };

  // ---- File CRUD -----------------------------------------------------------
  const handleCreateFile = async (parentPath: string, name: string) => {
    if (!dirHandle) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      const fh = await getFileHandleRecursive(dirHandle, fullPath, { create: true });
      const w = await fh.createWritable();
      await w.write('');
      await w.close();
      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(dirHandle);
      handleFileClick(fullPath, fh);
      setStatusMessage(`Created: ${name}`);
    } catch { setStatusMessage('⚠️ Failed to create file.'); }
  };

  const handleCreateFolder = async (parentPath: string, name: string) => {
    if (!dirHandle) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      await createDirectoryRecursive(dirHandle, fullPath);
      setRefreshTrigger((p) => p + 1);
      setStatusMessage(`Created folder: ${name}`);
    } catch { setStatusMessage('⚠️ Failed to create folder.'); }
  };

  const handleDeleteEntry = async (entryPath: string) => {
    if (!dirHandle) return;
    try {
      await deleteEntryRecursive(dirHandle, entryPath);
      setOpenTabs((prev) => prev.filter((t) => t.path !== entryPath && !t.path.startsWith(`${entryPath}/`)));
      if (activeTabPath === entryPath || (activeTabPath && activeTabPath.startsWith(`${entryPath}/`))) {
        setActiveTabPath(null);
      }
      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(dirHandle);
      setStatusMessage(`Deleted: ${entryPath}`);
    } catch { setStatusMessage('⚠️ Failed to delete.'); }
  };

  const handleRenameEntry = async (oldPath: string, newName: string) => {
    if (!dirHandle) return;
    const parts = oldPath.split('/');
    parts.pop();
    const newPath = [...parts, newName].filter(Boolean).join('/');
    try {
      await renameEntry(dirHandle, oldPath, newPath);
      setOpenTabs((prev) =>
        prev.map((t) => {
          if (t.path === oldPath) {
            getFileHandleRecursive(dirHandle, newPath, { create: false })
              .then((newHandle) => {
                setOpenTabs((current) =>
                  current.map((ct) => (ct.path === newPath ? { ...ct, handle: newHandle } : ct))
                );
              })
              .catch(() => {});
            return { ...t, name: newName, path: newPath };
          }
          if (t.path.startsWith(`${oldPath}/`)) {
            const updatedChildPath = `${newPath}/${t.path.slice(oldPath.length + 1)}`;
            getFileHandleRecursive(dirHandle, updatedChildPath, { create: false })
              .then((newHandle) => {
                setOpenTabs((current) =>
                  current.map((ct) => (ct.path === updatedChildPath ? { ...ct, handle: newHandle } : ct))
                );
              })
              .catch(() => {});
            return { ...t, path: updatedChildPath };
          }
          return t;
        })
      );
      if (activeTabPath === oldPath) {
        setActiveTabPath(newPath);
      } else if (activeTabPath && activeTabPath.startsWith(`${oldPath}/`)) {
        setActiveTabPath(`${newPath}/${activeTabPath.slice(oldPath.length + 1)}`);
      }
      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(dirHandle);
      setStatusMessage(`Renamed to: ${newName}`);
    } catch { setStatusMessage('⚠️ Failed to rename.'); }
  };

  // Replace file content with a file selected from PC
  const handleReplaceFile = async (filePath: string, fileHandle: FileSystemFileHandle) => {
    try {
      const [pcFileHandle] = await (window as any).showOpenFilePicker();
      const pcFile = await pcFileHandle.getFile();
      const buffer = await pcFile.arrayBuffer();

      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      // Refresh the active editor buffer immediately — no tab reload needed
      // BUT: Only decode as text if it's a text file (not binary)
      if (activeTabPath === filePath) {
        const isBinary = /\.(png|jpg|jpeg|webp|so|dex|arsc|apk|jar|zip|bin)$/i.test(filePath);
        if (!isBinary) {
          const text = new TextDecoder().decode(buffer);
          setFileContents(text);
          lastSavedContents.current = text;
        }
      }

      // Increment trigger to refresh the tree in-place (no collapse)
      setRefreshTrigger((p) => p + 1);
      setStatusMessage(`Replaced: ${fileHandle.name}`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setStatusMessage('⚠️ Failed to replace file.');
      }
    }
  };

  // Import file from PC to a target folder
  const handleImportFile = async (parentPath: string) => {
    if (!dirHandle) return;
    try {
      const [pcFileHandle] = await (window as any).showOpenFilePicker();
      const pcFile = await pcFileHandle.getFile();
      const name = pcFile.name;
      const buffer = await pcFile.arrayBuffer();

      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      const targetFileHandle = await getFileHandleRecursive(dirHandle, fullPath, { create: true });

      const writable = await targetFileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(dirHandle);
      setStatusMessage(`Imported: ${name}`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setStatusMessage('⚠️ Failed to import file.');
      }
    }
  };

  // ---- Tab management ------------------------------------------------------
  const handleFileClick = (filePath: string, handle: FileSystemFileHandle) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === filePath)) return prev;
      return [...prev, { name: handle.name, path: filePath, handle }];
    });
    setActiveTabPath(filePath);
  };

  // ---- Save ---------------------------------------------------------------
  const handleSaveActiveFile = async () => {
    const active = openTabs.find((t) => t.path === activeTabPath);
    if (!active) return;

    const isBinaryFile = /\.(so|png|jpg|jpeg|gif|webp|ico|svg|bmp|arsc|dex|jar|bin|dat|ttf|otf|woff|woff2|ogg|mp3|wav|m4a|mp4|webm|flac|aar|class|apk|zip)$/i.test(
      active.path
    );

    if (isBinaryFile) {
      setStatusMessage('ℹ️ Binary asset viewer is read-only (use "Replace File" in Explorer to update).');
      return;
    }

    setIsSaving(true);
    try {
      const writable = await active.handle.createWritable();
      await writable.write(fileContents);
      await writable.close();
      lastSavedContents.current = fileContents;
      setStatusMessage(`Saved: ${active.name}`);
    } catch {
      setStatusMessage('⚠️ Save failed — permission may have expired.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Navbar File Menu Handlers -------------------------------------------
  const handleNewTextFile = async () => {
    if (!dirHandle) {
      if ('showSaveFilePicker' in window) {
        try {
          const fh = await (window as any).showSaveFilePicker({
            suggestedName: 'Untitled.txt',
            types: [{ description: 'Text File', accept: { 'text/plain': ['.txt'] } }],
          });
          const w = await fh.createWritable();
          await w.write('');
          await w.close();
          handleFileClick(fh.name, fh);
        } catch {}
      } else {
        alert('Buka folder workspace terlebih dahulu.');
      }
      return;
    }
    let name = 'Untitled.txt';
    let counter = 1;
    while (true) {
      try {
        await dirHandle.getFileHandle(name);
        name = `Untitled-${counter}.txt`;
        counter++;
      } catch {
        break;
      }
    }
    await handleCreateFile('', name);
  };

  const handleNewFilePrompt = async () => {
    const name = prompt('New filename (e.g. MainActivity.smali or strings.xml):');
    if (!name) return;
    if (dirHandle) {
      await handleCreateFile('', name);
    } else if ('showSaveFilePicker' in window) {
      try {
        const fh = await (window as any).showSaveFilePicker({ suggestedName: name });
        const w = await fh.createWritable();
        await w.write('');
        await w.close();
        handleFileClick(fh.name, fh);
      } catch {}
    }
  };

  const handleNewWindow = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openNewWindow) {
      electronAPI.openNewWindow();
    } else {
      window.open(window.location.href, '_blank');
    }
  };

  const handleOpenFile = async () => {
    try {
      if (!('showOpenFilePicker' in window)) {
        alert('File System Access API tidak didukung browser ini.');
        return;
      }
      const [fileHandle] = await (window as any).showOpenFilePicker();
      if (!fileHandle) return;
      handleFileClick(fileHandle.name, fileHandle);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[OpenFile error]:', err);
      }
    }
  };

  const handleOpenWorkspaceFromFile = async () => {
    try {
      if (!('showOpenFilePicker' in window)) {
        alert('File System Access API tidak didukung.');
        return;
      }
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Workspace / Package (APK, ZIP, YAML)',
            accept: {
              'application/zip': ['.apk', '.zip'],
              'text/yaml': ['.yml', '.yaml'],
            },
          },
        ],
      });
      if (!fileHandle) return;
      const file = await fileHandle.getFile();
      if (file.name.endsWith('.apk') || file.name.endsWith('.zip')) {
        alert(`File "${file.name}" terpilih. Silakan tentukan folder workspace tujuan untuk decompile/extract.`);
        await handleOpenDirectory();
      } else {
        await handleFileClick(file.name, fileHandle);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[OpenWorkspaceFromFile]', err);
      }
    }
  };

  const handleOpenRecentWorkspace = async (handle: FileSystemDirectoryHandle) => {
    try {
      if ((handle as any).queryPermission) {
        let status = await (handle as any).queryPermission({ mode: 'readwrite' });
        if (status !== 'granted' && (handle as any).requestPermission) {
          status = await (handle as any).requestPermission({ mode: 'readwrite' });
        }
        if (status !== 'granted') {
          alert('Izin akses folder ditolak.');
          return;
        }
      }
      setDirHandle(handle);
      setOpenTabs([]);
      setActiveTabPath(null);
      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(handle);
      await saveWorkspaceState(handle, [], null);

      const realPath = (handle as any).path || (await resolveDirectoryPath(handle));
      if (realPath) {
        setRealWorkspacePath(realPath);
        if ((window as any).electronAPI?.watchWorkspace) {
          await (window as any).electronAPI.watchWorkspace(realPath);
        }
      }
      setStatusMessage(`Opened recent workspace: ${handle.name}`);
    } catch (err: any) {
      alert(`Gagal membuka recent workspace: ${err.message}`);
    }
  };

  const handleClearRecentWorkspacesAction = async () => {
    await clearRecentWorkspaces();
    setStatusMessage('Recent workspaces cleared.');
  };

  const handleAddFolderToWorkspace = async () => {
    if (!dirHandle) {
      alert('Buka workspace terlebih dahulu.');
      return;
    }
    try {
      let extDir: FileSystemDirectoryHandle | null = null;
      const electronAPI = (window as any).electronAPI;

      if (electronAPI?.dialogOpenDirectory) {
        const selected = await electronAPI.dialogOpenDirectory();
        if (!selected) return;
        extDir = createNativeDirectoryHandle(selected) as unknown as FileSystemDirectoryHandle;
      } else if ('showDirectoryPicker' in window) {
        extDir = await (window as any).showDirectoryPicker({ mode: 'read' });
      }

      if (!extDir) return;
      setStatusMessage(`Adding folder "${extDir.name}" into workspace...`);
      const targetSub = await dirHandle.getDirectoryHandle(extDir.name, { create: true });

      const copyRecursive = async (src: FileSystemDirectoryHandle, dst: FileSystemDirectoryHandle) => {
        for await (const [name, entry] of (src as any).entries()) {
          if (entry.kind === 'directory') {
            const subDst = await dst.getDirectoryHandle(name, { create: true });
            await copyRecursive(entry, subDst);
          } else {
            const srcFile = await (entry as FileSystemFileHandle).getFile();
            const dstFile = await dst.getFileHandle(name, { create: true });
            const w = await dstFile.createWritable();
            await w.write(await srcFile.arrayBuffer());
            await w.close();
          }
        }
      };

      await copyRecursive(extDir, targetSub);
      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(dirHandle);
      setStatusMessage(`Added folder "${extDir.name}" to workspace.`);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(`Gagal menambahkan folder: ${err.message}`);
      }
    }
  };

  const handleSaveWorkspaceAs = async () => {
    if (!dirHandle) {
      alert('Buka workspace terlebih dahulu.');
      return;
    }
    try {
      setStatusMessage('Packing workspace into ZIP...');
      const { zip, fileCount } = await createWorkspaceZip(dirHandle);
      const blob = await zip.generateAsync({ type: 'blob' });

      if ('showSaveFilePicker' in window) {
        const fh = await (window as any).showSaveFilePicker({
          suggestedName: `${dirHandle.name}-backup.zip`,
          types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
        });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        setStatusMessage(`Workspace saved as: ${fh.name} (${fileCount} files)`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dirHandle.name}-backup.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setStatusMessage(`Workspace backup downloaded (${fileCount} files).`);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(`Gagal menyimpan workspace: ${err.message}`);
      }
    }
  };

  const handleDuplicateWorkspace = async () => {
    if (!dirHandle) {
      alert('Buka workspace terlebih dahulu.');
      return;
    }
    try {
      setStatusMessage('Duplicating workspace...');
      const { zip, fileCount } = await createWorkspaceZip(dirHandle);
      const blob = await zip.generateAsync({ type: 'blob' });

      if ('showSaveFilePicker' in window) {
        const fh = await (window as any).showSaveFilePicker({
          suggestedName: `${dirHandle.name}_copy.zip`,
          types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
        });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        setStatusMessage(`Workspace duplicated as: ${fh.name} (${fileCount} files)`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dirHandle.name}_copy.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setStatusMessage(`Workspace copy downloaded (${fileCount} files).`);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(`Gagal menduplikasi workspace: ${err.message}`);
      }
    }
  };

  const handleSaveFileAs = async () => {
    if (!activeTabPath) {
      alert('Tidak ada file aktif di editor.');
      return;
    }
    try {
      const active = openTabs.find((t) => t.path === activeTabPath);
      const defaultName = active?.name || 'untitled.txt';

      if ('showSaveFilePicker' in window) {
        const fh = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
        });
        const w = await fh.createWritable();
        await w.write(fileContents);
        await w.close();

        setOpenTabs((prev) => {
          if (prev.some((t) => t.path === fh.name)) return prev;
          return [...prev, { name: fh.name, path: fh.name, handle: fh }];
        });
        setActiveTabPath(fh.name);
        lastSavedContents.current = fileContents;
        setStatusMessage(`Saved As: ${fh.name}`);
      } else {
        const name = prompt('Simpan sebagai nama file baru:', defaultName);
        if (name && dirHandle) {
          await handleCreateFile('', name);
          const fh = await getFileHandleRecursive(dirHandle, name, { create: true });
          const w = await fh.createWritable();
          await w.write(fileContents);
          await w.close();
          lastSavedContents.current = fileContents;
          setStatusMessage(`Saved As: ${name}`);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(`Gagal Save As: ${err.message}`);
      }
    }
  };

  const handleSaveAll = async () => {
    await handleSaveActiveFile();
    setStatusMessage('All files saved.');
  };

  const handlePreferences = () => {
    setIsSettingsModalOpen(true);
  };

  const handleRevertFile = async () => {
    const active = openTabs.find((t) => t.path === activeTabPath);
    if (!active) return;
    try {
      const f = await active.handle.getFile();
      const text = await f.text();
      setFileContents(text);
      lastSavedContents.current = text;
      setStatusMessage(`Reverted: ${active.name}`);
    } catch {
      setStatusMessage('⚠️ Failed to revert file from disk.');
    }
  };

  const handleCloseEditor = () => {
    if (activeTabPath) {
      handleCloseTab(activeTabPath);
    }
  };

  const handleCloseWindow = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.closeWindow) {
      electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  const handleExit = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.exitApp) {
      electronAPI.exitApp();
    } else {
      window.close();
    }
  };

  // ---- Decompile -----------------------------------------------------------
  const handleCancelDecompile = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsDecompiling(false);
    setDecompileStatus('');
    setDecompileProgress(-1);
    setStatusMessage('Decompilation cancelled.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTriggerDecompile = () => fileInputRef.current?.click();

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dirHandle) return;

    console.log('[DEBUG FRONTEND] Active decompilerType state value:', decompilerType);

    // 1. Pre-request readwrite permission before anything else
    try {
      const perm = await (dirHandle as any).requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        alert('Write permission is required to unpack the decompiled files into your workspace folder.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    } catch (err) {
      console.warn('[Permission] requestPermission() not available on this browser:', err);
      // Non-fatal: continue and let the actual write fail if permissions are missing
    }

    // 1.5 Clear existing decompiler structures in parallel to prevent mixing old outputs
    await Promise.allSettled([
      dirHandle.removeEntry('sources', { recursive: true }),
      dirHandle.removeEntry('smali', { recursive: true }),
      dirHandle.removeEntry('lib', { recursive: true }),
      dirHandle.removeEntry('resources', { recursive: true }),
      dirHandle.removeEntry('res', { recursive: true }),
      dirHandle.removeEntry('assets', { recursive: true }),
      dirHandle.removeEntry('AndroidManifest.xml'),
      dirHandle.removeEntry('apktool.yml'),
    ]).catch(() => {});

    setIsDecompiling(true);
    setDecompileStatus('Mempersiapkan proses decompile APK...');
    setDecompileProgress(-1); // indeterminate during upload + decompile
    setStatusMessage('Decompiling APK…');

    // Create AbortController for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // 2. Local decompilation request
      const formData = new FormData();
      const mappedTool = (decompilerType as string) === 'smali' || (decompilerType as string) === 'apktool' ? 'apktool' : 'jadx';
      formData.append('tool', mappedTool);
      formData.append('apk', file);
      formData.append('fastMode', 'true');

      console.log('[DEBUG FRONTEND] FormData payload values - tool:', formData.get('tool'), 'apk:', formData.get('apk') ? 'File present' : 'No file');

      let response;
      try {
        response = await fetch('/api/decompile', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') throw fetchErr;
        throw new Error(`Gagal memproses decompile: ${fetchErr.message}`);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: response.statusText }));
        const detail = [
          errData.error,
          errData.hint   ? `Hint: ${errData.hint}` : '',
          errData.stderr ? `\nstderr:\n${errData.stderr.slice(0, 2000)}` : '',
        ].filter(Boolean).join('\n');
        throw new Error(detail);
      }

      setDecompileStatus('Mengekstrak hasil decompile…');
      const zipBlob = await response.blob();

      setDecompileStatus('Unpacking archive into workspace…');
      setDecompileProgress(0); // ZIP loaded, about to start writing
      const zip = await JSZip.loadAsync(zipBlob);

      // 3. High-speed parallel batch write with O(1) directory caching
      const written = await writeZipToDirectory(
        zip,
        dirHandle,
        (done, total) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          setDecompileProgress(pct);
          setDecompileStatus(`Writing files… ${done} / ${total}`);
          setStatusMessage(`Extracting: ${done} / ${total} files`);
        },
        24,   // 24 parallel writes per micro-batch
        150   // update UI state every 150 files for high responsiveness
      );

      setRefreshTrigger((p) => p + 1);
      await indexWorkspace(dirHandle);
      const realPath = await resolveDirectoryPath(dirHandle);
      if (realPath) {
        setRealWorkspacePath(realPath);
        if ((window as any).electronAPI?.watchWorkspace) {
          await (window as any).electronAPI.watchWorkspace(realPath);
        }
      }
      setStatusMessage(`Decompile complete — ${written} files extracted.`);
      alert(`✅ Decompilation successful!\n${written} files written to your local workspace.`);
    } catch (err: any) {
      console.error('[Decompile]', err);
      // Don't show alert if it was a user-initiated abort
      if (err.name === 'AbortError') {
        setStatusMessage('Decompilation cancelled.');
      } else {
        alert(`❌ Decompilation failed:\n\n${err.message}`);
        setStatusMessage('⚠️ Decompilation failed.');
      }
    } finally {
      setIsDecompiling(false);
      setDecompileStatus('');
      setDecompileProgress(-1);
      abortControllerRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---- AI Agent -------------------------------------------------------------
  const handleSendAiQuery = async (overrideMsg?: string) => {
    const msg = overrideMsg || '';
    if (!msg.trim()) return;

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assistant_${Date.now()}`;

    setChatHistory((prev) => [...prev, { id: userMsgId, sender: 'user', text: msg }]);

    const active = openTabs.find((t) => t.path === activeTabPath);
    const electronAPI = (window as any).electronAPI;

    try {
      if (electronAPI?.aiAgentRun) {
        if (geminiApiKey.trim()) {
          await electronAPI.aiSetKeys(geminiApiKey);
        }
        const res = await electronAPI.aiAgentRun({
          prompt: msg,
          workspacePath: realWorkspacePath,
          activeFile: active?.path ?? null,
          fileContent: active ? fileContents : null,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          apiKeys: geminiApiKey,
        });

        setChatHistory((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: res.response,
            steps: res.executionTrace,
          },
        ]);
      } else {
        const res = await fetch('/api/ai/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': geminiApiKey },
          body: JSON.stringify({
            prompt: msg,
            fileName: active?.name ?? null,
            fileContent: active ? fileContents : null,
            workspacePath: realWorkspacePath,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error ?? res.statusText);
        }
        const data = await res.json();
        setChatHistory((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: data.response,
            steps: data.executionTrace,
          },
        ]);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          text: `⚠️ AI Agent error: ${err.message}`,
        },
      ]);
    }
  };

  const handleTriggerContextAi = (action: 'explain' | 'javadoc' | 'audit', selectedText: string) => {
    setIsAiPanelOpen(true);
    const prompts: Record<typeof action, string> = {
      explain: `Explain the exact logic, intent, and parameters of this code:\n\`\`\`java\n${selectedText}\n\`\`\``,
      javadoc: `Write clean Javadoc comments for:\n\`\`\`java\n${selectedText}\n\`\`\``,
      audit: `Audit for security vulnerabilities, hardcoded values, and cryptographic weaknesses:\n\`\`\`java\n${selectedText}\n\`\`\``,
    };
    handleSendAiQuery(prompts[action]);
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setStatusMessage('AI chat history cleared.');
  };

  // ---- Build APK — zips the workspace folder and POSTs to /api/build --------
  const handleBuildApk = async () => {
    if (!dirHandle) return;

    setIsBuilding(true);
    setBuildStatus('Checking workspace…');
    setBuildProgress(-1);

    try {
      // ── Pre-flight: verify this is an Apktool workspace ──────────────────
      setBuildLog([]);
      const addLog = (msg: string) => {
        console.log(`[Build] ${msg}`);
        setBuildLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      };

      addLog('🔍 Checking workspace type...');
      let hasApktoolYml = false;
      try {
        await dirHandle.getFileHandle('apktool.yml');
        hasApktoolYml = true;
        addLog('✅ apktool.yml found');
      } catch {
        hasApktoolYml = false;
        addLog('❌ apktool.yml NOT FOUND');
      }

      if (!hasApktoolYml) {
        throw new Error(
          'apktool.yml not found in this workspace.\n\n' +
          'Build APK only works with an Apktool-decompiled workspace.\n' +
          'Your current workspace appears to be a JADX output (Java sources).\n\n' +
          'To build an APK:\n' +
          '1. Switch to Apktool decompiler in Settings\n' +
          '2. Decompile the APK again\n' +
          '3. Make your edits\n' +
          '4. Then click Build APK'
        );
      }

      // ── Validate critical files exist ────────────────────────────────────
      setBuildStatus('Validating workspace structure…');
      addLog('🔍 Validating required files...');
      const requiredFiles = ['AndroidManifest.xml'];
      const missingFiles: string[] = [];
      
      for (const filename of requiredFiles) {
        try {
          await dirHandle.getFileHandle(filename);
          addLog(`✅ ${filename} found`);
        } catch {
          missingFiles.push(filename);
          addLog(`❌ ${filename} MISSING`);
        }
      }
      
      if (missingFiles.length > 0) {
        throw new Error(
          `Missing required files:\n${missingFiles.join(', ')}\n\n` +
          'Your workspace may be incomplete or corrupted.\n' +
          'Try decompiling the APK again.'
        );
      }

      // ── Check for smali or smali_* directories ───────────────────────────
      addLog('🔍 Checking for smali directories...');
      let hasSmali = false;
      for await (const [name, entry] of (dirHandle as any).entries()) {
        if (entry.kind === 'directory' && /^smali(_.*)?$/i.test(name)) {
          hasSmali = true;
          addLog(`✅ Found ${name}/`);
          break;
        }
      }
      
      if (!hasSmali) {
        addLog('⚠️  No smali/ directories found — workspace might be JADX output');
        console.warn('[Build] No smali/ directories found — workspace might be JADX output');
      }

      // ── Step 1: Zip the workspace ─────────────────────────────────────────
      setBuildStatus('Scanning workspace files…');
      setBuildProgress(5);
      addLog('📦 Creating workspace ZIP...');

      const { zip: zipObj, fileCount, binaryCount } = await createWorkspaceZip(dirHandle, {
        onLog: addLog,
        onProgress: (cnt) => setBuildStatus(`Scanning… ${cnt} files`),
      });

      addLog(`✅ Scanned ${fileCount} files (${binaryCount} binary)`);
      setBuildStatus(`Compressing ${fileCount} files…`);
      setBuildProgress(20);

      const zipBlob = await zipObj.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
        (meta) => {
          // JSZip reports compression progress 0–100
          setBuildProgress(20 + Math.round(meta.percent * 0.25)); // maps to 20–45%
          setBuildStatus(`Compressing… ${Math.round(meta.percent)}%`);
        }
      );

      // ── Step 1.5: Validate apktool.yml integrity ───────────────────────────
      setBuildStatus('Memvalidasi konfigurasi apktool.yml…');
      setBuildProgress(48);
      addLog('🔍 Memvalidasi integritas apktool.yml...');

      try {
        let ymlContent = '';
        try {
          const ymlHandle = await dirHandle.getFileHandle('apktool.yml');
          const ymlFile = await ymlHandle.getFile();
          ymlContent = await ymlFile.text();
        } catch {
          const zipYml = zipObj.file('apktool.yml') || Object.values(zipObj.files).find(f => f.name.endsWith('apktool.yml'));
          if (zipYml) {
            ymlContent = await zipYml.async('string');
          }
        }

        if (!ymlContent) {
          throw new Error(
            'apktool.yml tidak ditemukan di workspace.\n\n' +
            'Build APK hanya dapat memproses workspace hasil decompile Apktool.\n' +
            'Jika Anda menggunakan JADX (kode Java), gunakan opsi Apktool di menu Settings untuk decompile ulang.'
          );
        }

        const validateForm = new FormData();
        validateForm.append('yml_content', ymlContent);
        
        const validateRes = await fetch('/api/check-yml', { 
          method: 'POST', 
          body: validateForm 
        });
        
        if (validateRes.ok) {
          const validateData = await validateRes.json();
          addLog(`📋 Status validasi: ${validateData.valid ? '✅ VALID' : '❌ INVALID'}`);
          
          if (!validateData.valid) {
            const issueList = validateData.issues?.join('\n• ') || 'Masalah konfigurasi tidak dikenal';
            addLog(`❌ Masalah ditemukan:\n${validateData.issues?.map((i: string) => `  • ${i}`).join('\n')}`);
            throw new Error(
              `Validasi workspace gagal:\n\n• ${issueList}\n\n` +
              (validateData.hint || 'Coba decompile ulang APK dengan Apktool.')
            );
          }
          
          if (!validateData.hasDoNotCompress) {
            addLog('⚠️  apktool.yml tidak memiliki doNotCompress — build tetap dilanjutkan');
          } else {
            addLog('✅ apktool.yml terverifikasi dengan entri doNotCompress');
          }
          
          addLog(`📄 Ukuran YAML: ${validateData.size} bytes`);
        }
      } catch (validateErr: any) {
        if (validateErr.message?.includes('Validasi workspace gagal') || validateErr.message?.includes('apktool.yml tidak ditemukan')) {
          throw validateErr;
        }
        addLog(`⚠️  Catatan validasi: ${validateErr.message}`);
      }

      // ── Step 2: Upload ZIP to /api/build ──────────────────────────────────
      setBuildStatus('Memproses build APK secara lokal…');
      setBuildProgress(50);
      addLog(`📦 Mempersiapkan paket workspace (${(zipBlob.size / 1024 / 1024).toFixed(2)} MB)...`);

      const formData = new FormData();
      formData.append('workspace', zipBlob, 'workspace.zip');
      formData.append('compiler', compilerBackend);
      addLog(`🔧 Compiler: ${compilerBackend.toUpperCase()}`);

      let res: Response;
      try {
        res = await fetch('/api/build', { method: 'POST', body: formData });
      } catch (fetchErr: any) {
        addLog(`❌ Build error: ${fetchErr.message}`);
        throw new Error(`Gagal memproses build APK: ${fetchErr.message}`);
      }

      setBuildProgress(75);
      setBuildStatus('Membangun APK…');
      addLog('🏗️  Membangun APK...');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        const errMsg = errData.error ?? res.statusText;
        addLog(`❌ Build failed: ${errMsg.split('\n')[0]}`);
        throw new Error(errMsg);
      }

      // ── Step 3: Download rebuilt + signed APK ─────────────────────────────
      // Server handles: apktool b → strip META-INF → jarsigner → zipalign (optional)
      setBuildStatus('Mendownload APK yang sudah disign…');
      setBuildProgress(95);
      addLog('📥 Downloading signed APK...');

      const apkBlob = await res.blob();
      addLog(`✅ APK ready: ${(apkBlob.size / 1024 / 1024).toFixed(2)} MB`);

      // Save directly to workspace directory if open
      try {
        const outHandle = await dirHandle.getFileHandle('rebuilt-signed.apk', { create: true });
        const outWritable = await outHandle.createWritable();
        await outWritable.write(apkBlob);
        await outWritable.close();
        setRefreshTrigger((p) => p + 1);
        addLog('💾 Saved rebuilt-signed.apk to workspace root');
      } catch {}

      const url  = URL.createObjectURL(apkBlob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = 'rebuilt-signed.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBuildProgress(100);
      setBuildStatus('APK signed & ready!');
      setStatusMessage('✅ Build + Sign complete — APK downloaded.');
      addLog('🎉 Build complete! APK downloaded.');

      // Brief pause so user sees 100% before modal closes
      await new Promise((r) => setTimeout(r, 900));

    } catch (err: any) {
      console.error('[Build]', err);
      setBuildLog(prev => [...prev, `❌ ERROR: ${err.message}`]);
      alert(`❌ Build failed:\n\n${err.message}`);
      setStatusMessage('⚠️ Build failed.');
    } finally {
      setIsBuilding(false);
      setBuildStatus('');
      setBuildProgress(-1);
    }
  };

  // -------------------------------------------------------------------------
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-editor-bg select-none">
      {/* Navbar */}
      <Navbar
        workspacePath={realWorkspacePath}
        dirHandle={dirHandle}
        onOpenDirectory={handleOpenDirectory}
        onNewTextFile={handleNewTextFile}
        onNewFile={handleNewFilePrompt}
        onNewWindow={handleNewWindow}
        onOpenFile={handleOpenFile}
        onOpenWorkspaceFromFile={handleOpenWorkspaceFromFile}
        onOpenRecentWorkspace={handleOpenRecentWorkspace}
        onClearRecentWorkspaces={handleClearRecentWorkspacesAction}
        onAddFolderToWorkspace={handleAddFolderToWorkspace}
        onSaveWorkspaceAs={handleSaveWorkspaceAs}
        onDuplicateWorkspace={handleDuplicateWorkspace}
        onSaveActiveFile={handleSaveActiveFile}
        onSaveFileAs={handleSaveFileAs}
        onSaveAll={handleSaveAll}
        autoSave={autoSave}
        onToggleAutoSave={() => setAutoSave((p) => !p)}
        onPreferences={handlePreferences}
        onRevertFile={handleRevertFile}
        onCloseEditor={handleCloseEditor}
        onCloseWindow={handleCloseWindow}
        onExit={handleExit}
        onCloseWorkspace={handleCloseWorkspace}
        onToggleSidebar={() => setIsSidebarOpen((p) => !p)}
        onSelectPanel={setActivePanel}
        onTriggerDecompile={handleTriggerDecompile}
        decompilerType={decompilerType}
        onSelectDecompiler={setDecompilerType}
        compilerBackend={compilerBackend}
        onSelectCompilerBackend={setCompilerBackend}
        onBuildApk={handleBuildApk}
        isBuilding={isBuilding}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onClearChat={handleClearChat}
        workspaceOpened={!!dirHandle}
        activeFileOpened={!!activeTabPath}
        onToggleTerminal={handleToggleTerminal}
        onOpenApkRunner={handleOpenApkRunner}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        <ActivityBar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((p) => !p)}
          isAiPanelOpen={isAiPanelOpen}
          onToggleAiPanel={() => setIsAiPanelOpen((p) => !p)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {isSidebarOpen && (
          <Sidebar
            activePanel={activePanel}
            dirHandle={dirHandle}
            workspacePath={realWorkspacePath}
            onOpenDirectory={handleOpenDirectory}
            onFileClick={handleFileClick}
            onRefreshTrigger={refreshTrigger}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteEntry={handleDeleteEntry}
            onRenameEntry={handleRenameEntry}
            onReplaceFile={handleReplaceFile}
            onImportFile={handleImportFile}
            onTriggerRefresh={() => setRefreshTrigger((p) => p + 1)}
            onStatusMessage={setStatusMessage}
            onOpenSkillsModal={() => setIsSkillsModalOpen(true)}
            onOpenMcpModal={() => setIsMcpModalOpen(true)}
            geminiApiKey={geminiApiKey}
            setGeminiApiKey={handleSetGeminiApiKey}
            decompilerType={decompilerType}
            onSelectDecompiler={setDecompilerType}
            autoSave={autoSave}
            onToggleAutoSave={() => setAutoSave((p) => !p)}
            theme={editorTheme}
            onSelectTheme={handleSetTheme}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <EditorArea
            openTabs={openTabs}
            activeTabPath={activeTabPath}
            onSelectTab={setActiveTabPath}
            onCloseTab={handleCloseTab}
            fileContents={fileContents}
            onContentChange={setFileContents}
            onCursorChange={setCursorPos}
            onTriggerDecompile={handleTriggerDecompile}
            onOpenDirectory={handleOpenDirectory}
            onOpenRecentWorkspace={handleOpenRecentWorkspace}
            onSelectPanel={(panel) => {
              if (panel === 'ai') {
                setIsAiPanelOpen(true);
              } else {
                setActivePanel(panel);
                if (!isSidebarOpen) setIsSidebarOpen(true);
              }
            }}
            onOpenApkRunner={handleOpenApkRunner}
            workspaceOpened={!!dirHandle}
            workspacePath={realWorkspacePath}
            workspaceName={dirHandle?.name || realWorkspacePath?.split(/[\\/]/).pop() || 'Workspace'}
            onNewTextFile={handleNewTextFile}
            onTriggerContextAi={handleTriggerContextAi}
            isSidebarOpen={isSidebarOpen}
            theme={editorTheme}
          />

          <BottomPanel
            isOpen={isBottomPanelOpen}
            onClose={() => setIsBottomPanelOpen(false)}
            activeTab={bottomPanelTab}
            onSelectTab={setBottomPanelTab}
            workspacePath={realWorkspacePath}
            dirHandle={dirHandle}
            buildLog={buildLog}
            onStatusMessage={setStatusMessage}
          />
        </div>

        {/* Right-side AI Agent Panel */}
        {isAiPanelOpen && (
          <AiAgentPanel
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            activeFilePath={activeTabPath}
            fileContents={fileContents}
            workspacePath={realWorkspacePath}
            apiKeys={geminiApiKey}
            setApiKeys={handleSetGeminiApiKey}
            onOpenSkillsModal={() => setIsSkillsModalOpen(true)}
            onOpenMcpModal={() => setIsMcpModalOpen(true)}
            onClose={() => setIsAiPanelOpen(false)}
          />
        )}
      </div>

      {/* Status bar */}
      <StatusBar
        cursorPos={activeTabPath ? cursorPos : null}
        activeFileOpened={!!activeTabPath}
        statusMessage={statusMessage}
        isIndexing={isIndexing}
        isSaving={isSaving}
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleTerminal={handleToggleTerminal}
        onToggleApkRunner={handleOpenApkRunner}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Command palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        fileList={fileList}
        onSelectFile={handleFileClick}
      />

      {/* Hidden APK file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".apk"
        className="hidden"
        onChange={handleApkUpload}
      />

      {/* Decompile progress overlay */}
      {isDecompiling && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4 font-sans">
          <div className="w-full max-w-md bg-[#181818] rounded-[6px] shadow-2xl p-6 flex flex-col items-center gap-4 text-center select-text">
            <RefreshCw className="animate-spin text-[#0078D4]" size={28} />
            <h3 className="text-xs font-semibold text-[#FFFFFF] uppercase tracking-wider">
              {decompileProgress === 100 ? 'Finalizing Decompile...' : 'Decompiling APK Binary'}
            </h3>

            {/* Status text */}
            <p className="w-full bg-[#1F1F1F] rounded-[4px] p-3 text-xs text-[#CCCCCC] font-mono leading-relaxed min-h-[3rem]">
              {decompileStatus}
            </p>

            {/* Progress bar */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="w-full bg-[#1F1F1F] h-1.5 rounded-full overflow-hidden">
                {decompileProgress < 0 ? (
                  <div
                    className="h-full bg-[#0078D4] rounded-full"
                    style={{ width: '40%', animation: 'indeterminate-slide 1.4s ease-in-out infinite' }}
                  />
                ) : (
                  <div
                    className="h-full bg-[#0078D4] rounded-full transition-all duration-150"
                    style={{ width: `${decompileProgress}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-[#696969] font-mono">
                {decompileProgress < 0 ? 'Processing local bytecode...' : `${decompileProgress}%`}
              </span>
            </div>

            <button
              onClick={handleCancelDecompile}
              className="px-4 py-1.5 text-[#FFFFFF] bg-[#1F1F1F] hover:bg-[#252526] text-xs font-medium uppercase tracking-wider rounded-[3px] transition-colors"
            >
              Cancel
            </button>
            <p className="text-[10px] text-[#696969] italic">
              Do not close window. Unpacking directly into your local workspace folder.
            </p>
          </div>
        </div>
      )}

      {/* Build APK progress overlay */}
      {isBuilding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4 font-sans">
          <div className="w-full max-w-md bg-[#181818] rounded-[6px] shadow-2xl p-6 flex flex-col items-center gap-4 text-center select-text">

            {/* Icon — checkmark when done, spinner otherwise */}
            {buildProgress === 100 ? (
              <div className="w-10 h-10 rounded-full bg-[#0078D4] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <RefreshCw className="animate-spin text-[#0078D4]" size={28} />
            )}

            <h3 className="text-xs font-semibold text-[#FFFFFF] uppercase tracking-wider">
              {buildProgress === 100 ? 'Build Completed' : 'Building APK Binary'}
            </h3>

            {/* Step indicators */}
            <div className="w-full flex justify-between text-[10px] font-mono px-1">
              {[
                { label: 'Check',    threshold: 5  },
                { label: 'Compress', threshold: 45 },
                { label: 'Upload',   threshold: 75 },
                { label: 'Build',    threshold: 88 },
                { label: 'Sign',     threshold: 95 },
                { label: 'Done',     threshold: 100 },
              ].map(({ label, threshold }) => (
                <span
                  key={label}
                  className={
                    buildProgress >= threshold
                      ? 'text-[#0078D4] font-semibold'
                      : 'text-[#696969]'
                  }
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Status text */}
            <p className="w-full bg-[#1F1F1F] rounded-[4px] p-3 text-xs text-[#CCCCCC] font-mono leading-relaxed min-h-[2.5rem]">
              {buildStatus}
            </p>

            {/* Progress bar */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="w-full bg-[#1F1F1F] h-1.5 rounded-full overflow-hidden">
                {buildProgress < 0 ? (
                  <div
                    className="h-full bg-[#0078D4] rounded-full"
                    style={{ width: '40%', animation: 'indeterminate-slide 1.4s ease-in-out infinite' }}
                  />
                ) : (
                  <div
                    className="h-full bg-[#0078D4] rounded-full transition-all duration-150"
                    style={{ width: `${buildProgress}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-[#696969] font-mono">
                {buildProgress < 0 ? 'Compiling...' : `${buildProgress}%`}
              </span>
            </div>

            <p className="text-[10px] text-[#696969] italic">
              {buildProgress === 100
                ? 'APK signed with debug key — ready for ADB deploy.'
                : 'Do not close window. Compilation & signing running.'}
            </p>

            <div className="flex items-center gap-2 mt-1">
              {/* Show Build Log button */}
              <button
                onClick={() => setIsBuildLogOpen(true)}
                className="bg-[#1F1F1F] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] px-4 py-1.5 rounded-[3px] text-xs font-medium transition-colors"
              >
                View Build Log
              </button>
              {buildProgress === 100 && (
                <button
                  onClick={() => setBuildProgress(-1)}
                  className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] px-4 py-1.5 rounded-[3px] text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Build Log Modal */}
      <BuildLogModal
        isOpen={isBuildLogOpen}
        onClose={() => setIsBuildLogOpen(false)}
        buildLog={buildLog}
        buildStatus={buildStatus}
        buildProgress={buildProgress}
      />

      {/* GitHub Skills Catalog Modal */}
      <SkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        onStatusMessage={setStatusMessage}
      />

      {/* MCP Servers Manager Modal */}
      <McpModal
        isOpen={isMcpModalOpen}
        onClose={() => setIsMcpModalOpen(false)}
        onStatusMessage={setStatusMessage}
      />

      {/* Draggable Desktop Settings Window */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        geminiApiKey={geminiApiKey}
        onGeminiApiKeyChange={setGeminiApiKey}
        decompilerType={decompilerType}
        onSelectDecompiler={setDecompilerType}
        compilerBackend={compilerBackend}
        onSelectCompilerBackend={setCompilerBackend}
        theme={editorTheme}
        onSelectTheme={setEditorTheme}
        onOpenSkillsModal={() => setIsSkillsModalOpen(true)}
        onOpenMcpModal={() => setIsMcpModalOpen(true)}
      />

      {/* Auto-Update Floating Notification Toast */}
      {showUpdateBanner && updateInfo && (
        <div className="fixed bottom-9 right-4 z-50 max-w-sm w-84 bg-[#181818] border border-[#2B2B2B] rounded-[6px] shadow-2xl p-3 flex flex-col gap-2.5 text-xs text-[#CCCCCC] select-none">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-white">
              {updateInfo.status === 'downloaded' ? (
                <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />
              ) : updateInfo.status === 'downloading' ? (
                <Download size={16} className="text-[#0078D4] shrink-0 animate-bounce" />
              ) : (
                <ArrowUpCircle size={16} className="text-[#0078D4] shrink-0" />
              )}
              <span className="truncate">
                {updateInfo.status === 'downloaded'
                  ? t('updater.ready', 'Update ready to install!')
                  : updateInfo.status === 'downloading'
                  ? `Downloading v${updateInfo.version || ''}...`
                  : t('updater.available', 'New update found')}
              </span>
            </div>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="text-[#696969] hover:text-white p-0.5 rounded transition-colors"
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>

          <div className="text-[11px] text-[#858585] leading-relaxed">
            {updateInfo.status === 'downloaded'
              ? `Release v${updateInfo.version || ''} is downloaded and verified. Restart to apply immediately.`
              : updateInfo.status === 'downloading'
              ? `Downloading package: ${updateInfo.percent || 0}% completed.`
              : `A new version (v${updateInfo.version || ''}) is available on GitHub Releases.`}
          </div>

          {updateInfo.status === 'downloading' && (
            <div className="w-full bg-[#252526] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#0078D4] h-full transition-all duration-150"
                style={{ width: `${Math.max(5, updateInfo.percent || 0)}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#252526]">
            {updateInfo.status === 'downloaded' ? (
              <>
                <button
                  onClick={() => setShowUpdateBanner(false)}
                  className="px-2.5 py-1 text-[11px] text-[#858585] hover:text-white transition-colors"
                >
                  {t('updater.later', 'Later')}
                </button>
                <button
                  onClick={handleUpdateAndRestart}
                  className="px-3 py-1 bg-[#0078D4] hover:bg-[#1084d8] text-white rounded-[3px] text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw size={11} className="animate-spin" />
                  <span>{t('updater.restart', 'Update & Restart')}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowUpdateBanner(false)}
                className="px-2.5 py-1 text-[11px] text-[#858585] hover:text-white transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
