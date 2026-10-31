import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Ban,
  Columns2,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  X,
  AlertTriangle,
} from 'lucide-react';
import TerminalPanel, {
  TerminalTabMeta,
  TerminalPanelRef,
} from './TerminalPanel';
import ApkTesterRunner from './ApkTesterRunner';

export type BottomTabType =
  | 'problems'
  | 'output'
  | 'debug'
  | 'terminal'
  | 'apk-runner';

interface BottomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: BottomTabType;
  onSelectTab: (tab: BottomTabType) => void;
  workspacePath?: string | null;
  dirHandle: FileSystemDirectoryHandle | null;
  buildLog?: string[];
  onStatusMessage?: (msg: string) => void;
}

export default function BottomPanel({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  workspacePath,
  dirHandle,
  buildLog = [],
  onStatusMessage,
}: BottomPanelProps) {
  const [panelHeight, setPanelHeight] = useState<number>(280);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(280);

  // Terminal state synchronization
  const [terminalTabs, setTerminalTabs] = useState<TerminalTabMeta[]>([
    { id: 'term-1', name: '1: pwsh', shellType: 'powershell' },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('term-1');
  const [showSwitchDropdown, setShowSwitchDropdown] = useState<boolean>(false);
  const [showNewShellDropdown, setShowNewShellDropdown] =
    useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);

  const terminalRef = useRef<TerminalPanelRef>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setShowSwitchDropdown(false);
      setShowNewShellDropdown(false);
      setShowMoreMenu(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Resize drag handle
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - moveEvent.clientY;
      const newHeight = Math.max(
        140,
        Math.min(window.innerHeight - 100, startHeightRef.current + delta)
      );
      setPanelHeight(newHeight);
      setIsMaximized(false);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleToggleMaximize = () => {
    setIsMaximized((p) => !p);
  };

  if (!isOpen) return null;

  const activeTabMeta =
    terminalTabs.find((t) => t.id === activeTerminalId) || terminalTabs[0];

  return (
    <div
      style={{
        height: isMaximized ? 'calc(100vh - 75px)' : `${panelHeight}px`,
      }}
      className="w-full bg-[#1F1F1F] flex flex-col z-30 select-none relative transition-colors duration-75 shadow-lg"
    >
      {/* Draggable Top Border Resizer */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-[#0078D4] transition-colors duration-75 z-40"
        title="Drag to resize panel"
      />

      {/* VS Code Dock Tabs Bar */}
      <div className="h-8 bg-[#181818] flex items-center justify-between px-2 text-xs">
        {/* Left Tabs */}
        <div className="flex items-center h-full gap-0.5">
          {/* PROBLEMS */}
          <button
            onClick={() => onSelectTab('problems')}
            className={`px-2.5 h-full flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              activeTab === 'problems'
                ? 'text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            <span>Problems</span>
            <span className="text-[10px] px-1 py-0.2 rounded-full bg-[#252526] text-[#858585]">
              0
            </span>
            {activeTab === 'problems' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#0078D4]" />
            )}
          </button>

          {/* OUTPUT */}
          <button
            onClick={() => onSelectTab('output')}
            className={`px-2.5 h-full flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              activeTab === 'output'
                ? 'text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            <span>Output</span>
            {buildLog.length > 0 && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-[#252526] text-[#0078D4] font-mono">
                {buildLog.length}
              </span>
            )}
            {activeTab === 'output' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#0078D4]" />
            )}
          </button>

          {/* DEBUG CONSOLE */}
          <button
            onClick={() => onSelectTab('debug')}
            className={`px-2.5 h-full flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              activeTab === 'debug'
                ? 'text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            <span>Debug Console</span>
            {activeTab === 'debug' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#0078D4]" />
            )}
          </button>

          {/* TERMINAL */}
          <button
            onClick={() => onSelectTab('terminal')}
            className={`px-2.5 h-full flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              activeTab === 'terminal'
                ? 'text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            <span>Terminal</span>
            {activeTab === 'terminal' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#0078D4]" />
            )}
          </button>

          {/* APK RUNNER */}
          <button
            onClick={() => onSelectTab('apk-runner')}
            className={`px-2.5 h-full flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              activeTab === 'apk-runner'
                ? 'text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            <span className="text-[#0078D4]">●</span>
            <span>APK Runner</span>
            {activeTab === 'apk-runner' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#0078D4]" />
            )}
          </button>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 text-[#CCCCCC]">
          {activeTab === 'terminal' && (
            <>
              {/* Shell Switcher Dropdown (>_ 1: pwsh ˅) */}
              <div
                className="relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowSwitchDropdown((p) => !p)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] hover:bg-[#252526] text-[11px] text-[#CCCCCC] transition-colors"
                  title="Switch Active Terminal"
                >
                  <span className="text-[#0078D4] font-mono font-bold text-[11px]">
                    &gt;_
                  </span>
                  <span className="font-sans font-medium">
                    {activeTabMeta?.name || '1: pwsh'}
                  </span>
                  <ChevronDown size={11} className="text-[#858585] ml-0.5" />
                </button>

                {showSwitchDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-[#181818] shadow-2xl rounded-[4px] py-1 z-50 text-xs font-sans">
                    {terminalTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          terminalRef.current?.switchTerminal(tab.id);
                          setShowSwitchDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#0078D4] hover:text-white transition-colors ${
                          tab.id === activeTerminalId
                            ? 'bg-[#252526] text-white font-medium'
                            : 'text-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[#0078D4] font-mono font-bold text-xs">
                            &gt;_
                          </span>
                          <span>{tab.name}</span>
                        </div>
                        {tab.id === activeTerminalId && (
                          <span className="text-[10px] text-[#0078D4] font-bold">
                            ●
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* New Terminal (+) with profile menu */}
              <div
                className="relative flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => terminalRef.current?.createTerminal('powershell')}
                  className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
                  title="New Terminal"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => setShowNewShellDropdown((p) => !p)}
                  className="p-1 -ml-0.5 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
                  title="Select Default Profile"
                >
                  <ChevronDown size={11} />
                </button>

                {showNewShellDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-[#181818] shadow-2xl rounded-[4px] py-1 z-50 text-xs font-sans">
                    <button
                      onClick={() => {
                        terminalRef.current?.createTerminal('powershell');
                        setShowNewShellDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 text-[#CCCCCC]"
                    >
                      <span className="text-[#0078D4] font-bold font-mono text-xs">
                        &gt;_
                      </span>
                      <span>PowerShell (Default)</span>
                    </button>
                    <button
                      onClick={() => {
                        terminalRef.current?.createTerminal('cmd');
                        setShowNewShellDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 text-[#CCCCCC]"
                    >
                      <span className="text-[#0078D4] font-bold font-mono text-xs">
                        C:\
                      </span>
                      <span>Command Prompt</span>
                    </button>
                    <button
                      onClick={() => {
                        terminalRef.current?.createTerminal('bash');
                        setShowNewShellDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 text-[#CCCCCC]"
                    >
                      <span className="text-[#0078D4] font-bold font-mono text-xs">
                        $
                      </span>
                      <span>Git Bash / WSL</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Split Terminal [ | ] */}
              <button
                onClick={() => terminalRef.current?.createTerminal('powershell')}
                className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
                title="Split Terminal"
              >
                <Columns2 size={13} />
              </button>

              {/* Kill Terminal 🗑 */}
              <button
                onClick={() => terminalRef.current?.killTerminal()}
                className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
                title="Kill Terminal"
              >
                <Trash2 size={13} />
              </button>

              {/* More Actions ... */}
              <div
                className="relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowMoreMenu((p) => !p)}
                  className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
                  title="More Actions..."
                >
                  <MoreHorizontal size={13} />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-[#181818] shadow-2xl rounded-[4px] py-1 z-50 text-xs font-sans">
                    <button
                      onClick={() => {
                        terminalRef.current?.clearTerminal();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 text-[#CCCCCC]"
                    >
                      <Ban size={12} className="text-[#0078D4]" />
                      <span>Clear Terminal (Ctrl+L)</span>
                    </button>
                    <button
                      onClick={() => {
                        terminalRef.current?.scrollToTop();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 text-[#CCCCCC]"
                    >
                      <ArrowUp size={12} />
                      <span>Scroll to Top</span>
                    </button>
                    <button
                      onClick={() => {
                        terminalRef.current?.scrollToBottom();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#0078D4] hover:text-white flex items-center gap-2 text-[#CCCCCC]"
                    >
                      <ArrowDown size={12} />
                      <span>Scroll to Bottom</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Panel Controls (Maximize & Close) */}
          <div className="flex items-center gap-0.5 ml-1 pl-1">
            <button
              onClick={handleToggleMaximize}
              className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
              title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel Size'}
            >
              {isMaximized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-[#FFFFFF] transition-colors"
              title="Close Panel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 overflow-hidden relative bg-[#1F1F1F]">
        <div
          className={`h-full w-full ${
            activeTab === 'terminal' ? 'block' : 'hidden'
          }`}
        >
          <TerminalPanel
            ref={terminalRef}
            workspacePath={workspacePath}
            onTabsChange={(tabs, activeId) => {
              setTerminalTabs(tabs);
              setActiveTerminalId(activeId);
            }}
          />
        </div>

        {activeTab === 'apk-runner' && (
          <ApkTesterRunner
            dirHandle={dirHandle}
            onStatusMessage={onStatusMessage}
            onOpenTerminalCmd={(cmd) => {
              onSelectTab('terminal');
              terminalRef.current?.createTerminal('powershell', cmd);
            }}
          />
        )}

        {activeTab === 'output' && (
          <div className="h-full p-3 font-mono text-xs overflow-y-auto bg-[#1F1F1F] text-[#CCCCCC] whitespace-pre-wrap select-text leading-relaxed">
            {buildLog.length === 0 ? (
              <span className="text-[#696969] italic">
                No build output yet. Trigger "Build APK" to stream real-time
                compilation logs.
              </span>
            ) : (
              buildLog.map((log, i) => (
                <div key={i} className="mb-0.5">
                  {log}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="h-full p-4 font-mono text-xs overflow-y-auto bg-[#1F1F1F] text-[#696969] flex flex-col items-center justify-center text-center">
            <AlertTriangle
              size={20}
              className="text-[#696969] mb-2 opacity-60"
            />
            <span>No problems have been detected in the workspace.</span>
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="h-full p-4 font-mono text-xs overflow-y-auto bg-[#1F1F1F] text-[#696969] flex flex-col items-center justify-center text-center">
            <span>
              No active debug session. Attach ADB or start an APK execution to
              inspect smali breakpoints.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
