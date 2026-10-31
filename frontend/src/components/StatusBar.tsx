import { Database, RefreshCw, Save, Terminal as TerminalIcon, Smartphone, Maximize, Minimize } from 'lucide-react';

interface StatusBarProps {
  cursorPos: { line: number; col: number } | null;
  activeFileOpened: boolean;
  statusMessage: string;
  isIndexing: boolean;
  isSaving: boolean;
  isBottomPanelOpen?: boolean;
  onToggleTerminal?: () => void;
  onToggleApkRunner?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function StatusBar({
  cursorPos,
  activeFileOpened,
  statusMessage,
  isIndexing,
  isSaving,
  isBottomPanelOpen = false,
  onToggleTerminal,
  onToggleApkRunner,
  isFullscreen = false,
  onToggleFullscreen,
}: StatusBarProps) {
  return (
    <div className="h-6 bg-[#181818] text-xs text-[#696969] flex items-center justify-between px-3 select-none z-10">
      {/* Left side status message & loader */}
      <div className="flex items-center gap-2.5 overflow-hidden mr-4">
        {isSaving ? (
          <span className="flex items-center gap-1.5 text-[#0078D4] font-medium text-[11px]">
            <Save className="animate-pulse" size={12} />
            <span>Saving...</span>
          </span>
        ) : isIndexing ? (
          <span className="flex items-center gap-1.5 text-[#0078D4] font-medium text-[11px]">
            <RefreshCw className="animate-spin" size={12} />
            <span>Indexing...</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[#696969] text-[11px]">
            <Database size={11} className="text-[#0078D4]" />
            <span>Ready</span>
          </span>
        )}
        <span className="truncate max-w-[420px] text-[#CCCCCC] text-[11px]">{statusMessage}</span>
      </div>

      {/* Right side metadata & Quick Panel Toggles */}
      <div className="flex items-center gap-2 shrink-0 text-[11px]">
        {/* Quick Terminal Toggle */}
        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] transition-colors duration-75 ${
              isBottomPanelOpen
                ? 'bg-[#252526] text-[#FFFFFF]'
                : 'text-[#696969] hover:text-[#CCCCCC] hover:bg-[#252526]'
            }`}
            title="Toggle Integrated Terminal (Ctrl+`)"
          >
            <TerminalIcon size={12} className={isBottomPanelOpen ? 'text-[#0078D4]' : 'text-[#696969]'} />
            <span>Terminal</span>
          </button>
        )}

        {/* Quick APK Runner Toggle */}
        {onToggleApkRunner && (
          <button
            onClick={onToggleApkRunner}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[#696969] hover:text-[#CCCCCC] hover:bg-[#252526] transition-colors duration-75"
            title="Open APK Tester Runner & Emulator"
          >
            <Smartphone size={12} className="text-[#0078D4]" />
            <span>APK Tester</span>
          </button>
        )}

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[#696969] hover:text-[#CCCCCC] hover:bg-[#252526] transition-colors duration-75"
            title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen (F11)'}
          >
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
          </button>
        )}

        {activeFileOpened && cursorPos && (
          <div className="flex items-center gap-1 bg-[#1F1F1F] px-1.5 py-0.5 rounded-[2px] text-[#CCCCCC]">
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          </div>
        )}
        <div className="hidden sm:block px-1 text-[#696969]">
          <span>UTF-8</span>
        </div>
        <div className="hidden md:block px-1 text-[#0078D4] font-medium">
          <span>Smali / Java</span>
        </div>
      </div>
    </div>
  );
}
