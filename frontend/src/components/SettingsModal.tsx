import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import {
  Globe,
  Key,
  Cpu,
  Palette,
  Sparkles,
  Info,
  X,
  Square,
  Check,
  RotateCw,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import { useI18n, LanguageCode, LANGUAGES } from '../utils/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  onGeminiApiKeyChange: (keys: string) => void;
  decompilerType: 'apktool' | 'jadx' | 'smali';
  onSelectDecompiler: (type: 'apktool' | 'jadx') => void;
  compilerBackend: 'aapt2' | 'aapt';
  onSelectCompilerBackend: (backend: 'aapt2' | 'aapt') => void;
  theme: string;
  onSelectTheme: (themeId: string) => void;
  onOpenSkillsModal: () => void;
  onOpenMcpModal: () => void;
}

const AVAILABLE_THEMES = [
  { id: 'dark-default', name: 'Antigravity Dark (Default)', bg: '#181818', accent: '#0078D4' },
  { id: 'deep-forest', name: 'Emerald Forest', bg: '#0F1E19', accent: '#10B981' },
  { id: 'cyber-neon', name: 'Cyber Neon', bg: '#0D1117', accent: '#8B5CF6' },
  { id: 'dark-blue', name: 'Midnight Cobalt', bg: '#0B132B', accent: '#3B82F6' },
  { id: 'monokai', name: 'Monokai Pro', bg: '#2D2A2E', accent: '#FFD866' },
  { id: 'high-contrast', name: 'High Contrast Obsidian', bg: '#000000', accent: '#FFFFFF' },
];

type SettingsTab = 'language' | 'ai' | 'decompiler' | 'appearance' | 'plugins' | 'about';

