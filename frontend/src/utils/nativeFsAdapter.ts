/**
 * Native Filesystem Adapter for Electron
 * Implements W3C FileSystemDirectoryHandle and FileSystemFileHandle interfaces
 * backed directly by Electron's native Node.js fs APIs over IPC.
 *
 * This provides 100% reliable workspace persistence without Chromium permission prompts
 * across application restarts, matching VS Code and ApkRtool IDE behavior.
 */

function joinPath(base: string, child: string): string {
  const b = base.replace(/[\\/]+$/, '');
  const c = child.replace(/^[\\/]+/, '');
  if (base.includes('\\')) {
    return `${b}\\${c.replace(/\//g, '\\')}`;
  }
  return `${b}/${c}`;
}

export class NativeWritableStream {
  private path: string;
  private chunks: (Uint8Array | string)[] = [];

  constructor(filePath: string) {
    this.path = filePath;
  }

  async write(data: any): Promise<void> {
    if (typeof data === 'string') {
      this.chunks.push(data);
    } else if (data instanceof ArrayBuffer) {
      this.chunks.push(new Uint8Array(data));
    } else if (data instanceof Uint8Array) {
      this.chunks.push(data);
    } else if (data && typeof data.arrayBuffer === 'function') {
      this.chunks.push(new Uint8Array(await data.arrayBuffer()));
    } else {
      this.chunks.push(String(data));
    }
  }

  async close(): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.fsWriteFile) {
      throw new Error('Native filesystem API not available');
    }

    if (this.chunks.length === 0) {
      await electronAPI.fsWriteFile(this.path, '');
      return;
    }

    const allStrings = this.chunks.every((c) => typeof c === 'string');
    if (allStrings) {
      await electronAPI.fsWriteFile(this.path, this.chunks.join(''));
      return;
    }

    let totalLength = 0;
    const byteChunks: Uint8Array[] = this.chunks.map((c) => {
      if (typeof c === 'string') {
        return new TextEncoder().encode(c);
      }
      return c;
    });
    for (const b of byteChunks) totalLength += b.length;

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of byteChunks) {
      merged.set(b, offset);
      offset += b.length;
    }
    await electronAPI.fsWriteFile(this.path, merged);
  }

  async abort(): Promise<void> {
    this.chunks = [];
  }
}

export class NativeFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  readonly path: string;

  constructor(filePath: string) {
    this.path = filePath;
    this.name = filePath.split(/[\\/]/).filter(Boolean).pop() || filePath;
  }

  async getFile(): Promise<File> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.fsReadFile) {
      throw new Error('Native filesystem API not available');
    }

    const bytes: Uint8Array = await electronAPI.fsReadFile(this.path);
    const stat = await electronAPI.fsStat(this.path);
    const file = new File([bytes as any], this.name, {
      lastModified: stat?.mtimeMs || Date.now(),
    });

    Object.defineProperty(file, 'path', {
      value: this.path,
      writable: false,
    });

    return file;
  }

  async createWritable(_options?: any): Promise<NativeWritableStream> {
    return new NativeWritableStream(this.path);
  }

  async move(newParentOrName: any, newName?: string): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    let targetPath = '';
    if (typeof newParentOrName === 'string') {
      const parent = this.path.substring(0, Math.max(this.path.lastIndexOf('/'), this.path.lastIndexOf('\\')));
      targetPath = joinPath(parent, newParentOrName);
    } else if (newParentOrName && newParentOrName.path) {
      targetPath = joinPath(newParentOrName.path, newName || this.name);
    } else {
      throw new Error('Invalid move target');
    }
    if (electronAPI?.fsRename) {
      await electronAPI.fsRename(this.path, targetPath);
      (this as any).path = targetPath;
      (this as any).name = targetPath.split(/[\\/]/).filter(Boolean).pop() || targetPath;
    }
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async isSameEntry(other: any): Promise<boolean> {
    if (!other || !other.path || typeof other.path !== 'string') return false;
    const norm = (p: string) => p.replace(/[\\/]+/g, '/').toLowerCase();
    return norm(other.path) === norm(this.path);
  }
}

