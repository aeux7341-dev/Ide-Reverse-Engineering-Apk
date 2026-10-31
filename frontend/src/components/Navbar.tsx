import { useState, useRef, useEffect } from 'react';
import { 
  FolderOpen, FileCode, Save, LogOut, Search, Trash2, 
  Sidebar as SidebarIcon, Compass, Bot, Settings, Play, Info,
  CheckCircle, AlertCircle, File, FilePlus, AppWindow,
  Folder, Archive, Copy, Undo, X, Power, ChevronRight,
  Files, History, HardDriveDownload, Terminal as TerminalIcon,
  Smartphone, Maximize, Minimize, Minus, Square
} from 'lucide-react';
import { getRecentWorkspaces } from '../utils/workspaceStorage';

interface NavbarProps {
  workspacePath?: string | null;
  onOpenDirectory: () => void;
  onNewTextFile: () => void;
  onNewFile: () => void;
  onNewWindow: () => void;
  onOpenFile: () => void;
  onOpenWorkspaceFromFile: () => void;
  onOpenRecentWorkspace: (handle: FileSystemDirectoryHandle) => void;
  onClearRecentWorkspaces: () => void;
  onAddFolderToWorkspace: () => void;
  onSaveWorkspaceAs: () => void;
  onDuplicateWorkspace: () => void;
  onSaveActiveFile: () => void;
  onSaveFileAs: () => void;
  onSaveAll: () => void;
  autoSave?: boolean;
  onToggleAutoSave?: () => void;
  onPreferences: () => void;
  onRevertFile: () => void;
  onCloseEditor: () => void;
  onCloseWindow: () => void;
  onExit: () => void;
  onCloseWorkspace: () => void;
  onToggleSidebar: () => void;
  onSelectPanel: (panel: 'explorer' | 'ai' | 'settings' | 'modifier') => void;
  onTriggerDecompile: () => void;
  decompilerType: 'jadx' | 'apktool';
  onSelectDecompiler: (type: 'jadx' | 'apktool') => void;
  compilerBackend: 'aapt' | 'aapt2';
  onSelectCompilerBackend: (backend: 'aapt' | 'aapt2') => void;
  onBuildApk: () => void;
  isBuilding: boolean;
  onOpenCommandPalette: () => void;
  onClearChat: () => void;
  workspaceOpened: boolean;
  activeFileOpened: boolean;
  onToggleTerminal?: () => void;
  onOpenApkRunner?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  dirHandle?: FileSystemDirectoryHandle | null;
}