export default function SettingsModal({
  isOpen,
  onClose,
  geminiApiKey,
  onGeminiApiKeyChange,
  decompilerType,
  onSelectDecompiler,
  compilerBackend,
  onSelectCompilerBackend,
  theme,
  onSelectTheme,
  onOpenSkillsModal,
  onOpenMcpModal,
}: SettingsModalProps) {
  const { lang, setLang, t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('language');
  const [isMaximized, setIsMaximized] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.updaterCheck) {
      setUpdateCheckStatus('Updater only active in desktop Electron runtime.');
      return;
    }
    setCheckingUpdate(true);
    setUpdateCheckStatus('Checking GitHub Releases...');
    try {
      const res = await electronAPI.updaterCheck();
      if (res?.error) {
        setUpdateCheckStatus(res.error);
      } else {
        setUpdateCheckStatus('Release check completed.');
      }
    } catch (err: any) {
      setUpdateCheckStatus(err?.message || 'Check failed.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Draggable Window State
  const windowWidth = 840;
  const windowHeight = 580;
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Center window on initial open or screen resize
  useEffect(() => {
    if (isOpen) {
      const centerX = Math.max(20, Math.round((window.innerWidth - windowWidth) / 2));
      const centerY = Math.max(20, Math.round((window.innerHeight - windowHeight) / 2));
      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 120, moveEvent.clientX - dragOffsetRef.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, moveEvent.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) return null;

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
    { id: 'language', label: t('settings.tab.language', 'Language'), icon: Globe },
    { id: 'ai', label: t('settings.tab.ai', 'AI & Key Pool'), icon: Key },
    { id: 'decompiler', label: t('settings.tab.decompiler', 'Decompiler & Build'), icon: Cpu },
    { id: 'appearance', label: t('settings.tab.appearance', 'Appearance'), icon: Palette },
    { id: 'plugins', label: t('settings.tab.plugins', 'Skills & MCP'), icon: Sparkles },
    { id: 'about', label: t('settings.tab.about', 'About & System'), icon: Info },
  ];

  const parsedKeyCount = geminiApiKey
    ? geminiApiKey
        .split(/[\n,]/)
        .map((k) => k.trim())
        .filter(Boolean).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* Draggable Desktop Window Container */}
      <div
        style={
          isMaximized
            ? { top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 }
            : {
                top: `${position.y}px`,
                left: `${position.x}px`,
                width: `${windowWidth}px`,
                height: `${windowHeight}px`,
              }
        }
        className="fixed pointer-events-auto bg-[#181818] border border-[#2B2B2B] rounded-[8px] shadow-2xl flex flex-col overflow-hidden text-[#CCCCCC] transition-shadow duration-150"
      >
        {/* Window Titlebar (Draggable Handle) */}
        <div
          onMouseDown={handleMouseDown}
          className="h-10 px-3 bg-[#1F1F1F] border-b border-[#2B2B2B] flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2">
            <Sliders size={15} className="text-[#0078D4]" />
            <span className="font-semibold text-xs text-[#FFFFFF] tracking-wide">
              {t('settings.title', 'Settings — ApkRtool IDE')}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 bg-[#282828] text-[#858585] rounded font-mono">
              v0.3.2
            </span>
          </div>

          {/* Window Control Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMaximized((p) => !p)}
              className="p-1 hover:bg-[#2A2D2E] text-[#858585] hover:text-[#FFFFFF] rounded-[3px] transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Square size={11} />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#E81123] text-[#858585] hover:text-[#FFFFFF] rounded-[3px] transition-colors"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Window Main Body: Left Navbar + Right Content */}
        <div className="flex-1 flex overflow-hidden select-text">
          {/* Left Navigation Bar */}
          <div className="w-56 bg-[#181818] border-r border-[#252526] flex flex-col py-2 select-none shrink-0">
            <div className="px-3 pb-2 text-[10px] uppercase font-bold tracking-wider text-[#696969]">
              Preferences
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] text-xs font-medium text-left transition-colors duration-100 ${
                      isActive
                        ? 'bg-[#0078D4] text-[#FFFFFF]'
                        : 'text-[#858585] hover:bg-[#252526] hover:text-[#CCCCCC]'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-white' : 'text-[#858585]'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto px-3 pt-3 border-t border-[#252526] text-[10px] text-[#696969]">
              <span>Active: </span>
              <span className="text-[#0078D4] font-medium">
                {LANGUAGES.find((l) => l.code === lang)?.name || 'English'}
              </span>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 bg-[#1F1F1F] p-6 overflow-y-auto">
            {/* 1. LANGUAGE SETTINGS */}
            {activeTab === 'language' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <Globe size={16} className="text-[#0078D4]" />
                    <span>{t('settings.lang.title', 'Display Language')}</span>
                  </h3>
                  <p className="text-xs text-[#858585] mt-1">
                    {t(
                      'settings.lang.desc',
                      'Select your preferred interface language. Changes apply immediately across the entire IDE.'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-2">
                  {LANGUAGES.map((l) => {
                    const isSelected = lang === l.code;
                    return (
                      <button
                        key={l.code}
                        onClick={() => setLang(l.code as LanguageCode)}
                        className={`p-3 rounded-[6px] border text-left flex items-center justify-between transition-all duration-100 ${
                          isSelected
                            ? 'bg-[#0078D4]/15 border-[#0078D4] text-white shadow-sm'
                            : 'bg-[#181818] border-[#2B2B2B] hover:border-[#3E3E3E] text-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl select-none">{l.flag}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">{l.nativeName}</span>
                            <span className="text-[10px] text-[#858585]">{l.name}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 bg-[#0078D4] text-white px-2 py-0.5 rounded-[3px] text-[10px] font-medium">
                            <Check size={11} strokeWidth={2.5} />
                            <span>Active</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. AI & KEY POOL SETTINGS */}
            {activeTab === 'ai' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <Key size={16} className="text-[#0078D4]" />
                    <span>{t('settings.ai.title', 'AI API Key Pool (Bulk & Failover)')}</span>
                  </h3>
                  <p className="text-xs text-[#858585] mt-1">
                    {t(
                      'settings.ai.desc',
                      'Enter one or multiple API keys separated by commas or lines for automatic rotation and quota failover.'
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2 bg-[#181818] p-4 rounded-[6px] border border-[#2B2B2B]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#CCCCCC]">Gemini API Keys</span>
                    <span className="text-[10px] bg-[#252526] px-2 py-0.5 rounded text-[#0078D4] font-mono font-medium">
                      {parsedKeyCount} {parsedKeyCount === 1 ? 'Key Configured' : 'Keys in Pool'}
                    </span>
                  </div>

                  <textarea
                    rows={6}
                    value={geminiApiKey}
                    onChange={(e) => onGeminiApiKeyChange(e.target.value)}
                    placeholder={t(
                      'settings.ai.placeholder',
                      'Enter one or multiple API keys (separated by commas or newlines)...'
                    )}
                    className="w-full bg-[#1F1F1F] border border-[#2B2B2B] rounded-[4px] p-2.5 text-xs text-[#FFFFFF] placeholder-[#696969] focus:outline-none focus:border-[#0078D4] font-mono leading-relaxed"
                  />

                  <div className="flex items-center gap-2 text-[11px] text-[#858585] mt-1">
                    <RotateCw size={12} className="text-[#0078D4] shrink-0" />
                    <span>
                      Keys rotate round-robin across chat, smali explanations, and autonomous agent tasks.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. DECOMPILER & BUILD */}
            {activeTab === 'decompiler' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <Cpu size={16} className="text-[#0078D4]" />
                    <span>{t('settings.decompile.title', 'Decompiler & Build Tools')}</span>
                  </h3>
                  <p className="text-xs text-[#858585] mt-1">
                    Select preferred reverse engineering engine and Android build pipeline.
                  </p>
                </div>

                {/* Decompiler selection */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#CCCCCC]">Default Decompiler Engine</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectDecompiler('apktool')}
                      className={`p-3.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                        decompilerType === 'apktool' || decompilerType === 'smali'
                          ? 'bg-[#0078D4]/15 border-[#0078D4] text-white'
                          : 'bg-[#181818] border-[#2B2B2B] text-[#858585] hover:text-[#CCCCCC]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">Apktool (Smali & Res)</span>
                        <span className="text-[9px] bg-[#252526] px-1.5 py-0.5 rounded text-[#0078D4] font-bold">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-[#858585]">
                        {t(
                          'settings.decompile.apktoolDesc',
                          'Decompile to Smali bytecode, resources, and AndroidManifest.xml.'
                        )}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectDecompiler('jadx')}
                      className={`p-3.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                        decompilerType === 'jadx'
                          ? 'bg-[#0078D4]/15 border-[#0078D4] text-white'
                          : 'bg-[#181818] border-[#2B2B2B] text-[#858585] hover:text-[#CCCCCC]'
                      }`}
                    >
                      <span className="font-semibold text-xs text-white">JADX (Java Sources)</span>
                      <p className="text-[11px] text-[#858585]">
                        {t(
                          'settings.decompile.jadxDesc',
                          'Decompile to readable high-level Java source code (Analysis only).'
                        )}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Compiler backend selection */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#252526]">
                  <span className="text-xs font-semibold text-[#CCCCCC]">APK Compiler Backend</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectCompilerBackend('aapt2')}
                      className={`p-3.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                        compilerBackend === 'aapt2'
                          ? 'bg-[#0078D4]/15 border-[#0078D4] text-white'
                          : 'bg-[#181818] border-[#2B2B2B] text-[#858585] hover:text-[#CCCCCC]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">AAPT2 Pipeline</span>
                        <span className="text-[9px] bg-[#252526] px-1.5 py-0.5 rounded text-[#10B981] font-bold">
                          Modern
                        </span>
                      </div>
                      <p className="text-[11px] text-[#858585]">
                        {t('settings.compiler.aapt2Desc', 'Modern incremental Android asset packaging tool.')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectCompilerBackend('aapt')}
                      className={`p-3.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                        compilerBackend === 'aapt'
                          ? 'bg-[#0078D4]/15 border-[#0078D4] text-white'
                          : 'bg-[#181818] border-[#2B2B2B] text-[#858585] hover:text-[#CCCCCC]'
                      }`}
                    >
                      <span className="font-semibold text-xs text-white">Legacy AAPT</span>
                      <p className="text-[11px] text-[#858585]">
                        {t('settings.compiler.legacyDesc', 'Legacy AAPT pipeline for older Android compatibility.')}
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. APPEARANCE & THEMES */}
            {activeTab === 'appearance' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <Palette size={16} className="text-[#0078D4]" />
                    <span>{t('settings.theme.title', 'Theme & Accent')}</span>
                  </h3>
                  <p className="text-xs text-[#858585] mt-1">
                    {t('settings.theme.desc', 'Customize UI theme colors and contrast.')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  {AVAILABLE_THEMES.map((t) => {
                    const isSelected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTheme(t.id)}
                        className={`p-3.5 rounded-[6px] border flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-[#0078D4]/15 border-[#0078D4] text-white'
                            : 'bg-[#181818] border-[#2B2B2B] hover:border-[#3E3E3E] text-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-5 h-5 rounded-[4px] border border-white/20 shadow-inner shrink-0"
                            style={{ backgroundColor: t.bg }}
                          />
                          <span className="text-xs font-medium">{t.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] bg-[#0078D4] text-white px-2 py-0.5 rounded-[3px] font-medium">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. SKILLS & MCP EXTENSIONS */}
            {activeTab === 'plugins' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <Sparkles size={16} className="text-[#0078D4]" />
                    <span>Agent Extensions & MCP</span>
                  </h3>
                  <p className="text-xs text-[#858585] mt-1">
                    Manage installed skills, GitHub extensions, and local Model Context Protocol tools.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSkillsModal();
                    }}
                    className="p-4 bg-[#181818] hover:bg-[#252526] border border-[#2B2B2B] rounded-[6px] text-left transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-white text-xs">
                        <Sparkles size={14} className="text-[#0078D4]" />
                        <span>Open Skills Catalog</span>
                      </div>
                      <ExternalLink size={12} className="text-[#858585]" />
                    </div>
                    <p className="text-[11px] text-[#858585]">
                      Install agent skills from GitHub or browse 10+ built-in reverse engineering capabilities.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMcpModal();
                    }}
                    className="p-4 bg-[#181818] hover:bg-[#252526] border border-[#2B2B2B] rounded-[6px] text-left transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-white text-xs">
                        <Cpu size={14} className="text-[#0078D4]" />
                        <span>Manage MCP Servers</span>
                      </div>
                      <ExternalLink size={12} className="text-[#858585]" />
                    </div>
                    <p className="text-[11px] text-[#858585]">
                      Connect stdio and HTTP tool servers exposing ADB, Frida, Ghidra, or custom analysis scripts.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* 6. ABOUT & SYSTEM INFO */}
            {activeTab === 'about' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <Info size={16} className="text-[#0078D4]" />
                    <span>About ApkRtool IDE</span>
                  </h3>
                  <p className="text-xs text-[#858585] mt-1">
                    {t(
                      'settings.about.description',
                      'Modern Android APK Decompiler, Smali Bytecode Editor & Rebuilder'
                    )}
                  </p>
                </div>

                <div className="bg-[#181818] border border-[#2B2B2B] rounded-[6px] p-4 flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[#252526]">
                    <span className="text-[#858585]">Version</span>
                    <span className="font-mono text-white font-medium">0.3.2 (Production Release)</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#252526]">
                    <span className="text-[#858585]">Electron Runtime</span>
                    <span className="font-mono text-white">v31.7.7</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#252526]">
                    <span className="text-[#858585]">Node.js</span>
                    <span className="font-mono text-white">v20.18.0</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#252526]">
                    <span className="text-[#858585]">Supported Languages</span>
                    <span className="font-mono text-[#0078D4]">11 International Languages</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#858585]">Platform</span>
                    <span className="font-mono text-white">Windows x64 (Self-Contained)</span>
                  </div>
                </div>

                {/* Auto-Update Check Panel */}
                <div className="flex items-center justify-between p-3.5 bg-[#181818] border border-[#2B2B2B] rounded-[6px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-white">GitHub Releases Auto-Update</span>
                    <span className="text-[11px] text-[#858585]">
                      {updateCheckStatus || 'Automatically detects, downloads, and applies delta updates from GitHub.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="px-3 py-1.5 bg-[#252526] hover:bg-[#2A2D2E] text-white rounded-[4px] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RotateCw size={12} className={checkingUpdate ? 'animate-spin text-[#0078D4]' : 'text-[#858585]'} />
                    <span>{checkingUpdate ? 'Checking...' : t('updater.check', 'Check for Updates')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Window Footer Status */}
        <div className="h-9 px-4 bg-[#181818] border-t border-[#252526] flex items-center justify-between text-xs select-none">
          <div className="text-[11px] text-[#696969] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>Ready — Settings persist automatically to workspace storage</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#252526] hover:bg-[#2A2D2E] text-white rounded-[3px] text-xs font-medium transition-colors"
          >
            {t('settings.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