export class NativeDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  readonly path: string;

  constructor(dirPath: string) {
    this.path = dirPath;
    this.name = dirPath.split(/[\\/]/).filter(Boolean).pop() || dirPath;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<NativeDirectoryHandle> {
    const electronAPI = (window as any).electronAPI;
    const subPath = joinPath(this.path, name);
    const exists = await electronAPI.fsExists(subPath);

    if (!exists) {
      if (options?.create) {
        await electronAPI.fsMkdir(subPath);
      } else {
        const err = new Error(`A requested file or directory could not be found at "${subPath}".`);
        err.name = 'NotFoundError';
        throw err;
      }
    } else {
      const stat = await electronAPI.fsStat(subPath);
      if (stat && !stat.isDirectory) {
        const err = new Error(`TypeMismatchError: "${subPath}" is not a directory.`);
        err.name = 'TypeMismatchError';
        throw err;
      }
    }
    return new NativeDirectoryHandle(subPath);
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<NativeFileHandle> {
    const electronAPI = (window as any).electronAPI;
    const subPath = joinPath(this.path, name);
    const exists = await electronAPI.fsExists(subPath);

    if (!exists) {
      if (options?.create) {
        await electronAPI.fsWriteFile(subPath, '');
      } else {
        const err = new Error(`A requested file or directory could not be found at "${subPath}".`);
        err.name = 'NotFoundError';
        throw err;
      }
    } else {
      const stat = await electronAPI.fsStat(subPath);
      if (stat && !stat.isFile) {
        const err = new Error(`TypeMismatchError: "${subPath}" is not a file.`);
        err.name = 'TypeMismatchError';
        throw err;
      }
    }
    return new NativeFileHandle(subPath);
  }

  async move(newParentOrName: any, newName?: string): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    let targetPath = '';
    if (typeof newParentOrName === 'string') {
      const parent = this.path.substring(0, Math.max(this.path.lastIndexOf('/'), this.path.lastIndexOf('\\')));
      targetPath = joinPath(parent, newParentOrName);
    } else if (newParentOrName && newParentOrName.path) {
      targetPath = joinPath(newParentOrName.path, newName || this.name);
    } else {
      throw new Error('Invalid move target');
    }
    if (electronAPI?.fsRename) {
      await electronAPI.fsRename(this.path, targetPath);
      (this as any).path = targetPath;
      (this as any).name = targetPath.split(/[\\/]/).filter(Boolean).pop() || targetPath;
    }
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    const subPath = joinPath(this.path, name);
    const exists = await electronAPI.fsExists(subPath);
    if (!exists) {
      const err = new Error(`Entry "${name}" not found.`);
      err.name = 'NotFoundError';
      throw err;
    }
    await electronAPI.fsRemove(subPath, { recursive: !!options?.recursive });
  }

  async *values(): AsyncIterableIterator<NativeDirectoryHandle | NativeFileHandle> {
    const electronAPI = (window as any).electronAPI;
    const entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }> =
      await electronAPI.fsReaddir(this.path);

    for (const item of entries) {
      const fullPath = joinPath(this.path, item.name);
      if (item.isDirectory) {
        yield new NativeDirectoryHandle(fullPath);
      } else {
        yield new NativeFileHandle(fullPath);
      }
    }
  }

  async *entries(): AsyncIterableIterator<[string, NativeDirectoryHandle | NativeFileHandle]> {
    for await (const val of this.values()) {
      yield [val.name, val];
    }
  }

  [Symbol.asyncIterator]() {
    return this.values();
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async isSameEntry(other: any): Promise<boolean> {
    if (!other || !other.path || typeof other.path !== 'string') return false;
    const norm = (p: string) => p.replace(/[\\/]+/g, '/').toLowerCase();
    return norm(other.path) === norm(this.path);
  }
}

export function createNativeDirectoryHandle(dirPath: string): NativeDirectoryHandle {
  return new NativeDirectoryHandle(dirPath);
}

export function isNativeDirectoryHandle(handle: any): handle is NativeDirectoryHandle {
  return handle instanceof NativeDirectoryHandle || (handle && handle.kind === 'directory' && typeof handle.path === 'string');
}
