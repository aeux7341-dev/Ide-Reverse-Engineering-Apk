/**
 * Helper utilities for recursive operations on the Browser File System Access API (FileSystemDirectoryHandle)
 */

/**
 * Creates directories recursively for a given relative path (e.g. "sources/com/example/app")
 */
export async function createDirectoryRecursive(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<FileSystemDirectoryHandle> {
  const parts = relativePath.split('/').filter(Boolean);
  let currentHandle = rootHandle;
  
  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }
  
  return currentHandle;
}

/**
 * Retrieves a FileSystemFileHandle for a nested path, creating it and parent directories if requested.
 */
export async function getFileHandleRecursive(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  options: { create?: boolean } = {}
): Promise<FileSystemFileHandle> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  
  if (!fileName) {
    throw new Error('Invalid path: no file name found.');
  }
  
  let currentHandle = rootHandle;
  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: options.create });
  }
  
  return await currentHandle.getFileHandle(fileName, options);
}

/**
 * Traverses a DirectoryHandle recursively to collect a flat list of files (used for fuzzy search in Command Palette)
 */
export async function crawlDirectory(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = ''
): Promise<Array<{ path: string; handle: FileSystemFileHandle }>> {
  let results: Array<{ path: string; handle: FileSystemFileHandle }> = [];
  
  for await (const entry of (dirHandle as any).values()) {
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      results.push({ path: relativePath, handle: entry as FileSystemFileHandle });
    } else if (entry.kind === 'directory') {
      const subResults = await crawlDirectory(entry as FileSystemDirectoryHandle, relativePath);
      results = results.concat(subResults);
    }
  }
  
  return results;
}

/**
 * Deletes a file or directory at a nested path
 */
export async function deleteEntryRecursive(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean);
  const entryName = parts.pop();
  
  if (!entryName) {
    throw new Error('Invalid delete path.');
  }
  
  let currentHandle = rootHandle;
  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: false });
  }
  
  await currentHandle.removeEntry(entryName, { recursive: true });
}

/**
 * Recursively copies all entries from a source directory handle into a destination directory handle.
 */
export async function copyDirectoryRecursive(
  srcHandle: FileSystemDirectoryHandle,
  dstHandle: FileSystemDirectoryHandle
): Promise<void> {
  for await (const entry of (srcHandle as any).values()) {
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile();
      const data = await file.arrayBuffer();
      const targetFile = await dstHandle.getFileHandle(entry.name, { create: true });
      const writable = await targetFile.createWritable();
      await writable.write(data);
      await writable.close();
    } else if (entry.kind === 'directory') {
      const targetSubDir = await dstHandle.getDirectoryHandle(entry.name, { create: true });
      await copyDirectoryRecursive(entry as FileSystemDirectoryHandle, targetSubDir);
    }
  }
}

/**
 * Renames an entry (file or folder).
 * Supports Electron atomic fsRename, W3C handle.move, and recursive copy-then-delete fallback.
 */
export async function renameEntry(
  rootHandle: FileSystemDirectoryHandle,
  oldPath: string,
  newPath: string
): Promise<void> {
  const electronAPI = (window as any).electronAPI;
  const rootNativePath = (rootHandle as any).path;

  // 1. Electron Native atomic rename
  if (electronAPI?.fsRename && rootNativePath) {
    const sep = rootNativePath.includes('\\') ? '\\' : '/';
    const oldFull = `${rootNativePath.replace(/[\\/]+$/, '')}${sep}${oldPath.split('/').join(sep)}`;
    const newFull = `${rootNativePath.replace(/[\\/]+$/, '')}${sep}${newPath.split('/').join(sep)}`;
    await electronAPI.fsRename(oldFull, newFull);
    return;
  }

  // 2. Browser File System Access API
  const oldParts = oldPath.split('/').filter(Boolean);
  const oldName = oldParts.pop();
  if (!oldName) throw new Error('Invalid old path');

  let oldParentHandle = rootHandle;
  for (const part of oldParts) {
    oldParentHandle = await oldParentHandle.getDirectoryHandle(part, { create: false });
  }

  const newParts = newPath.split('/').filter(Boolean);
  const newName = newParts.pop();
  if (!newName) throw new Error('Invalid new path');

  let newParentHandle = rootHandle;
  for (const part of newParts) {
    newParentHandle = await newParentHandle.getDirectoryHandle(part, { create: true });
  }

  // Check if old entry is a file or a directory
  let isDirectory = false;
  let fileHandle: FileSystemFileHandle | null = null;
  try {
    fileHandle = await oldParentHandle.getFileHandle(oldName, { create: false });
  } catch {
    isDirectory = true;
  }

  if (!isDirectory && fileHandle) {
    if (typeof (fileHandle as any).move === 'function') {
      await (fileHandle as any).move(newParentHandle, newName);
      return;
    }
    const file = await fileHandle.getFile();
    const data = await file.arrayBuffer();
    const newFileHandle = await newParentHandle.getFileHandle(newName, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    await oldParentHandle.removeEntry(oldName);
    return;
  }

  // Directory handling
  const dirHandle = await oldParentHandle.getDirectoryHandle(oldName, { create: false });
  if (typeof (dirHandle as any).move === 'function') {
    await (dirHandle as any).move(newParentHandle, newName);
    return;
  }

  const targetDirHandle = await newParentHandle.getDirectoryHandle(newName, { create: true });
  await copyDirectoryRecursive(dirHandle, targetDirHandle);
  await oldParentHandle.removeEntry(oldName, { recursive: true });
}
