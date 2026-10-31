import { useState, useEffect, useRef, MouseEvent } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Code,
  Settings,
  Image,
  Trash2,
  Edit,
  Plus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Upload,
  RefreshCw,
  Copy,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// expandedPaths — module-level Map that persists expanded state across
// re-renders AND across refreshTrigger increments. Key = nodePath string.
// ---------------------------------------------------------------------------
const expandedPaths = new Map<string, boolean>();

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodePath: string;
  name: string;
  isDir: boolean;
  handle?: FileSystemHandle;
}

interface FileTreeProps {
  dirHandle: FileSystemDirectoryHandle;
  currentPath: string;
  workspacePath?: string | null;
  onFileClick: (path: string, handle: FileSystemFileHandle) => void;
  onRefreshTrigger: number;
  onCreateFile: (parentPath: string, name: string) => Promise<void>;
  onCreateFolder: (parentPath: string, name: string) => Promise<void>;
  onDeleteEntry: (path: string) => Promise<void>;
  onRenameEntry: (oldPath: string, newName: string) => Promise<void>;
  onReplaceFile: (
    filePath: string,
    fileHandle: FileSystemFileHandle
  ) => Promise<void>;
  onImportFile: (parentPath: string) => Promise<void>;
}

export default function FileTree({
  dirHandle,
  currentPath,
  workspacePath,
  onFileClick,
  onRefreshTrigger,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onRenameEntry,
  onReplaceFile,
  onImportFile,
}: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    nodePath: '',
    name: '',
    isDir: true,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on any outside click or escape key
  useEffect(() => {
    const handleClose = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenContextMenu = (
    e: MouseEvent,
    nodePath: string,
    name: string,
    isDir: boolean,
    handle?: FileSystemHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodePath,
      name,
      isDir,
      handle,
    });
  };

  const handleEmptyContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodePath: '',
      name: dirHandle.name,
      isDir: true,
      handle: dirHandle,
    });
  };

  // Context Menu Action Handlers
  const handleMenuNewFile = async () => {
    const parentPath = contextMenu.isDir
      ? contextMenu.nodePath
      : contextMenu.nodePath.split('/').slice(0, -1).join('/');
    setContextMenu((p) => ({ ...p, visible: false }));
    const filename = prompt('New file name:');
    if (!filename) return;
    await onCreateFile(parentPath, filename);
    if (parentPath) expandedPaths.set(parentPath, true);
  };

  const handleMenuNewFolder = async () => {
    const parentPath = contextMenu.isDir
      ? contextMenu.nodePath
      : contextMenu.nodePath.split('/').slice(0, -1).join('/');
    setContextMenu((p) => ({ ...p, visible: false }));
    const foldername = prompt('New folder name:');
    if (!foldername) return;
    await onCreateFolder(parentPath, foldername);
    if (parentPath) expandedPaths.set(parentPath, true);
  };

  const handleMenuReveal = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.showItemInFolder && workspacePath) {
      const fullPath = contextMenu.nodePath
        ? `${workspacePath}\\${contextMenu.nodePath.replace(/\//g, '\\')}`
        : workspacePath;
      await electronAPI.showItemInFolder(fullPath);
    }
  };

  const handleMenuCopyPath = () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    const fullPath = contextMenu.nodePath
      ? workspacePath
        ? `${workspacePath}\\${contextMenu.nodePath.replace(/\//g, '\\')}`
        : contextMenu.nodePath
      : workspacePath || dirHandle.name;
    navigator.clipboard.writeText(fullPath);
  };

  const handleMenuCopyRelativePath = () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    navigator.clipboard.writeText(contextMenu.nodePath || '.');
  };

  const handleMenuRename = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    if (!contextMenu.nodePath) return;
    const newName = prompt('Rename to:', contextMenu.name);
    if (newName && newName !== contextMenu.name) {
      await onRenameEntry(contextMenu.nodePath, newName);
    }
  };

  const handleMenuDelete = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    if (!contextMenu.nodePath) return;
    if (
      confirm(`Delete "${contextMenu.name}"? This action cannot be undone.`)
    ) {
      await onDeleteEntry(contextMenu.nodePath);
    }
  };

  const handleMenuOpenFile = () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    if (!contextMenu.isDir && contextMenu.handle) {
      onFileClick(
        contextMenu.nodePath,
        contextMenu.handle as FileSystemFileHandle
      );
    }
  };

  const handleMenuReplaceFile = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    if (!contextMenu.isDir && contextMenu.handle) {
      await onReplaceFile(
        contextMenu.nodePath,
        contextMenu.handle as FileSystemFileHandle
      );
    }
  };

  const handleMenuImportFile = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    await onImportFile(contextMenu.nodePath);
  };

  useEffect(() => {
    expandedPaths.set('', true);
  }, [dirHandle]);

  return (
    <div
      onContextMenu={handleEmptyContextMenu}
      className="flex flex-col text-xs text-editor-textMuted select-none w-full min-h-full"
    >
      <FileTreeNode
        key={`${(dirHandle as any).path || dirHandle.name}`}
        handle={dirHandle}
        name={dirHandle.name}
        currentPath={currentPath}
        onFileClick={onFileClick}
        onRefreshTrigger={onRefreshTrigger}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteEntry={onDeleteEntry}
        onRenameEntry={onRenameEntry}
        onReplaceFile={onReplaceFile}
        onImportFile={onImportFile}
        onOpenContextMenu={handleOpenContextMenu}
        isRoot={true}
      />

      {/* Floating VS Code Dark Context Menu */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 310)}px`,
          }}
          className="fixed z-50 w-52 bg-[#181818] shadow-2xl rounded-[4px] py-1 text-xs font-sans select-none text-[#CCCCCC] shadow-black/80"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isDir ? (
            <>
              <button
                onClick={handleMenuNewFile}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus size={13} />
                  <span>New File...</span>
                </div>
              </button>

              <button
                onClick={handleMenuNewFolder}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderPlus size={13} />
                  <span>New Folder...</span>
                </div>
              </button>

              <button
                onClick={handleMenuImportFile}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Upload size={13} />
                  <span>Import File...</span>
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleMenuOpenFile}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <File size={13} />
                  <span>Open File</span>
                </div>
              </button>

              <button
                onClick={handleMenuReplaceFile}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw size={13} />
                  <span>Replace File...</span>
                </div>
              </button>
            </>
          )}

          <div className="h-[1px] bg-[#2B2B2B] my-1" />

          {/* Reveal in Explorer (if Electron) */}
          {(window as any).electronAPI?.showItemInFolder && (
            <button
              onClick={handleMenuReveal}
              className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderOpen size={13} />
                <span>Reveal in File Explorer</span>
              </div>
              <span className="text-[10px] text-[#696969] font-mono">
                Alt+R
              </span>
            </button>
          )}

          {/* Copy Path */}
          <button
            onClick={handleMenuCopyPath}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} />
              <span>Copy Path</span>
            </div>
          </button>

          {/* Copy Relative Path */}
          <button
            onClick={handleMenuCopyRelativePath}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} />
              <span>Copy Relative Path</span>
            </div>
          </button>

          {/* Rename & Delete for non-root */}
          {contextMenu.nodePath && (
            <>
              <div className="h-[1px] bg-[#2B2B2B] my-1" />

              <button
                onClick={handleMenuRename}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Edit size={13} />
                  <span>Rename...</span>
                </div>
                <span className="text-[10px] text-[#696969] font-mono">F2</span>
              </button>

              <button
                onClick={handleMenuDelete}
                className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trash2 size={13} />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] text-[#696969] font-mono">Del</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface TreeNodeProps {
  handle: FileSystemHandle;
  name: string;
  currentPath: string;
  onFileClick: (path: string, handle: FileSystemFileHandle) => void;
  onRefreshTrigger: number;
  onCreateFile: (parentPath: string, name: string) => Promise<void>;
  onCreateFolder: (parentPath: string, name: string) => Promise<void>;
  onDeleteEntry: (path: string) => Promise<void>;
  onRenameEntry: (oldPath: string, newName: string) => Promise<void>;
  onReplaceFile: (
    filePath: string,
    fileHandle: FileSystemFileHandle
  ) => Promise<void>;
  onImportFile: (parentPath: string) => Promise<void>;
  onOpenContextMenu: (
    e: MouseEvent,
    nodePath: string,
    name: string,
    isDir: boolean,
    handle?: FileSystemHandle
  ) => void;
  isRoot?: boolean;
}

function FileTreeNode({
  handle,
  name,
  currentPath,
  onFileClick,
  onRefreshTrigger,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onRenameEntry,
  onReplaceFile,
  onImportFile,
  onOpenContextMenu,
  isRoot = false,
}: TreeNodeProps) {
  const nodePath = isRoot ? '' : currentPath ? `${currentPath}/${name}` : name;

  const getInitialExpanded = () => {
    if (expandedPaths.has(nodePath)) return expandedPaths.get(nodePath)!;
    return isRoot;
  };

  const [isExpanded, setIsExpandedRaw] = useState<boolean>(getInitialExpanded);
  const setIsExpanded = (val: boolean) => {
    expandedPaths.set(nodePath, val);
    setIsExpandedRaw(val);
  };

  const [children, setChildren] = useState<FileSystemHandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const hasLoadedRef = useRef(false);

  const loadChildren = async (isInitial = false) => {
    if (handle.kind !== 'directory') return;
    if (isInitial || !hasLoadedRef.current) {
      setLoading(true);
    }
    try {
      const dir = handle as FileSystemDirectoryHandle;
      const entries: FileSystemHandle[] = [];
      for await (const entry of (dir as any).values()) {
        entries.push(entry);
      }
      entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setChildren(entries);
      hasLoadedRef.current = true;
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        expandedPaths.delete(nodePath);
        setChildren([]);
      } else {
        console.error('Failed to load dir content:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && handle.kind === 'directory' && !hasLoadedRef.current) {
      loadChildren(true);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded && handle.kind === 'directory') {
      loadChildren(false);
    }
  }, [onRefreshTrigger]);

  const handleToggle = async (e: MouseEvent) => {
    e.stopPropagation();
    if (handle.kind === 'directory') {
      const next = !isExpanded;
      setIsExpanded(next);
      if (next) await loadChildren(true);
    } else {
      onFileClick(nodePath, handle as FileSystemFileHandle);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    onOpenContextMenu(e, nodePath, name, handle.kind === 'directory', handle);
  };

  const handleReplaceFile = async (e: MouseEvent) => {
    e.stopPropagation();
    await onReplaceFile(nodePath, handle as FileSystemFileHandle);
  };

  const handleImportFile = async (e: MouseEvent) => {
    e.stopPropagation();
    await onImportFile(nodePath);
  };

  const handleCreateFile = async (e: MouseEvent) => {
    e.stopPropagation();
    const filename = prompt('New file name:');
    if (!filename) return;
    await onCreateFile(nodePath, filename);
    setIsExpanded(true);
  };

  const handleCreateFolder = async (e: MouseEvent) => {
    e.stopPropagation();
    const foldername = prompt('New folder name:');
    if (!foldername) return;
    await onCreateFolder(nodePath, foldername);
    setIsExpanded(true);
  };

  const handleRename = async (e: MouseEvent) => {
    e.stopPropagation();
    const newName = prompt('Rename to:', name);
    if (newName && newName !== name) await onRenameEntry(nodePath, newName);
  };

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${name}"? This cannot be undone.`))
      await onDeleteEntry(nodePath);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (fileName === 'AndroidManifest.xml')
      return <Code className="text-orange-400" size={14} />;
    switch (ext) {
      case 'java':
        return <Code className="text-blue-400" size={14} />;
      case 'kt':
        return <Code className="text-purple-400" size={14} />;
      case 'smali':
        return <Code className="text-green-400" size={14} />;
      case 'xml':
        return <FileText className="text-yellow-500" size={14} />;
      case 'json':
        return <FileText className="text-yellow-300" size={14} />;
      case 'dex':
        return <Settings className="text-purple-400" size={14} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'ico':
        return <Image className="text-emerald-400" size={14} />;
      default:
        return <File className="text-gray-400" size={14} />;
    }
  };

  return (
    <div className="w-full">
      <div
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
        className={`group flex items-center justify-between px-2 py-1 cursor-pointer transition-colors duration-75 hover:bg-[#2A2D2E] ${
          isRoot
            ? 'font-medium text-[#FFFFFF] bg-[#181818]'
            : ''
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
          {handle.kind === 'directory' ? (
            <>
              <span className="text-[#696969] flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </span>
              <span className="text-amber-400 flex-shrink-0">
                {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
              </span>
            </>
          ) : (
            <span className="pl-3 flex-shrink-0">{getFileIcon(name)}</span>
          )}
          <span className="truncate text-[#CCCCCC] select-none text-xs">
            {name}
          </span>
        </div>

        {showOptions && (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1 bg-[#181818] rounded-[3px] px-0.5">
            {handle.kind === 'directory' && (
              <>
                <button
                  onClick={handleCreateFile}
                  title="New File"
                  className="p-0.5 hover:text-[#0078D4] rounded-[2px] hover:bg-[#252526]"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={handleCreateFolder}
                  title="New Folder"
                  className="p-0.5 hover:text-[#0078D4] rounded-[2px] hover:bg-[#252526]"
                >
                  <FolderPlus size={12} />
                </button>
                <button
                  onClick={handleImportFile}
                  title="Import File"
                  className="p-0.5 hover:text-[#0078D4] rounded-[2px] hover:bg-[#252526]"
                >
                  <Upload size={12} />
                </button>
              </>
            )}
            {!isRoot && (
              <>
                {handle.kind === 'file' && (
                  <button
                    onClick={handleReplaceFile}
                    title="Replace File"
                    className="p-0.5 hover:text-[#0078D4] rounded-[2px] hover:bg-[#252526]"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
                <button
                  onClick={handleRename}
                  title="Rename"
                  className="p-0.5 hover:text-[#0078D4] rounded-[2px] hover:bg-[#252526]"
                >
                  <Edit size={12} />
                </button>
                <button
                  onClick={handleDelete}
                  title="Delete"
                  className="p-0.5 hover:text-red-400 rounded-[2px] hover:bg-[#252526]"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {handle.kind === 'directory' && isExpanded && (
        <div className="pl-3 ml-3.5 my-0.5 flex flex-col">
          {loading ? (
            <div className="py-1 px-3 text-[10px] italic text-[#696969] flex items-center gap-1.5">
              <RefreshCw size={10} className="animate-spin" /> Loading…
            </div>
          ) : children.length === 0 ? (
            isRoot ? (
              <div className="py-2 px-3 flex flex-col gap-1.5 text-[11px] text-[#696969]">
                <span className="italic">Empty workspace folder</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    onClick={handleCreateFile}
                    className="px-2 py-0.5 bg-[#242424] hover:bg-[#2F2F2F] text-[#CCCCCC] hover:text-[#FFFFFF] transition-colors rounded-[2px] text-[10px] font-medium cursor-pointer"
                  >
                    + New File
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    className="px-2 py-0.5 bg-[#242424] hover:bg-[#2F2F2F] text-[#CCCCCC] hover:text-[#FFFFFF] transition-colors rounded-[2px] text-[10px] font-medium cursor-pointer"
                  >
                    + New Folder
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-1 px-3 text-[10px] italic text-[#696969]">
                Empty directory
              </div>
            )
          ) : (
            children.map((child) => (
              <FileTreeNode
                key={`${nodePath}/${child.name}`}
                handle={child}
                name={child.name}
                currentPath={nodePath}
                onFileClick={onFileClick}
                onRefreshTrigger={onRefreshTrigger}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onDeleteEntry={onDeleteEntry}
                onRenameEntry={onRenameEntry}
                onReplaceFile={onReplaceFile}
                onImportFile={onImportFile}
                onOpenContextMenu={onOpenContextMenu}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
