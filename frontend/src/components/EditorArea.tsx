import React, { useRef, useState, useEffect, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import JSZip from 'jszip';
import {
  X,
  Play,
  ShieldAlert,
  Cpu,
  Sparkles,
  FolderOpen,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  FileCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Music,
  Video,
  Type,
  Archive,
  Binary,
  Search,
  Folder,
  File,
  Plus,
} from 'lucide-react';
import { setupMonacoEnvironment } from '../utils/monacoConfig';
import { getRecentWorkspaces } from '../utils/workspaceStorage';
import { useI18n } from '../utils/i18n';

interface Tab {
  name: string;
  path: string;
  handle: FileSystemFileHandle;
}

interface EditorAreaProps {
  openTabs: Tab[];
  activeTabPath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  fileContents: string;
  onContentChange: (content: string) => void;
  onCursorChange: (pos: { line: number; col: number }) => void;
  onTriggerDecompile: () => void;
  onOpenDirectory: () => void;
  onOpenRecentWorkspace?: (handle: FileSystemDirectoryHandle) => void;
  onSelectPanel?: (panel: 'explorer' | 'ai' | 'settings' | 'modifier') => void;
  onOpenApkRunner?: () => void;
  workspaceOpened: boolean;
  onTriggerContextAi: (
    action: 'explain' | 'javadoc' | 'audit',
    selectedText: string
  ) => void;
  isSidebarOpen: boolean;
  theme?: string;
  workspacePath?: string | null;
  workspaceName?: string;
  onNewTextFile?: () => void;
}

interface RecentItem {
  name: string;
  path?: string;
  handle?: FileSystemDirectoryHandle;
}

type ViewerType = 'image' | 'media' | 'font' | 'archive' | 'hex' | 'code';

function getViewerType(fileName: string): ViewerType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (/^(png|jpg|jpeg|gif|webp|ico|svg|bmp)$/i.test(ext)) return 'image';
  if (/^(mp3|ogg|wav|m4a|mp4|webm|flac)$/i.test(ext)) return 'media';
  if (/^(ttf|otf|woff|woff2)$/i.test(ext)) return 'font';
  if (/^(apk|zip|jar|aar)$/i.test(ext)) return 'archive';
  if (/^(dex|so|arsc|bin|dat|class|exe|dll)$/i.test(ext)) return 'hex';
  return 'code';
}

function determineLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'smali':
      return 'smali';
    case 'java':
    case 'aidl':
      return 'java';
    case 'kt':
    case 'kts':
      return 'kotlin';
    case 'xml':
    case 'axml':
    case 'plist':
    case 'svg':
      return 'xml';
    case 'json':
    case 'json5':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'properties':
    case 'cfg':
    case 'ini':
    case 'conf':
      return 'ini';
    case 'gradle':
    case 'pro':
    case 'flags':
      return 'groovy';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'bat':
    case 'cmd':
      return 'bat';
    case 'ps1':
    case 'psm1':
      return 'powershell';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
      return 'cpp';
    case 'rs':
      return 'rust';
    case 'py':
      return 'python';
    case 'sql':
      return 'sql';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'md':
    case 'markdown':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function EditorArea({
  openTabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  fileContents,
  onContentChange,
  onCursorChange,
  onTriggerDecompile,
  onOpenDirectory,
  onOpenRecentWorkspace,
  onSelectPanel,
  onOpenApkRunner,
  workspaceOpened,
  onTriggerContextAi,
  isSidebarOpen,
  theme = 'vs-dark',
  workspacePath,
  workspaceName,
  onNewTextFile,
}: EditorAreaProps) {
  const { t } = useI18n();
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevActiveTabPathRef = useRef<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Recent workspaces
  const [recentList, setRecentList] = useState<RecentItem[]>([]);
  const [showAllWorkspaces, setShowAllWorkspaces] = useState<boolean>(false);

  // Active tab entity
  const activeTab = openTabs.find((t) => t.path === activeTabPath);
  const viewerType = activeTab ? getViewerType(activeTab.name) : 'code';

  // Multi-format viewer states
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetSize, setAssetSize] = useState<number>(0);

  // Image viewer state
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Font viewer state
  const [fontFamilyName, setFontFamilyName] = useState<string>('PreviewFont');
  const [fontSampleText, setFontSampleText] = useState<string>(
    'The quick brown fox jumps over the lazy dog 1234567890'
  );

  // Archive viewer state
  interface ArchiveEntry {
    name: string;
    size: number;
    compressedSize: number;
    date: Date;
    isDir: boolean;
  }
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);
  const [archiveFilter, setArchiveFilter] = useState<string>('');
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);

  // Hex viewer state
  const HEX_PAGE_SIZE = 512;
  const [hexPage, setHexPage] = useState<number>(0);
  const [hexTotalPages, setHexTotalPages] = useState<number>(1);
  const [hexBytes, setHexBytes] = useState<Uint8Array>(new Uint8Array(0));
  const [hexMagicDesc, setHexMagicDesc] = useState<string>('');
  const [hexLoading, setHexLoading] = useState<boolean>(false);

  // Load recent workspaces
  useEffect(() => {
    async function loadRecents() {
      try {
        const list = await getRecentWorkspaces();
        setRecentList(list);
      } catch (err) {
        console.warn('Failed to load recent workspaces:', err);
      }
    }
    loadRecents();
  }, [workspaceOpened]);

  // Load active tab assets for specialized viewers
  useEffect(() => {
    if (!activeTab) {
      setAssetUrl(null);
      setAssetSize(0);
      return;
    }

    let isSubscribed = true;
    const type = getViewerType(activeTab.name);

    if (type === 'image' || type === 'media' || type === 'font') {
      activeTab.handle
        .getFile()
        .then(async (file) => {
          if (!isSubscribed) return;
          setAssetSize(file.size);
          const url = URL.createObjectURL(file);
          setAssetUrl(url);

          if (type === 'font') {
            try {
              const buffer = await file.arrayBuffer();
              const uniqueFamily = `Font_${Date.now()}`;
              const fontFace = new FontFace(uniqueFamily, buffer);
              await fontFace.load();
              document.fonts.add(fontFace);
              setFontFamilyName(uniqueFamily);
            } catch (fontErr) {
              console.warn('Failed to register FontFace:', fontErr);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load asset for viewer:', err);
        });

      return () => {
        isSubscribed = false;
        setAssetUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      };
    } else if (type === 'archive') {
      setArchiveLoading(true);
      setArchiveEntries([]);
      activeTab.handle
        .getFile()
        .then(async (file) => {
          if (!isSubscribed) return;
          setAssetSize(file.size);
          const buffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(buffer);
          const entries: ArchiveEntry[] = [];

          zip.forEach((relativePath, entry) => {
            entries.push({
              name: relativePath,
              size: (entry as any)._data?.uncompressedSize || 0,
              compressedSize: (entry as any)._data?.compressedSize || 0,
              date: entry.date,
              isDir: entry.dir,
            });
          });

          entries.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

          if (isSubscribed) {
            setArchiveEntries(entries);
            setArchiveLoading(false);
          }
        })
        .catch((err) => {
          console.error('Failed to parse archive:', err);
          if (isSubscribed) setArchiveLoading(false);
        });
    } else if (type === 'hex') {
      setHexPage(0);
      loadHexPage(0);
    } else {
      setAssetUrl(null);
    }

    return () => {
      isSubscribed = false;
    };
  }, [activeTabPath]);

  // Load specific page of hex viewer
  const loadHexPage = async (pageIdx: number) => {
    if (!activeTab) return;
    setHexLoading(true);
    try {
      const file = await activeTab.handle.getFile();
      setAssetSize(file.size);
      const totalPages = Math.max(1, Math.ceil(file.size / HEX_PAGE_SIZE));
      setHexTotalPages(totalPages);
      const safePage = Math.max(0, Math.min(pageIdx, totalPages - 1));
      setHexPage(safePage);

      const offset = safePage * HEX_PAGE_SIZE;
      const slice = file.slice(offset, offset + HEX_PAGE_SIZE);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setHexBytes(bytes);

      if (safePage === 0 && bytes.length >= 4) {
        // Inspect magic bytes
        const magicHex = Array.from(bytes.slice(0, 4))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');

        if (
          bytes[0] === 0x64 &&
          bytes[1] === 0x65 &&
          bytes[2] === 0x78 &&
          bytes[3] === 0x0a
        ) {
          setHexMagicDesc('Android Dalvik Executable (DEX Bytecode)');
        } else if (
          bytes[0] === 0x7f &&
          bytes[1] === 0x45 &&
          bytes[2] === 0x4c &&
          bytes[3] === 0x46
        ) {
          setHexMagicDesc('ELF Linux/Android Shared Library Binary (.so)');
        } else if (
          bytes[0] === 0x02 &&
          bytes[1] === 0x00 &&
          bytes[2] === 0x0c &&
          bytes[3] === 0x00
        ) {
          setHexMagicDesc('Android Binary Compiled Resources Table (resources.arsc)');
        } else if (
          bytes[0] === 0xca &&
          bytes[1] === 0xfe &&
          bytes[2] === 0xba &&
          bytes[3] === 0xbe
        ) {
          setHexMagicDesc('Java Class Bytecode File (.class)');
        } else if (
          bytes[0] === 0x50 &&
          bytes[1] === 0x4b &&
          bytes[2] === 0x03 &&
          bytes[3] === 0x04
        ) {
          setHexMagicDesc('ZIP / APK Archive Container');
        } else {
          setHexMagicDesc(`Binary Data (Magic: ${magicHex})`);
        }
      }
    } catch (err) {
      console.warn('Failed to load hex data:', err);
    } finally {
      setHexLoading(false);
    }
  };

  // Monaco layout refresh
  useEffect(() => {
    const wasNull = prevActiveTabPathRef.current === null;
    prevActiveTabPathRef.current = activeTabPath;

    if (!editorRef.current) return;
    editorRef.current.layout();
    const t1 = setTimeout(() => editorRef.current?.layout(), 50);
    const t2 =
      wasNull && activeTabPath
        ? setTimeout(() => editorRef.current?.layout(), 250)
        : null;

    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [activeTabPath, isSidebarOpen]);

  // ResizeObserver for editor container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      editorRef.current?.layout();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    editor.layout();
    setTimeout(() => editor.layout(), 50);

    editor.onDidChangeCursorPosition((e: any) => {
      onCursorChange({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editorRef.current) return;
    e.preventDefault();

    const selection = editorRef.current.getSelection();
    const model = editorRef.current.getModel();

    if (selection && model) {
      const selectedText = model.getValueInRange(selection);
      if (selectedText && selectedText.trim().length > 0) {
        setContextMenu({
          x: e.pageX,
          y: e.pageY,
          text: selectedText,
        });
      }
    }
  };

  // Filtered archive entries
  const filteredArchiveEntries = useMemo(() => {
    if (!archiveFilter.trim()) return archiveEntries;
    const q = archiveFilter.toLowerCase();
    return archiveEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [archiveEntries, archiveFilter]);

  const displayedWorkspaces = showAllWorkspaces
    ? recentList
    : recentList.slice(0, 4);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-[#1F1F1F] overflow-hidden relative select-none"
      onContextMenu={handleContextMenu}
    >
      {/* VS Code Tabs Bar */}
      {openTabs.length > 0 && (
        <div className="h-9 bg-[#181818] flex items-center overflow-x-auto select-none no-scrollbar">
          {openTabs.map((tab) => {
            const isActive = tab.path === activeTabPath;
            const tabType = getViewerType(tab.name);
            return (
              <div
                key={tab.path}
                onClick={() => onSelectTab(tab.path)}
                className={`h-full px-3.5 flex items-center gap-2 cursor-pointer text-xs transition-colors duration-75 relative ${
                  isActive
                    ? 'bg-[#1F1F1F] text-[#FFFFFF]'
                    : 'bg-[#181818] text-[#696969] hover:bg-[#1F1F1F]/60 hover:text-[#CCCCCC]'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#0078D4]" />
                )}
                {tabType === 'image' ? (
                  <span className="text-[#0078D4]">🖼️</span>
                ) : tabType === 'media' ? (
                  <Music size={13} className="text-[#0078D4]" />
                ) : tabType === 'font' ? (
                  <Type size={13} className="text-[#0078D4]" />
                ) : tabType === 'archive' ? (
                  <Archive size={13} className="text-[#0078D4]" />
                ) : tabType === 'hex' ? (
                  <Binary size={13} className="text-[#0078D4]" />
                ) : (
                  <FileCode
                    size={13}
                    className={isActive ? 'text-[#0078D4]' : 'text-[#696969]'}
                  />
                )}
                <span className="truncate max-w-[150px] font-medium">
                  {tab.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  className="p-0.5 rounded-[2px] text-[#696969] hover:bg-[#2A2D2E] hover:text-[#FFFFFF] ml-1 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Content Area */}
      {openTabs.length > 0 && activeTabPath ? (
        viewerType === 'image' && assetUrl ? (
          /* 1. Image Viewer */
          <div className="flex-1 w-full h-full flex flex-col bg-[#141414] overflow-hidden select-text">
            {/* Image Toolbar */}
            <div className="h-8 bg-[#181818] px-3 flex items-center justify-between text-xs text-[#CCCCCC]">
              <div className="flex items-center gap-3">
                <span className="font-mono">{activeTab?.name}</span>
                {imageDimensions && (
                  <span className="text-[#858585] text-[11px] font-mono">
                    {imageDimensions.width} × {imageDimensions.height} px
                  </span>
                )}
                <span className="text-[#858585] text-[11px] font-mono">
                  {formatBytes(assetSize)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setImageZoom((z) => Math.max(0.2, z - 0.2))}
                  className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[11px] font-mono text-[#CCCCCC] w-12 text-center">
                  {Math.round(imageZoom * 100)}%
                </span>
                <button
                  onClick={() => setImageZoom((z) => Math.min(5, z + 0.2))}
                  className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  onClick={() => setImageZoom(1)}
                  className="p-1 rounded-[3px] hover:bg-[#252526] text-[#858585] hover:text-white"
                  title="Reset Zoom (100%)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {/* Image Canvas */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#141414]">
              <img
                src={assetUrl}
                alt={activeTab?.name}
                style={{ transform: `scale(${imageZoom})` }}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  setImageDimensions({
                    width: target.naturalWidth,
                    height: target.naturalHeight,
                  });
                }}
                className="max-h-[75vh] max-w-full object-contain bg-[#181818] rounded-[4px] shadow-2xl transition-transform duration-100"
              />
            </div>
          </div>
        ) : viewerType === 'media' && assetUrl ? (
          /* 2. Audio & Media Player */
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#141414] p-8 select-text">
            <div className="w-full max-w-md bg-[#181818] rounded-[8px] p-6 shadow-2xl flex flex-col items-center gap-4">
              {/\.(mp4|webm)$/i.test(activeTab?.name || '') ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#CCCCCC]">
                    <Video size={14} className="text-[#0078D4]" />
                    <span className="font-mono">{activeTab?.name}</span>
                    <span className="text-[#858585]">({formatBytes(assetSize)})</span>
                  </div>
                  <video
                    src={assetUrl}
                    controls
                    className="w-full max-h-[60vh] rounded bg-black"
                  />
                </div>
              ) : (
                <div className="w-full flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#1F1F1F] flex items-center justify-center shadow-inner">
                    <Music size={28} className="text-[#0078D4]" />
                  </div>
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-sm font-semibold text-[#FFFFFF] font-mono">
                      {activeTab?.name}
                    </span>
                    <span className="text-xs text-[#858585]">
                      Audio Asset • {formatBytes(assetSize)}
                    </span>
                  </div>
                  <audio src={assetUrl} controls className="w-full mt-2" />
                </div>
              )}
            </div>
          </div>
        ) : viewerType === 'font' ? (
          /* 3. Font Viewer */
          <div className="flex-1 w-full h-full flex flex-col bg-[#141414] overflow-hidden select-text">
            <div className="h-9 bg-[#181818] px-3 flex items-center justify-between text-xs text-[#CCCCCC]">
              <div className="flex items-center gap-2">
                <Type size={14} className="text-[#0078D4]" />
                <span className="font-mono">{activeTab?.name}</span>
                <span className="text-[#858585]">({formatBytes(assetSize)})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#858585]">Test Text:</span>
                <input
                  type="text"
                  value={fontSampleText}
                  onChange={(e) => setFontSampleText(e.target.value)}
                  placeholder="Type sample text..."
                  className="bg-[#1F1F1F] text-[#FFFFFF] px-2 py-0.5 rounded-[3px] text-xs w-64 outline-none focus:ring-1 focus:ring-[#0078D4]"
                />
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {[48, 36, 24, 18, 14].map((size) => (
                <div
                  key={size}
                  className="p-3 bg-[#181818] rounded-[4px]"
                >
                  <span className="text-[10px] text-[#696969] block mb-1">
                    {size}px
                  </span>
                  <div
                    style={{
                      fontFamily: fontFamilyName,
                      fontSize: `${size}px`,
                      lineHeight: 1.2,
                    }}
                    className="text-[#FFFFFF] break-words"
                  >
                    {fontSampleText}
                  </div>
                </div>
              ))}

              <div className="p-4 bg-[#181818] rounded-[4px] space-y-2 text-xs">
                <span className="text-[11px] text-[#858585] block font-mono">
                  Character Glyphs
                </span>
                <div
                  style={{ fontFamily: fontFamilyName, fontSize: '18px' }}
                  className="text-[#FFFFFF] leading-relaxed"
                >
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ
                  <br />
                  abcdefghijklmnopqrstuvwxyz
                  <br />
                  0123456789 !@#$%^&*()_+-=[]{}|;':",./?
                </div>
              </div>
            </div>
          </div>
        ) : viewerType === 'archive' ? (
          /* 4. Archive & APK Inspector */
          <div className="flex-1 w-full h-full flex flex-col bg-[#141414] overflow-hidden select-text font-sans">
            <div className="h-9 bg-[#181818] px-3 flex items-center justify-between text-xs text-[#CCCCCC]">
              <div className="flex items-center gap-2">
                <Archive size={14} className="text-[#0078D4]" />
                <span className="font-mono font-medium">{activeTab?.name}</span>
                <span className="text-[#858585]">
                  ({formatBytes(assetSize)} • {archiveEntries.length} entries)
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1F1F1F] rounded-[3px]">
                <Search size={11} className="text-[#858585]" />
                <input
                  type="text"
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value)}
                  placeholder="Filter contents in archive..."
                  className="bg-transparent border-none outline-none text-xs text-[#FFFFFF] w-48 font-mono"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#181818]">
              {archiveLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-[#858585] text-xs">
                  <div className="animate-spin h-4 w-4 border-b-2 border-[#0078D4] rounded-full" />
                  <span>Inspecting archive contents...</span>
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="bg-[#1F1F1F] text-[#858585] sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Path</th>
                      <th className="px-3 py-1.5 font-medium w-28 text-right">
                        Size
                      </th>
                      <th className="px-3 py-1.5 font-medium w-28 text-right">
                        Compressed
                      </th>
                      <th className="px-3 py-1.5 font-medium w-40 text-right">
                        Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchiveEntries.map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#252526] text-[#CCCCCC]"
                      >
                        <td className="px-3 py-1 flex items-center gap-1.5 truncate">
                          {item.isDir ? (
                            <Folder size={12} className="text-[#0078D4] shrink-0" />
                          ) : (
                            <File size={12} className="text-[#696969] shrink-0" />
                          )}
                          <span className={item.isDir ? 'text-[#FFFFFF] font-medium' : ''}>
                            {item.name}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-right text-[#858585]">
                          {item.isDir ? '-' : formatBytes(item.size)}
                        </td>
                        <td className="px-3 py-1 text-right text-[#858585]">
                          {item.isDir ? '-' : formatBytes(item.compressedSize)}
                        </td>
                        <td className="px-3 py-1 text-right text-[#696969]">
                          {item.date ? item.date.toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : viewerType === 'hex' ? (
          /* 5. Hex / Binary Inspector */
          <div className="flex-1 w-full h-full flex flex-col bg-[#141414] overflow-hidden select-text font-mono text-xs">
            {/* Hex Bar */}
            <div className="h-9 bg-[#181818] px-3 flex items-center justify-between text-[#CCCCCC]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Binary size={14} className="text-[#0078D4]" />
                  <span className="font-semibold">{activeTab?.name}</span>
                </div>
                <span className="text-[#858585] text-[11px]">
                  {hexMagicDesc || 'Binary File'} • {formatBytes(assetSize)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => loadHexPage(hexPage - 1)}
                  disabled={hexPage <= 0 || hexLoading}
                  className="px-2 py-0.5 rounded-[3px] bg-[#1F1F1F] hover:bg-[#252526] text-[#CCCCCC] disabled:opacity-30"
                >
                  <ChevronLeft size={11} />
                </button>
                <span className="px-2 text-[#858585]">
                  Page {hexPage + 1} of {hexTotalPages}
                </span>
                <button
                  onClick={() => loadHexPage(hexPage + 1)}
                  disabled={hexPage >= hexTotalPages - 1 || hexLoading}
                  className="px-2 py-0.5 rounded-[3px] bg-[#1F1F1F] hover:bg-[#252526] text-[#CCCCCC] disabled:opacity-30"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
            </div>

            {/* Hex Grid Content */}
            <div className="flex-1 p-3 overflow-y-auto leading-[21px] bg-[#141414]">
              {hexLoading ? (
                <div className="flex items-center justify-center h-full text-[#858585]">
                  Loading binary block...
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="text-[#696969] pb-1 mb-1 flex items-center">
                    <span className="w-24 shrink-0 font-bold">OFFSET</span>
                    <span className="w-[320px] shrink-0 font-bold">
                      00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
                    </span>
                    <span className="font-bold">DECODED TEXT</span>
                  </div>

                  {Array.from(
                    { length: Math.ceil(hexBytes.length / 16) },
                    (_, rowIdx) => {
                      const offsetNum = hexPage * HEX_PAGE_SIZE + rowIdx * 16;
                      const offsetStr = offsetNum
                        .toString(16)
                        .padStart(8, '0')
                        .toUpperCase();
                      const rowBytes = hexBytes.slice(
                        rowIdx * 16,
                        rowIdx * 16 + 16
                      );

                      const hexStr1 = Array.from(rowBytes.slice(0, 8))
                        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                        .join(' ')
                        .padEnd(23, ' ');

                      const hexStr2 = Array.from(rowBytes.slice(8, 16))
                        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                        .join(' ')
                        .padEnd(23, ' ');

                      const asciiStr = Array.from(rowBytes)
                        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
                        .join('');

                      return (
                        <div
                          key={rowIdx}
                          className="flex items-center hover:bg-[#1E1E1E] px-1 rounded-[2px]"
                        >
                          <span className="w-24 shrink-0 text-[#0078D4] font-medium">
                            {offsetStr}
                          </span>
                          <span className="w-[320px] shrink-0 text-[#CCCCCC]">
                            <span className="text-[#9CDCFE]">{hexStr1}</span>
                            <span className="text-[#555555] mx-1">|</span>
                            <span className="text-[#CE9178]">{hexStr2}</span>
                          </span>
                          <span className="text-[#4EC9B0] font-sans text-xs">
                            {asciiStr}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 6. Monaco Editor for All Text & Code Formats */
          <div className="flex-1 w-full h-full relative bg-[#1F1F1F]">
            <MonacoEditor
              height="100%"
              language={determineLanguage(activeTab?.name || '')}
              theme={theme}
              value={fileContents}
              beforeMount={setupMonacoEnvironment}
              onChange={(val) => onContentChange(val || '')}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 13,
                lineHeight: 20,
                fontFamily:
                  '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
                fontLigatures: false,
                minimap: { enabled: true },
                automaticLayout: false,
                contextmenu: false,
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
                padding: { top: 8 },
                cursorBlinking: 'blink',
                cursorStyle: 'line',
                renderLineHighlight: 'line',
                roundedSelection: true,
              }}
            />
          </div>
        )
      ) : workspaceOpened ? (
        /* ApkRtool IDE Active Workspace Landing Screen (when workspace is open but no editor tabs) */
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 select-none bg-[#1F1F1F]">
          <div className="max-w-xl w-full flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 flex items-center justify-center rounded-[12px] bg-[#181818] shadow-md p-2.5">
                <img
                  src="/icon.svg"
                  alt="ApkRtool IDE"
                  className="w-full h-full object-contain opacity-90"
                />
              </div>
              <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-[#181818] rounded-full text-xs">
                <FolderOpen size={14} className="text-amber-400" />
                <span className="font-medium text-[#FFFFFF]">{workspaceName || 'Workspace'}</span>
                <span className="text-[10px] text-[#0078D4] font-mono px-1.5 py-0.5 bg-[#0078D4]/10 rounded">WORKSPACE</span>
              </div>
              {workspacePath && (
                <span className="text-[11px] text-[#696969] font-mono max-w-md truncate">
                  {workspacePath}
                </span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="w-full max-w-sm flex flex-col gap-2">
              {onNewTextFile && (
                <button
                  onClick={onNewTextFile}
                  className="w-full bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100 shadow-sm cursor-pointer"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  <span>{t('welcome.newFile', 'New File')}</span>
                  <span className="ml-auto text-[10px] opacity-75 font-mono">Ctrl+N</span>
                </button>
              )}

              <button
                onClick={onTriggerDecompile}
                className="w-full bg-[#181818] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100 cursor-pointer"
              >
                <Play size={13} className="text-[#0078D4]" />
                <span>{t('welcome.decompile', 'Decompile APK')}</span>
                <span className="ml-auto text-[10px] text-[#696969] font-mono">Apktool</span>
              </button>

              <button
                onClick={() => onSelectPanel?.('ai')}
                className="w-full bg-[#181818] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100 cursor-pointer"
              >
                <Sparkles size={13} className="text-[#0078D4]" />
                <span>AI Smali Assistant</span>
              </button>

              {onOpenApkRunner && (
                <button
                  onClick={onOpenApkRunner}
                  className="w-full bg-[#181818] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100 cursor-pointer"
                >
                  <Smartphone size={13} className="text-[#0078D4]" />
                  <span>Launch APK Tester & Emulator</span>
                </button>
              )}
            </div>

            {/* Watermark Keyboard Shortcuts */}
            <div className="w-full max-w-sm pt-2 flex flex-col gap-1.5 text-[11px] text-[#696969]">
              <div className="flex items-center justify-between py-0.5">
                <span>Show All Commands</span>
                <kbd className="px-1.5 py-0.5 bg-[#181818] text-[#CCCCCC] rounded text-[10px] font-mono">Ctrl+Shift+P</kbd>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Go to File</span>
                <kbd className="px-1.5 py-0.5 bg-[#181818] text-[#CCCCCC] rounded text-[10px] font-mono">Ctrl+P</kbd>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Toggle Terminal</span>
                <kbd className="px-1.5 py-0.5 bg-[#181818] text-[#CCCCCC] rounded text-[10px] font-mono">Ctrl+`</kbd>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Build APK</span>
                <kbd className="px-1.5 py-0.5 bg-[#181818] text-[#CCCCCC] rounded text-[10px] font-mono">Ctrl+Shift+B</kbd>
              </div>
            </div>

            <button
              onClick={onOpenDirectory}
              className="text-xs text-[#696969] hover:text-[#CCCCCC] underline cursor-pointer mt-1"
            >
              Open another folder
            </button>
          </div>
        </div>
      ) : (
        /* ApkRtool IDE Modern Welcome Landing Screen */
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 select-none bg-[#1F1F1F]">
          <div className="max-w-xl w-full flex flex-col items-center gap-6">
            {/* Center Header: Logo & Title */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 flex items-center justify-center rounded-[12px] bg-[#181818] shadow-md p-3">
                <img
                  src="/icon.svg"
                  alt="ApkRtool IDE"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-2xl font-semibold text-[#FFFFFF] tracking-tight">
                ApkRtool IDE
              </h1>
            </div>

            {/* Main Action Buttons */}
            <div className="w-full max-w-sm flex flex-col gap-2.5">
              <button
                onClick={onOpenDirectory}
                className="w-full bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100 shadow-sm"
              >
                <FolderOpen size={16} strokeWidth={2} />
                <span>{t('welcome.openFolder', 'Open Folder')}</span>
              </button>

              <button
                onClick={onTriggerDecompile}
                className="w-full bg-[#181818] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100"
              >
                <Play size={14} className="text-[#0078D4]" />
                <span>{t('welcome.decompile', 'Decompile APK')}</span>
              </button>

              <button
                onClick={() => onSelectPanel?.('ai')}
                className="w-full bg-[#181818] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100"
              >
                <Sparkles size={14} className="text-[#0078D4]" />
                <span>AI Smali Assistant</span>
              </button>

              <button
                onClick={onOpenApkRunner}
                className="w-full bg-[#181818] hover:bg-[#252526] text-[#CCCCCC] hover:text-[#FFFFFF] py-2 px-4 rounded-[4px] font-medium text-xs flex items-center justify-center gap-2 transition-colors duration-100"
              >
                <Smartphone size={14} className="text-[#0078D4]" />
                <span>Launch APK Tester & Emulator</span>
              </button>
            </div>

            {/* Recent Workspaces List */}
            {displayedWorkspaces.length > 0 && (
              <div className="w-full max-w-sm flex flex-col gap-2 pt-4">
                <div className="flex items-center justify-between text-xs text-[#696969]">
                  <span className="font-medium tracking-wide uppercase text-[10px]">
                    {t('welcome.recentWorkspaces', 'Recent Workspaces')}
                  </span>
                  {recentList.length > 4 && (
                    <button
                      onClick={() => setShowAllWorkspaces((prev) => !prev)}
                      className="text-[#0078D4] hover:underline cursor-pointer"
                    >
                      {showAllWorkspaces
                        ? 'Show Less'
                        : `Show All (${recentList.length})`}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {displayedWorkspaces.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (item.handle && onOpenRecentWorkspace) {
                          onOpenRecentWorkspace(item.handle);
                        } else {
                          onOpenDirectory();
                        }
                      }}
                      className="w-full text-left p-2 rounded-[3px] hover:bg-[#181818] flex items-center justify-between group transition-colors duration-100"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs text-[#CCCCCC] group-hover:text-[#FFFFFF] truncate font-medium">
                          {item.name}
                        </span>
                        {item.path && (
                          <span className="text-[10px] text-[#696969] truncate">
                            {item.path}
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-[#696969] group-hover:text-[#0078D4] shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monaco Floating AI Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-[#181818] shadow-2xl rounded-[4px] py-1 text-xs text-[#CCCCCC] flex flex-col min-w-[200px]"
          onClick={() => setContextMenu(null)}
        >
          <div className="px-3 py-1 font-semibold text-[10px] text-[#0078D4] uppercase tracking-wider">
            AI Smali Assistant
          </div>
          <button
            onClick={() => onTriggerContextAi('explain', contextMenu.text)}
            className="px-3 py-1.5 text-left hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
          >
            <Cpu size={13} />
            <span>Explain Logic (Smali)</span>
          </button>
          <button
            onClick={() => onTriggerContextAi('javadoc', contextMenu.text)}
            className="px-3 py-1.5 text-left hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
          >
            <Sparkles size={13} />
            <span>Generate Java Pseudocode</span>
          </button>
          <button
            onClick={() => onTriggerContextAi('audit', contextMenu.text)}
            className="px-3 py-1.5 text-left hover:bg-[#0078D4] hover:text-white flex items-center gap-2 transition-colors duration-75"
          >
            <ShieldAlert size={13} />
            <span>Audit for Vulnerabilities</span>
          </button>
        </div>
      )}
    </div>
  );
}
