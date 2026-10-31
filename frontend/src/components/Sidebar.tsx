import { 
  FolderOpen, AlertTriangle, Key, Cpu, HelpCircle, Wrench, Palette, Sparkles, Plus, FolderPlus, RefreshCw
} from 'lucide-react';
import FileTree from './FileTree';
import ApkModifier from './ApkModifier';
import { AVAILABLE_THEMES } from '../utils/monacoConfig';

interface SidebarProps {
  activePanel: 'explorer' | 'ai' | 'settings' | 'modifier';
  dirHandle: FileSystemDirectoryHandle | null;
  onOpenDirectory: () => void;
  onFileClick: (path: string, handle: FileSystemFileHandle) => void;
  onRefreshTrigger: number;
  onCreateFile: (parentPath: string, name: string) => Promise<void>;
  onCreateFolder: (parentPath: string, name: string) => Promise<void>;
  onDeleteEntry: (path: string) => Promise<void>;
  onRenameEntry: (oldPath: string, newName: string) => Promise<void>;
  onReplaceFile: (filePath: string, fileHandle: FileSystemFileHandle) => Promise<void>;
  onImportFile: (parentPath: string) => Promise<void>;
  onTriggerRefresh: () => void;
  onStatusMessage: (msg: string) => void;
  workspacePath?: string | null;
  onOpenSkillsModal: () => void;
  onOpenMcpModal: () => void;
  
  // Settings Props
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  decompilerType: 'jadx' | 'apktool';
  onSelectDecompiler: (type: 'jadx' | 'apktool') => void;
  autoSave: boolean;
  onToggleAutoSave: () => void;
  theme: string;
  onSelectTheme: (themeId: string) => void;
}

