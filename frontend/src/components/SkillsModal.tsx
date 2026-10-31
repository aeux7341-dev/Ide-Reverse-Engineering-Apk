import { useState, useEffect } from 'react';
import { X, Sparkles, Download, Trash2, Power, ExternalLink, RefreshCw } from 'lucide-react';

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  instructions: string;
  enabled: boolean;
  builtin?: boolean;
  source?: string;
}

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusMessage?: (msg: string) => void;
}

export default function SkillsModal({ isOpen, onClose, onStatusMessage }: SkillsModalProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [githubInput, setGithubInput] = useState('');
  const [installing, setInstalling] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

  const electronAPI = (window as any).electronAPI;

  const loadSkills = async () => {
    setLoading(true);
    try {
      if (electronAPI?.skillList) {
        const list = await electronAPI.skillList();
        setSkills(list);
      } else {
        const res = await fetch('/api/skills');
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch (err: any) {
      console.warn('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSkills();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    try {
      if (electronAPI?.skillToggle) {
        await electronAPI.skillToggle(id, !currentEnabled);
      }
      setSkills((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !currentEnabled } : s))
      );
      if (selectedSkill?.id === id) {
        setSelectedSkill((prev) => (prev ? { ...prev, enabled: !currentEnabled } : null));
      }
      onStatusMessage?.(`Skill ${id} ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  const handleInstallGithub = async () => {
    if (!githubInput.trim()) return;
    setInstalling(true);
    try {
      let installed: SkillItem | null = null;
      if (electronAPI?.skillInstallGithub) {
        installed = await electronAPI.skillInstallGithub(githubInput.trim());
      } else {
        const res = await fetch('/api/skills/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoOrUrl: githubInput.trim() }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Install failed');
        installed = data.skill;
      }

      setGithubInput('');
      await loadSkills();
      onStatusMessage?.(`Skill installed: ${installed?.name || 'GitHub Skill'}`);
      if (installed) setSelectedSkill(installed);
    } catch (err: any) {
      alert(`Failed to install skill from GitHub: ${err.message}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(`Are you sure you want to remove skill "${id}"?`)) return;
    try {
      if (electronAPI?.skillRemove) {
        await electronAPI.skillRemove(id);
      }
      await loadSkills();
      if (selectedSkill?.id === id) setSelectedSkill(null);
      onStatusMessage?.(`Removed skill: ${id}`);
    } catch (err: any) {
      alert(`Failed to delete skill: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#181818] rounded-[8px] w-full max-w-4xl h-[620px] flex flex-col shadow-2xl overflow-hidden text-[#CCCCCC]">
        {/* Header */}
        <div className="h-11 px-4 flex items-center justify-between bg-[#1F1F1F]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#0078D4]" />
            <span className="font-semibold text-sm text-white">Skills & Extensions Catalog</span>
            <span className="text-[11px] text-[#696969] ml-1">
              ({skills.length} available, {skills.filter((s) => s.enabled).length} active)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[3px] text-[#858585] hover:text-white hover:bg-[#252526] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* GitHub Installer Bar */}
        <div className="p-3 bg-[#141414] flex items-center gap-2">
          <Download size={14} className="text-[#0078D4] shrink-0" />
          <input
            type="text"
            value={githubInput}
            onChange={(e) => setGithubInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInstallGithub();
            }}
            placeholder="Install skill from GitHub (e.g. bergside/awesome-design-skills, owner/repo, or raw markdown URL)..."
            className="flex-1 bg-[#1F1F1F] rounded-[4px] px-3 py-1.5 text-xs text-white placeholder-[#696969] outline-none focus:ring-1 focus:ring-[#0078D4]"
          />
          <button
            onClick={handleInstallGithub}
            disabled={installing || !githubInput.trim()}
            className="bg-[#0078D4] hover:bg-[#1084d8] text-white px-3.5 py-1.5 rounded-[4px] text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 transition-colors shrink-0"
          >
            {installing ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            <span>Install Skill</span>
          </button>
        </div>

        {/* Content split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Skills List */}
          <div className="w-1/2 overflow-y-auto p-2 space-y-1.5 bg-[#181818]">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-xs text-[#858585]">
                Loading skills...
              </div>
            ) : (
              skills.map((s) => {
                const isSelected = selectedSkill?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSkill(s)}
                    className={`p-3 rounded-[5px] cursor-pointer transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-[#0078D4]/20'
                        : 'bg-[#1F1F1F] hover:bg-[#252526]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white font-mono">
                          {s.name}
                        </span>
                        {s.builtin && (
                          <span className="text-[10px] bg-[#2B2B2B] text-[#9CDCFE] px-1.5 py-0.2 rounded font-mono">
                            Built-in
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(s.id, s.enabled);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                            s.enabled
                              ? 'bg-[#0078D4] text-[#FFFFFF]'
                              : 'bg-[#2B2B2B] text-[#696969]'
                          }`}
                        >
                          <Power size={10} />
                          <span>{s.enabled ? 'Active' : 'Disabled'}</span>
                        </button>
                        {!s.builtin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(s.id);
                            }}
                            className="text-[#696969] hover:text-[#FFFFFF] p-1 rounded"
                            title="Remove Skill"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#858585] line-clamp-2 leading-relaxed">
                      {s.description}
                    </p>
                    {s.triggers && s.triggers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {s.triggers.slice(0, 4).map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] bg-[#141414] text-[#696969] px-1.5 py-0.2 rounded font-mono"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Skill Details Preview */}
          <div className="w-1/2 flex flex-col bg-[#141414] overflow-hidden">
            {selectedSkill ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden select-text">
                <div className="p-4 bg-[#181818] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white font-mono">
                      {selectedSkill.name}
                    </h3>
                    <span className="text-[10px] font-mono text-[#858585]">
                      ID: {selectedSkill.id}
                    </span>
                  </div>
                  <p className="text-xs text-[#858585] leading-relaxed">
                    {selectedSkill.description}
                  </p>
                  {selectedSkill.source && (
                    <div className="text-[10px] text-[#0078D4] truncate flex items-center gap-1">
                      <ExternalLink size={10} />
                      <span>{selectedSkill.source}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
                  <div className="text-[11px] text-[#0078D4] font-semibold uppercase tracking-wider">
                    Skill System Prompt Instructions:
                  </div>
                  <div className="p-3 bg-[#181818] rounded-[4px] whitespace-pre-wrap text-[#CCCCCC] text-[11px] leading-relaxed">
                    {selectedSkill.instructions}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#696969] gap-2">
                <Sparkles size={24} className="text-[#383838]" />
                <p className="text-xs">Select a skill from the list to view its directives and triggers.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 px-4 flex items-center justify-between bg-[#1F1F1F] text-xs">
          <span className="text-[11px] text-[#858585]">
            Enabled skills are injected into the ApkRtool IDE Autonomous Agent system prompt.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#252526] hover:bg-[#2F2F2F] text-white rounded-[3px] text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