export default function Navbar({
  workspacePath,
  onOpenDirectory,
  onNewTextFile,
  onNewFile,
  onNewWindow,
  onOpenFile,
  onOpenWorkspaceFromFile,
  onOpenRecentWorkspace,
  onClearRecentWorkspaces,
  onAddFolderToWorkspace,
  onSaveWorkspaceAs,
  onDuplicateWorkspace,
  onSaveActiveFile,
  onSaveFileAs,
  onSaveAll,
  autoSave = true,
  onToggleAutoSave,
  onPreferences,
  onRevertFile,
  onCloseEditor,
  onCloseWindow,
  onExit,
  onCloseWorkspace,
  onToggleSidebar,
  onSelectPanel,
  onTriggerDecompile,
  decompilerType,
  onSelectDecompiler,
  compilerBackend,
  onSelectCompilerBackend,
  onBuildApk,
  isBuilding,
  onOpenCommandPalette,
  onClearChat,
  workspaceOpened,
  activeFileOpened,
  onToggleTerminal,
  onOpenApkRunner,
  onToggleFullscreen,
  isFullscreen = false,
  dirHandle,
}: NavbarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [recentList, setRecentList] = useState<Array<{ name: string; handle: FileSystemDirectoryHandle }>>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const navbarRef = useRef<HTMLDivElement>(null);
  // Track whether aapt2 is available on the server
  const [aapt2Available, setAapt2Available] = useState<boolean | null>(null);

  const electronAPI = (window as any).electronAPI;
  const isElectron = !!electronAPI;

  useEffect(() => {
    if (electronAPI?.isWindowMaximized) {
      electronAPI.isWindowMaximized().then((val: boolean) => setIsMaximized(!!val));
    }
    if (electronAPI?.onMaximizeChanged) {
      const unsub = electronAPI.onMaximizeChanged((val: boolean) => {
        setIsMaximized(!!val);
      });
      return () => unsub();
    }
  }, [electronAPI]);

  // Load recent workspaces when File menu opens
  useEffect(() => {
    if (activeMenu === 'file') {
      getRecentWorkspaces().then(setRecentList).catch(() => setRecentList([]));
    } else {
      setIsRecentOpen(false);
    }
  }, [activeMenu]);

  // Check tool availability once on mount
  useEffect(() => {
    fetch('/api/check-tools')
      .then(r => r.json())
      .then(data => setAapt2Available(!!data.aapt2_path))
      .catch(() => setAapt2Available(false));
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: string) => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  const handleMenuHover = (menu: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menu);
    }
  };

  const runActionAndClose = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  return (
    <header 
      ref={navbarRef}
      className="h-9 bg-[#181818] text-[#CCCCCC] flex items-center justify-between select-none text-xs z-40 relative titlebar-drag-region"
    >
      {/* Brand & Menus */}
      <div className="flex items-center gap-1 titlebar-no-drag pl-3">
        <div className="flex items-center gap-2 mr-2">
          <img src="/icon.svg" alt="ApkRtool" className="w-4 h-4 object-contain" />
        </div>

        {/* FILE MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('file')}
            onMouseEnter={() => handleMenuHover('file')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'file' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 mt-1 w-64 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              {/* 1. New Text File */}
              <button 
                onClick={() => runActionAndClose(onNewTextFile)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <File size={14} className="text-[#696969]" />
                  <span>New Text File</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+N</span>
              </button>

              {/* 2. New File ... */}
              <button 
                onClick={() => runActionAndClose(onNewFile)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <FilePlus size={14} className="text-[#696969]" />
                <span>New File ...</span>
              </button>

              {/* 3. New Window */}
              <button 
                onClick={() => runActionAndClose(onNewWindow)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <AppWindow size={14} className="text-[#696969]" />
                  <span>New Window</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+Shift+N</span>
              </button>

              <div className="h-[1px] bg-[#252526] my-1" />

              {/* 4. Open File ... */}
              <button 
                onClick={() => runActionAndClose(onOpenFile)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <FileCode size={14} className="text-[#696969]" />
                  <span>Open File ...</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+O</span>
              </button>

              {/* 5. Open Folder ... */}
              <button 
                onClick={() => runActionAndClose(onOpenDirectory)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen size={14} className="text-[#696969]" />
                  <span>Open Folder ...</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+K Ctrl+O</span>
              </button>

              {/* 6. Open Workspace from File ... */}
              <button 
                onClick={() => runActionAndClose(onOpenWorkspaceFromFile)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Archive size={14} className="text-[#696969]" />
                <span>Open Workspace from File ...</span>
              </button>

              {/* 7. Open Recent */}
              <div 
                className="relative"
                onMouseEnter={() => setIsRecentOpen(true)}
                onMouseLeave={() => setIsRecentOpen(false)}
              >
                <button 
                  onClick={() => setIsRecentOpen((p) => !p)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
                >
                  <span className="flex items-center gap-2">
                    <History size={14} className="text-[#696969]" />
                    <span>Open Recent</span>
                  </span>
                  <ChevronRight size={12} className="text-[#696969]" />
                </button>

                {isRecentOpen && (
                  <div className="absolute left-full top-0 ml-0.5 w-60 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
                    {recentList.length > 0 ? (
                      <>
                        {recentList.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => runActionAndClose(() => onOpenRecentWorkspace(item.handle))}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 truncate transition-colors duration-75"
                            title={item.name}
                          >
                            <Folder size={13} className="text-[#0078D4] flex-shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </button>
                        ))}
                        <div className="h-[1px] bg-[#252526] my-1" />
                        <button
                          onClick={() => {
                            onClearRecentWorkspaces();
                            setRecentList([]);
                            setIsRecentOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#252526] text-[#FFFFFF] flex items-center gap-2 text-[11px] transition-colors duration-75"
                        >
                          <Trash2 size={12} className="text-[#696969]" />
                          <span>Clear Recently Opened</span>
                        </button>
                      </>
                    ) : (
                      <div className="px-3 py-2 text-[#696969] italic text-[11px]">No Recent Workspaces</div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-[#252526] my-1" />

              {/* 8. Add Folder to Workspace ... */}
              <button 
                onClick={() => runActionAndClose(onAddFolderToWorkspace)}
                disabled={!workspaceOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <Folder size={14} className="text-[#696969]" />
                <span>Add Folder to Workspace ...</span>
              </button>

              {/* 9. Save Workspace As ... */}
              <button 
                onClick={() => runActionAndClose(onSaveWorkspaceAs)}
                disabled={!workspaceOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <HardDriveDownload size={14} className="text-[#696969]" />
                <span>Save Workspace As ...</span>
              </button>

              {/* 10. Duplicate Workspace */}
              <button 
                onClick={() => runActionAndClose(onDuplicateWorkspace)}
                disabled={!workspaceOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <Copy size={14} className="text-[#696969]" />
                <span>Duplicate Workspace</span>
              </button>

              <div className="h-[1px] bg-[#252526] my-1" />

              {/* 11. Save */}
              <button 
                onClick={() => runActionAndClose(onSaveActiveFile)}
                disabled={!activeFileOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <Save size={14} className="text-[#696969]" />
                  <span>Save</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+S</span>
              </button>

              {/* 12. Save As ... */}
              <button 
                onClick={() => runActionAndClose(onSaveFileAs)}
                disabled={!activeFileOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <Save size={14} className="text-[#696969]" />
                  <span>Save As ...</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+Shift+S</span>
              </button>

              {/* 13. Save All */}
              <button 
                onClick={() => runActionAndClose(onSaveAll)}
                disabled={!activeFileOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <Files size={14} className="text-[#696969]" />
                <span>Save All</span>
              </button>

              {/* Auto Save */}
              <button 
                onClick={() => {
                  if (onToggleAutoSave) onToggleAutoSave();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3.5 flex items-center justify-center text-[#0078D4] font-bold text-xs">
                    {autoSave ? '✓' : ''}
                  </span>
                  <span>Auto Save</span>
                </span>
                <span className="text-[10px] text-[#696969]">{autoSave ? 'ON' : 'OFF'}</span>
              </button>

              <div className="h-[1px] bg-[#252526] my-1" />

              {/* 14. Preferences */}
              <button 
                onClick={() => runActionAndClose(onPreferences)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <Settings size={14} className="text-[#696969]" />
                  <span>Preferences</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+,</span>
              </button>

              <div className="h-[1px] bg-[#252526] my-1" />

              {/* 15. Revert File */}
              <button 
                onClick={() => runActionAndClose(onRevertFile)}
                disabled={!activeFileOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <Undo size={14} className="text-[#696969]" />
                <span>Revert File</span>
              </button>

              {/* 16. Close Editor */}
              <button 
                onClick={() => runActionAndClose(onCloseEditor)}
                disabled={!activeFileOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <X size={14} className="text-[#696969]" />
                  <span>Close Editor</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+W</span>
              </button>

              {/* Close Workspace */}
              {workspaceOpened && (
                <button 
                  onClick={() => runActionAndClose(onCloseWorkspace)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#252526] text-[#FFFFFF] flex items-center gap-2 transition-colors duration-75"
                >
                  <LogOut size={14} className="text-[#696969]" />
                  <span>Close Workspace</span>
                </button>
              )}

              {/* 17. Close Window */}
              <button 
                onClick={() => runActionAndClose(onCloseWindow)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <LogOut size={14} className="text-[#696969]" />
                  <span>Close Window</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+Shift+W</span>
              </button>

              <div className="h-[1px] bg-[#252526] my-1" />

              {/* 18. Exit */}
              <button 
                onClick={() => runActionAndClose(onExit)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#252526] hover:text-white flex items-center justify-between gap-2 text-[#CCCCCC] transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <Power size={14} className="text-[#696969]" />
                  <span>Exit</span>
                </span>
                <span className="text-[10px] text-[#696969]">Alt+F4</span>
              </button>
            </div>
          )}
        </div>

        {/* EDIT MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('edit')}
            onMouseEnter={() => handleMenuHover('edit')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'edit' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute left-0 mt-1 w-56 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              <button 
                onClick={() => runActionAndClose(onOpenCommandPalette)}
                disabled={!workspaceOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 disabled:opacity-40 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <Search size={14} className="text-[#696969]" />
                  <span>Find File in Workspace</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+P</span>
              </button>
              <button 
                onClick={() => runActionAndClose(onClearChat)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Trash2 size={14} className="text-[#696969]" />
                <span>Clear AI Chat Log</span>
              </button>
            </div>
          )}
        </div>

        {/* VIEW MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('view')}
            onMouseEnter={() => handleMenuHover('view')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'view' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div className="absolute left-0 mt-1 w-56 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              <button 
                onClick={() => runActionAndClose(onToggleSidebar)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <SidebarIcon size={14} className="text-[#696969]" />
                  <span>Toggle Sidebar</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+B</span>
              </button>
              <div className="h-[1px] bg-[#252526] my-1" />
              <button 
                onClick={() => runActionAndClose(() => onSelectPanel('explorer'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Compass size={14} className="text-[#696969]" />
                <span>Explorer View</span>
              </button>
              <button 
                onClick={() => runActionAndClose(() => onSelectPanel('ai'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Bot size={14} className="text-[#696969]" />
                <span>AI Agent Chat</span>
              </button>
              <button 
                onClick={() => runActionAndClose(() => onSelectPanel('modifier'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Settings size={14} className="text-[#696969]" />
                <span>APK Modifier</span>
              </button>
              <button 
                onClick={() => runActionAndClose(() => onSelectPanel('settings'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Settings size={14} className="text-[#696969]" />
                <span>Settings</span>
              </button>
              <div className="h-[1px] bg-[#252526] my-1" />
              {onToggleTerminal && (
                <button 
                  onClick={() => runActionAndClose(onToggleTerminal)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
                >
                  <span className="flex items-center gap-2">
                    <TerminalIcon size={14} className="text-[#696969]" />
                    <span>Toggle Terminal</span>
                  </span>
                  <span className="text-[10px] text-[#696969]">Ctrl+`</span>
                </button>
              )}
              {onToggleFullscreen && (
                <button 
                  onClick={() => runActionAndClose(onToggleFullscreen)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
                >
                  <span className="flex items-center gap-2">
                    {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                    <span>{isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen'}</span>
                  </span>
                  <span className="text-[10px] text-[#696969]">F11</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* DECOMPILER MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('decompiler')}
            onMouseEnter={() => handleMenuHover('decompiler')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'decompiler' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            Decompiler
          </button>
          {activeMenu === 'decompiler' && (
            <div className="absolute left-0 mt-1 w-64 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              <button 
                onClick={() => runActionAndClose(onTriggerDecompile)}
                disabled={!workspaceOpened}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 text-[#0078D4] font-medium transition-colors duration-75"
              >
                <Play size={14} fill="currentColor" />
                <span>Decompile Android APK...</span>
              </button>
              <div className="h-[1px] bg-[#252526] my-1" />
              <button 
                onClick={() => runActionAndClose(() => onSelectDecompiler('apktool'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[#0078D4] font-bold">⚡</span>
                  <span>Apktool (Smali — Fast)</span>
                </span>
                {decompilerType === 'apktool' && <span className="text-[#0078D4] font-bold">✓</span>}
              </button>
              <button 
                onClick={() => runActionAndClose(() => onSelectDecompiler('jadx'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 opacity-75 transition-colors duration-75"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[#696969] font-bold">☕</span>
                  <span>JADX (Java — High Memory)</span>
                </span>
                {decompilerType === 'jadx' && <span className="text-[#0078D4] font-bold">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* BUILD MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('build')}
            onMouseEnter={() => handleMenuHover('build')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'build' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            Build
          </button>
          {activeMenu === 'build' && (
            <div className="absolute left-0 mt-1 w-64 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              <button 
                onClick={() => runActionAndClose(onBuildApk)}
                disabled={!workspaceOpened || isBuilding}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 disabled:opacity-40 text-[#0078D4] font-medium transition-colors duration-75"
              >
                <Play size={14} fill="currentColor" />
                <span>Build APK</span>
              </button>
              <div className="h-[1px] bg-[#252526] my-1" />
              <div className="px-3 py-1 text-[#696969] font-medium text-[10px] uppercase tracking-wider">Compiler Backend</div>
              <button 
                onClick={() => runActionAndClose(() => onSelectCompilerBackend('aapt'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-[#0078D4]" />
                  <span>AAPT <span className="text-[10px] text-[#696969]">(built-in)</span></span>
                </span>
                {compilerBackend === 'aapt' && <span className="text-[#0078D4] font-bold">✓</span>}
              </button>
              <button 
                onClick={() => {
                  if (!aapt2Available) {
                    alert('aapt2 tidak tersedia pada sistem lokal ini.\n\nGunakan opsi AAPT (bawaan) yang sudah tersedia.');
                    return;
                  }
                  runActionAndClose(() => onSelectCompilerBackend('aapt2'));
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  {aapt2Available === null
                    ? <span className="w-3 h-3 border-b-2 border-[#696969] animate-spin inline-block" />
                    : aapt2Available
                    ? <CheckCircle size={12} className="text-[#0078D4]" />
                    : <AlertCircle size={12} className="text-[#696969]" />
                  }
                  <span>
                    AAPT2
                    <span className="text-[10px] text-[#696969] ml-1">
                      {aapt2Available === null ? '(checking...)' : aapt2Available ? '(available)' : '(not installed)'}
                    </span>
                  </span>
                </span>
                {compilerBackend === 'aapt2' && <span className="text-[#0078D4] font-bold">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* TERMINAL MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('terminal')}
            onMouseEnter={() => handleMenuHover('terminal')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'terminal' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            Terminal
          </button>
          {activeMenu === 'terminal' && (
            <div className="absolute left-0 mt-1 w-64 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              <button 
                onClick={() => runActionAndClose(() => onToggleTerminal?.())}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <TerminalIcon size={14} className="text-[#696969]" />
                  <span>Toggle Terminal Panel</span>
                </span>
                <span className="text-[10px] text-[#696969]">Ctrl+`</span>
              </button>
              <button 
                onClick={() => runActionAndClose(() => onOpenApkRunner?.())}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center justify-between gap-2 transition-colors duration-75"
              >
                <span className="flex items-center gap-2">
                  <Smartphone size={14} className="text-[#0078D4]" />
                  <span>APK Tester Runner & Emulator</span>
                </span>
                <span className="text-[10px] text-[#696969]">ADB</span>
              </button>
            </div>
          )}
        </div>

        {/* HELP MENU */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('help')}
            onMouseEnter={() => handleMenuHover('help')}
            className={`px-2 py-1 rounded-[3px] transition-colors duration-100 hover:bg-[#2A2D2E] hover:text-white ${activeMenu === 'help' ? 'bg-[#2A2D2E] text-white' : 'text-[#CCCCCC]'}`}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 mt-1 w-56 bg-[#181818] rounded-[4px] shadow-2xl z-50 py-1 text-xs text-[#CCCCCC] context-menu-active">
              <button 
                onClick={() => runActionAndClose(() => alert('ApkRtool IDE: Native binary decompilation, bytecode editing, and ADB deployment.'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Info size={14} className="text-[#696969]" />
                <span>Quick Tour</span>
              </button>
              <button 
                onClick={() => runActionAndClose(() => alert('ApkRtool IDE v0.2.0\nReverse Engineering Platform.'))}
                className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
              >
                <Info size={14} className="text-[#696969]" />
                <span>About ApkRtool IDE</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Window Title (Draggable) */}
      <div className="absolute left-1/2 -translate-x-1/2 text-xs text-[#858585] font-normal pointer-events-none hidden md:flex items-center gap-2 max-w-[45%] truncate">
        <span className="truncate">
          {workspacePath
            ? `${workspacePath.split(/[\\/]/).pop()} — ApkRtool IDE`
            : dirHandle
            ? `${dirHandle.name} — ApkRtool IDE`
            : 'ApkRtool IDE — Android Reverse Engineering'}
        </span>
      </div>

      {/* Right Side: Active Workspace Indicator, Build Action & Window Controls */}
      <div className="flex items-center h-full titlebar-no-drag">
        <div className="flex items-center gap-2 mr-2">
          <button
            onClick={onBuildApk}
            disabled={!workspaceOpened || isBuilding}
            className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] px-2.5 py-1 rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors duration-100 disabled:opacity-40"
          >
            {isBuilding ? (
              <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full" />
            ) : (
              <Play size={11} fill="currentColor" />
            )}
            <span>Build APK</span>
          </button>
          <div className="text-[10px] text-[#696969] font-mono hidden xl:block">
            {workspaceOpened ? 'WORKSPACE' : 'STANDALONE'}
          </div>
        </div>

        {/* Antigravity / Windows Custom Window Controls */}
        {isElectron && (
          <div className="flex items-center h-full ml-1">
            <button
              onClick={() => electronAPI?.minimizeWindow?.()}
              className="h-9 w-11 flex items-center justify-center text-[#CCCCCC] hover:bg-[#252526] hover:text-[#FFFFFF] transition-colors duration-75"
              title="Minimize"
            >
              <Minus size={13} />
            </button>

            <button
              onClick={() => electronAPI?.maximizeWindow?.()}
              className="h-9 w-11 flex items-center justify-center text-[#CCCCCC] hover:bg-[#252526] hover:text-[#FFFFFF] transition-colors duration-75"
              title={isMaximized ? 'Restore Down' : 'Maximize'}
            >
              {isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M2.5 2.5V1h6.5v6.5H7.5" />
                  <rect x="1" y="2.5" width="6.5" height="6.5" />
                </svg>
              ) : (
                <Square size={10} />
              )}
            </button>

            <button
              onClick={() => electronAPI?.closeWindow?.() || onCloseWindow?.()}
              className="h-9 w-11 flex items-center justify-center text-[#CCCCCC] hover:bg-[#E81123] hover:text-[#FFFFFF] transition-colors duration-75"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