export default function Sidebar({
  activePanel,
  dirHandle,
  onOpenDirectory,
  onFileClick,
  onRefreshTrigger,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onRenameEntry,
  onReplaceFile,
  onImportFile,
  onTriggerRefresh,
  onStatusMessage,
  workspacePath,
  onOpenSkillsModal,
  onOpenMcpModal,

  // Settings
  geminiApiKey,
  setGeminiApiKey,
  decompilerType,
  onSelectDecompiler,
  autoSave,
  onToggleAutoSave,
  theme,
  onSelectTheme
}: SidebarProps) {
  return (
    <div className="w-72 bg-[#181818] flex flex-col h-full overflow-hidden select-none shrink-0">
      
      {/* PANEL 1: EXPLORER */}
      {activePanel === 'explorer' && (
        <div className="flex flex-col h-full overflow-hidden bg-[#181818]">
          <div className="h-9 px-3 flex items-center justify-between text-xs font-medium text-[#CCCCCC] bg-[#181818] uppercase tracking-wider">
            <span className="truncate max-w-[140px]">{dirHandle ? dirHandle.name : 'Explorer'}</span>
            {dirHandle && (
              <div className="flex items-center gap-1 text-[#696969]">
                <button
                  onClick={async () => {
                    const fn = prompt('New file name:');
                    if (fn) await onCreateFile('', fn);
                  }}
                  title="New File..."
                  className="p-1 hover:text-[#0078D4] hover:bg-[#252526] rounded-[2px] cursor-pointer"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={async () => {
                    const fn = prompt('New folder name:');
                    if (fn) await onCreateFolder('', fn);
                  }}
                  title="New Folder..."
                  className="p-1 hover:text-[#0078D4] hover:bg-[#252526] rounded-[2px] cursor-pointer"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={onTriggerRefresh}
                  title="Refresh Explorer"
                  className="p-1 hover:text-[#0078D4] hover:bg-[#252526] rounded-[2px] cursor-pointer"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {dirHandle ? (
              <FileTree
                dirHandle={dirHandle}
                currentPath=""
                workspacePath={workspacePath}
                onFileClick={onFileClick}
                onRefreshTrigger={onRefreshTrigger}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onDeleteEntry={onDeleteEntry}
                onRenameEntry={onRenameEntry}
                onReplaceFile={onReplaceFile}
                onImportFile={onImportFile}
              />
            ) : (
              <div className="p-5 flex flex-col items-center justify-center text-center h-56 gap-3">
                <p className="text-xs text-[#696969] leading-relaxed">
                  You have not yet opened a workspace folder.
                </p>
                <button
                  onClick={onOpenDirectory}
                  className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] px-3.5 py-1.5 rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors duration-100"
                >
                  <FolderOpen size={14} />
                  <span>Open Folder</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANEL 2: APK MODIFIER */}
      {activePanel === 'modifier' && (
        <div className="flex flex-col h-full overflow-hidden bg-[#181818]">
          <div className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium text-[#CCCCCC] bg-[#181818] uppercase tracking-wider">
            <Wrench size={13} className="text-[#0078D4]" />
            <span>APK Modifier</span>
          </div>
          <ApkModifier
            dirHandle={dirHandle}
            onRefreshTrigger={onTriggerRefresh}
            onStatusMessage={onStatusMessage}
          />
        </div>
      )}

      {/* PANEL 4: SETTINGS */}
      {activePanel === 'settings' && (
        <div className="flex flex-col h-full overflow-hidden bg-[#181818]">
          <div className="h-9 px-3 flex items-center text-xs font-medium text-[#CCCCCC] bg-[#181818] uppercase tracking-wider">
            <span>Settings</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 text-xs select-text bg-[#1F1F1F]">
            {/* Bulk API Key Pool */}
            <div className="flex flex-col gap-2">
              <label className="font-medium text-[#CCCCCC] flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Key size={13} className="text-[#0078D4]" />
                  <span>API Keys Pool (Bulk API)</span>
                </span>
                <span className="text-[10px] text-[#0078D4] font-mono">Auto-Failover</span>
              </label>
              <textarea
                rows={3}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter one or multiple API keys (separated by commas or newlines)..."
                className="bg-[#181818] rounded-[3px] p-2 text-xs text-[#FFFFFF] placeholder-[#696969] focus:outline-none focus:ring-1 focus:ring-[#0078D4] font-mono"
              />
              <p className="text-[11px] text-[#696969] leading-relaxed">
                Add multiple keys to enable high-concurrency Bulk API requests and automatic round-robin rotation when rate limits or quotas are hit.
              </p>
            </div>

            {/* Skills & MCP Extensions */}
            <div className="flex flex-col gap-2">
              <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
                <Sparkles size={13} className="text-[#0078D4]" />
                <span>Agent Extensions & MCP</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenSkillsModal}
                  className="p-2.5 bg-[#181818] hover:bg-[#252526] rounded-[4px] text-left transition-colors flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-white text-[11px]">
                    <Sparkles size={12} className="text-[#0078D4]" />
                    <span>Skills Catalog</span>
                  </div>
                  <span className="text-[10px] text-[#858585]">
                    GitHub & custom skills
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenMcpModal}
                  className="p-2.5 bg-[#181818] hover:bg-[#252526] rounded-[4px] text-left transition-colors flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-white text-[11px]">
                    <Cpu size={12} className="text-[#0078D4]" />
                    <span>MCP Servers</span>
                  </div>
                  <span className="text-[10px] text-[#858585]">
                    Stdio tool servers
                  </span>
                </button>
              </div>
            </div>

            {/* Appearance & Themes */}
            <div className="flex flex-col gap-2">
              <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
                <Palette size={13} className="text-[#0078D4]" />
                <span>Appearance & Theme</span>
              </label>
              <div className="flex flex-col gap-1 bg-[#181818] p-1.5 rounded-[4px] max-h-52 overflow-y-auto">
                {AVAILABLE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTheme(t.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-xs transition-colors duration-75 text-left ${
                      theme === t.id
                        ? 'bg-[#0078D4]/20 text-[#FFFFFF] font-medium'
                        : 'text-[#696969] hover:bg-[#252526] hover:text-[#CCCCCC]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-[2px] inline-block shrink-0"
                        style={{ backgroundColor: t.bg }}
                      />
                      <span>{t.name}</span>
                    </div>
                    {theme === t.id && (
                      <span className="text-[10px] bg-[#0078D4] text-white px-1.5 py-0.5 rounded-[2px] font-medium">
                        Active
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Decompiler tool selector */}
            <div className="flex flex-col gap-2">
              <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
                <Cpu size={13} className="text-[#0078D4]" />
                <span>Decompilation Engine</span>
              </label>
              <div className="flex flex-col gap-2 bg-[#181818] p-3 rounded-[4px]">
                <label className="flex items-start gap-2.5 cursor-pointer py-1">
                  <input
                    type="radio"
                    name="decompiler"
                    checked={decompilerType === 'apktool'}
                    onChange={() => onSelectDecompiler('apktool')}
                    className="mt-0.5 text-[#0078D4] bg-[#1F1F1F] focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-[#CCCCCC] block flex items-center gap-1.5">
                      <span>Apktool (Smali + Resources)</span>
                      <span className="text-[10px] bg-[#1F1F1F] text-[#FFFFFF] px-1.5 py-0.2 rounded font-medium">Fast</span>
                    </span>
                    <span className="text-[11px] text-[#696969] leading-tight block mt-0.5">Decompiles Smali bytecode. Re-buildable into signed APK.</span>
                  </div>
                </label>
                <div className="h-[1px] bg-[#252526]" />
                <label className="flex items-start gap-2.5 cursor-pointer py-1 opacity-75">
                  <input
                    type="radio"
                    name="decompiler"
                    checked={decompilerType === 'jadx'}
                    onChange={() => onSelectDecompiler('jadx')}
                    className="mt-0.5 text-[#0078D4] bg-[#1F1F1F] focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-[#CCCCCC] block">JADX (Java Sources)</span>
                    <span className="text-[11px] text-[#696969] leading-tight block mt-0.5">DEX to Java decompilation. Read-only view.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Auto Save Toggle */}
            <div className="flex flex-col gap-2">
              <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
                <AlertTriangle size={13} className="text-[#0078D4]" />
                <span>Local Document Sync</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer bg-[#181818] rounded-[4px] p-3">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={onToggleAutoSave}
                  className="rounded-[2px] text-[#0078D4] bg-[#1F1F1F] focus:ring-0"
                />
                <div>
                  <span className="font-medium text-[#CCCCCC] block">Monaco Auto-Save</span>
                  <span className="text-[11px] text-[#696969]">Saves change buffers to disk every 3 seconds.</span>
                </div>
              </label>
            </div>

            {/* Quick Keyboard Reference */}
            <div className="flex flex-col gap-2 pt-4">
              <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 mb-1 text-xs">
                <HelpCircle size={13} className="text-[#0078D4]" />
                <span>Shortcuts</span>
              </label>
              <div className="flex flex-col gap-2 text-[11px] text-[#696969]">
                <div className="flex justify-between items-center pb-1">
                  <span>Search Files</span>
                  <kbd className="bg-[#181818] px-1.5 py-0.5 rounded-[2px] text-[#CCCCCC] font-mono">Ctrl + P</kbd>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span>Save Buffer</span>
                  <kbd className="bg-[#181818] px-1.5 py-0.5 rounded-[2px] text-[#CCCCCC] font-mono">Ctrl + S</kbd>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span>Toggle Terminal</span>
                  <kbd className="bg-[#181818] px-1.5 py-0.5 rounded-[2px] text-[#CCCCCC] font-mono">Ctrl + `</kbd>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span>Toggle Sidebar</span>
                  <kbd className="bg-[#181818] px-1.5 py-0.5 rounded-[2px] text-[#CCCCCC] font-mono">Ctrl + B</kbd>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
