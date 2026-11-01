import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Key,
  Play,
  RotateCcw,
  Layers,
  Sparkles,
  Cpu,
  X,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileText,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Search,
} from 'lucide-react';
import { SkillItem } from './SkillsModal';

export interface ActiveToolItem {
  id: string;
  name: string;
  args?: any;
  output?: string;
  isFinished: boolean;
}

export function ToolExecutionCard({
  name,
  args,
  output,
  isFinished = true,
}: {
  name: string;
  args?: any;
  output?: string;
  isFinished?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  let icon = <Cpu size={12} className="text-[#A371F7] shrink-0" />;
  if (name === 'run_command') icon = <Terminal size={12} className="text-[#0078D4] shrink-0" />;
  else if (name === 'read_file') icon = <FileText size={12} className="text-[#388BFD] shrink-0" />;
  else if (name === 'write_file' || name === 'edit_file') icon = <Edit3 size={12} className="text-[#3FB950] shrink-0" />;
  else if (name === 'glob_files' || name === 'grep_search' || name === 'list_dir') icon = <Search size={12} className="text-[#D29922] shrink-0" />;

  const targetLabel =
    args?.command ||
    args?.path ||
    args?.pattern ||
    args?.repo_or_url ||
    (typeof args === 'string' ? args : '');

  const isError = output && (output.startsWith('Error') || output.includes('Command failed'));

  return (
    <div className="border border-[#2D2D2D] bg-[#1E1E1E] rounded-[4px] overflow-hidden my-1 text-xs">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-[#252526] transition-colors select-none"
      >
        <div className="flex items-center gap-2 truncate">
          {icon}
          <span className="font-mono text-[11px] font-semibold text-[#CCCCCC]">{name}</span>
          {targetLabel && (
            <span className="font-mono text-[10px] text-[#858585] truncate max-w-[190px]">
              {targetLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!isFinished ? (
            <div className="animate-spin h-3 w-3 border-2 border-t-transparent border-[#0078D4] rounded-full" />
          ) : isError ? (
            <AlertCircle size={12} className="text-[#F85149]" />
          ) : (
            <CheckCircle2 size={12} className="text-[#3FB950]" />
          )}
          {expanded ? (
            <ChevronDown size={13} className="text-[#858585]" />
          ) : (
            <ChevronRight size={13} className="text-[#858585]" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#2D2D2D] bg-[#141414] p-2 font-mono text-[10px] space-y-1.5 max-h-56 overflow-y-auto">
          {args && (
            <div>
              <div className="text-[#858585] font-semibold uppercase text-[9px] mb-0.5">Parameters:</div>
              <pre className="text-[#9CDCFE] bg-[#1A1A1A] p-1.5 rounded whitespace-pre-wrap break-all">
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {output && (
            <div>
              <div className="text-[#858585] font-semibold uppercase text-[9px] mb-0.5">Output:</div>
              <pre
                className={`p-1.5 rounded whitespace-pre-wrap break-all font-mono ${
                  isError ? 'text-[#F85149] bg-[#2A1515]' : 'text-[#CCCCCC] bg-[#1A1A1A]'
                }`}
              >
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface AgentStep {
  step: number;
  type: 'status' | 'tool_start' | 'tool_finish' | 'tool_calls' | 'final_response';
  data?: any;
  toolCalls?: any[];
  reasoning?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  steps?: AgentStep[];
  isStreaming?: boolean;
}

interface AiAgentPanelProps {
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeFilePath: string | null;
  fileContents: string;
  workspacePath?: string | null;
  provider?: 'gemini' | 'openai' | 'anthropic';
  setProvider?: (p: 'gemini' | 'openai' | 'anthropic') => void;
  apiKeys?: string;
  setApiKeys?: (keys: string) => void;
  geminiApiKey?: string;
  setGeminiApiKey?: (keys: string) => void;
  openaiApiKey?: string;
  setOpenaiApiKey?: (keys: string) => void;
  openaiBaseUrl?: string;
  setOpenaiBaseUrl?: (url: string) => void;
  anthropicApiKey?: string;
  setAnthropicApiKey?: (keys: string) => void;
  onOpenSkillsModal: () => void;
  onOpenMcpModal: () => void;
  onClose?: () => void;
}

export default function AiAgentPanel({
  chatHistory,
  setChatHistory,
  activeFilePath,
  fileContents,
  workspacePath,
  provider: externalProvider,
  setProvider: setExternalProvider,
  apiKeys = '',
  setApiKeys,
  geminiApiKey = '',
  setGeminiApiKey,
  openaiApiKey = '',
  setOpenaiApiKey,
  openaiBaseUrl = 'https://api.openai.com/v1',
  setOpenaiBaseUrl,
  anthropicApiKey = '',
  setAnthropicApiKey,
  onOpenSkillsModal,
  onOpenMcpModal,
  onClose,
}: AiAgentPanelProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'bulk'>('agent');
  const [query, setQuery] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  const [activeTools, setActiveTools] = useState<ActiveToolItem[]>([]);
  const [activeStatusMsg, setActiveStatusMsg] = useState('');

  // Provider and model options
  const [localProvider, setLocalProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const provider = externalProvider || localProvider;
  const setProvider = setExternalProvider || setLocalProvider;

  const [model, setModel] = useState(provider === 'gemini' ? 'gemini-3.6-flash' : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini');

  // Key stats
  const [keyStats, setKeyStats] = useState<{ totalKeys: number; activeKeyMasked: string } | null>(null);

  const getEffectiveKeys = () => {
    if (provider === 'openai') return openaiApiKey || apiKeys || '';
    if (provider === 'anthropic') return anthropicApiKey || apiKeys || '';
    return geminiApiKey || apiKeys || '';
  };

  const handleUpdateCurrentKeys = (keys: string) => {
    if (provider === 'openai') {
      setOpenaiApiKey?.(keys);
    } else if (provider === 'anthropic') {
      setAnthropicApiKey?.(keys);
    } else {
      setGeminiApiKey?.(keys);
      setApiKeys?.(keys);
    }
  };

  // Skills count & MCP count
  const [activeSkills, setActiveSkills] = useState<SkillItem[]>([]);
  const [mcpServerCount, setMcpServerCount] = useState<number>(0);

  // Bulk API state
  const [bulkTask, setBulkTask] = useState('Audit this file for hardcoded secrets, cryptographic weaknesses, and exported insecure components.');
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ item: string; success: boolean; output?: string; error?: string }>>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const electronAPI = (window as any).electronAPI;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, currentSteps]);

  // Load key stats, skills and MCP count
  const refreshMetadata = async () => {
    try {
      if (electronAPI?.aiGetKeyStats) {
        const stats = await electronAPI.aiGetKeyStats();
        setKeyStats(stats);
      }
      if (electronAPI?.skillList) {
        const list: SkillItem[] = await electronAPI.skillList();
        setActiveSkills(list.filter((s) => s.enabled));
      }
      if (electronAPI?.mcpGetServers) {
        const servers = await electronAPI.mcpGetServers();
        setMcpServerCount(servers.filter((s: any) => s.status === 'running').length);
      }
    } catch {}
  };

  useEffect(() => {
    const curKeys = getEffectiveKeys();
    if (electronAPI?.aiSetKeys && curKeys.trim()) {
      electronAPI.aiSetKeys(curKeys).then((st: any) => setKeyStats(st)).catch(() => {});
    }
    refreshMetadata();
  }, [provider, geminiApiKey, openaiApiKey, anthropicApiKey, apiKeys]);

  // Listen to step events from main process
  useEffect(() => {
    if (electronAPI?.onAiAgentStep) {
      const unsub = electronAPI.onAiAgentStep((step: any) => {
        if (step.type === 'status') {
          setActiveStatusMsg(step.data?.message || 'Processing...');
        } else if (step.type === 'tool_start') {
          setActiveStatusMsg(`Executing: ${step.data?.name}`);
          const toolId = step.data?.id || `tool_${Date.now()}_${Math.random()}`;
          setActiveTools((prev) => [
            ...prev,
            {
              id: toolId,
              name: step.data?.name,
              args: step.data?.args,
              isFinished: false,
            },
          ]);
        } else if (step.type === 'tool_finish') {
          setActiveTools((prev) =>
            prev.map((t) =>
              t.id === step.data?.id || t.name === step.data?.name
                ? { ...t, output: step.data?.output, isFinished: true }
                : t
            )
          );
        }
      });
      return () => unsub();
    }
  }, []);

  // Listen to bulk progress events
  useEffect(() => {
    if (electronAPI?.onAiBulkProgress) {
      const unsub = electronAPI.onAiBulkProgress((prog: any) => {
        setBulkProgress(prog);
      });
      return () => unsub();
    }
  }, []);

  // Handle run agent query
  const handleRunAgent = async (overridePrompt?: string) => {
    const textPrompt = overridePrompt || query;
    if (!textPrompt.trim() || isAgentRunning) return;

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assistant_${Date.now()}`;

    setChatHistory((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: textPrompt },
    ]);
    if (!overridePrompt) setQuery('');

    setIsAgentRunning(true);
    setCurrentSteps([]);
    setActiveTools([]);
    setActiveStatusMsg('Initializing Autonomous Agent...');

    try {
      const effectiveKeys = getEffectiveKeys();
      if (electronAPI?.aiAgentRun) {
        if (effectiveKeys.trim()) {
          await electronAPI.aiSetKeys(effectiveKeys);
        }

        const res = await electronAPI.aiAgentRun({
          prompt: textPrompt,
          workspacePath,
          activeFile: activeFilePath,
          fileContent: fileContents,
          provider,
          model,
          apiKeys: effectiveKeys,
          baseUrl: provider === 'openai' ? (openaiBaseUrl || 'https://api.openai.com/v1') : undefined,
        });

        setChatHistory((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: res.response,
            steps: res.executionTrace,
          },
        ]);
      } else {
        const res = await fetch('/api/ai/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKeys,
          },
          body: JSON.stringify({
            prompt: textPrompt,
            workspacePath,
            fileName: activeFilePath,
            fileContent: fileContents,
            provider,
            model,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Agent execution failed');

        setChatHistory((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: data.response,
            steps: data.executionTrace,
          },
        ]);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          text: `⚠️ Agent execution error: ${err.message}`,
        },
      ]);
    } finally {
      setIsAgentRunning(false);
      setCurrentSteps([]);
      setActiveStatusMsg('');
      refreshMetadata();
    }
  };

  // Run Bulk API batch
  const handleRunBulk = async () => {
    if (!bulkTask.trim() || isBulkRunning) return;

    const itemsToProcess = [];
    if (activeFilePath && fileContents) {
      itemsToProcess.push({ name: activeFilePath, content: fileContents });
    }

    if (itemsToProcess.length === 0) {
      alert('Please open a file or workspace before running Bulk API batch.');
      return;
    }

    setIsBulkRunning(true);
    setBulkResults([]);
    setBulkProgress({ completed: 0, total: itemsToProcess.length });

    try {
      const effectiveKeys = getEffectiveKeys();
      if (electronAPI?.aiBulkBatch) {
        if (effectiveKeys.trim()) {
          await electronAPI.aiSetKeys(effectiveKeys);
        }

        const res = await electronAPI.aiBulkBatch({
          items: itemsToProcess,
          taskPrompt: bulkTask,
          provider,
          model,
          apiKeys: effectiveKeys,
          baseUrl: provider === 'openai' ? (openaiBaseUrl || 'https://api.openai.com/v1') : undefined,
          concurrency: 2,
        });
        setBulkResults(res);
      } else {
        alert('Bulk API requires Electron runtime.');
      }
    } catch (err: any) {
      alert(`Bulk batch failed: ${err.message}`);
    } finally {
      setIsBulkRunning(false);
    }
  };

  return (
    <aside className="w-96 min-w-[340px] max-w-[480px] bg-[#181818] flex flex-col h-full overflow-hidden select-none z-10 shrink-0">
      {/* Top Header */}
      <div className="h-9 px-3 bg-[#181818] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-[#0078D4]" />
          <span className="font-semibold text-[#FFFFFF] tracking-wide uppercase text-[11px]">
            AI Agent
          </span>
        </div>

        {/* Tab mode switches */}
        <div className="flex items-center bg-[#1F1F1F] p-0.5 rounded-[4px]">
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-2 py-0.5 rounded-[3px] text-[10px] font-medium transition-colors ${
              activeTab === 'agent'
                ? 'bg-[#0078D4] text-[#FFFFFF]'
                : 'text-[#696969] hover:text-[#FFFFFF]'
            }`}
          >
            Autonomous
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-2 py-0.5 rounded-[3px] text-[10px] font-medium transition-colors ${
              activeTab === 'bulk'
                ? 'bg-[#0078D4] text-[#FFFFFF]'
                : 'text-[#696969] hover:text-[#FFFFFF]'
            }`}
          >
            Bulk API
          </button>
        </div>

        <div className="flex items-center gap-1">
          {chatHistory.length > 0 && (
            <button
              onClick={() => setChatHistory([])}
              className="p-1 rounded text-[#696969] hover:text-[#FFFFFF] hover:bg-[#1F1F1F] transition-colors"
              title="Clear Chat History"
            >
              <Trash2 size={13} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-[#696969] hover:text-[#FFFFFF] hover:bg-[#1F1F1F] transition-colors"
              title="Close Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Model & Key Pool Bar */}
      <div className="px-3 py-1.5 bg-[#1F1F1F] flex items-center justify-between text-[11px] shrink-0 gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as any;
              setProvider(p);
              if (p === 'gemini') setModel('gemini-3.6-flash');
              else if (p === 'anthropic') setModel('claude-3-5-sonnet-20241022');
              else setModel('gpt-4o-mini');
            }}
            className="bg-[#181818] rounded-[3px] px-2 py-0.5 text-[#FFFFFF] text-[10px] outline-none"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI/DeepSeek</option>
            <option value="anthropic">Claude</option>
          </select>

          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[#181818] rounded-[3px] px-2 py-0.5 text-[#FFFFFF] text-[10px] flex-1 min-w-0 outline-none font-mono"
            placeholder="model..."
          />
        </div>

        {/* Key Pool status pill */}
        <button
          onClick={() => {
            const curKeys = getEffectiveKeys();
            const providerName =
              provider === 'gemini'
                ? 'Google Gemini'
                : provider === 'openai'
                ? 'OpenAI / DeepSeek'
                : 'Anthropic Claude';
            const keys = prompt(
              `${providerName} API Key Pool (enter comma or newline separated keys):`,
              curKeys
            );
            if (keys !== null) {
              handleUpdateCurrentKeys(keys);
            }
          }}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#181818] rounded-[3px] text-[#696969] hover:text-[#FFFFFF] transition-colors shrink-0"
          title={`Click to manage ${provider} API key pool`}
        >
          <Key size={10} className="text-[#0078D4]" />
          <span className="font-mono text-[9px]">
            {keyStats?.totalKeys ? `${keyStats.totalKeys} Keys` : 'No Keys'}
          </span>
        </button>
      </div>

      {/* OpenAI / DeepSeek Base URL bar if openai is active */}
      {provider === 'openai' && (
        <div className="px-3 py-1 bg-[#181818] border-b border-[#2B2B2B] flex items-center gap-1.5 text-[10px]">
          <span className="text-[#858585] font-mono shrink-0">Base URL:</span>
          <input
            type="text"
            value={openaiBaseUrl || 'https://api.openai.com/v1'}
            onChange={(e) => setOpenaiBaseUrl?.(e.target.value)}
            placeholder="https://api.openai.com/v1 (or https://api.deepseek.com/v1)"
            className="bg-[#1F1F1F] rounded px-1.5 py-0.5 text-[#FFFFFF] text-[10px] flex-1 min-w-0 outline-none font-mono"
          />
        </div>
      )}

      {/* Skills & MCP Button Bar */}
      <div className="px-3 py-1.5 bg-[#181818] flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={onOpenSkillsModal}
          className="flex-1 px-2 py-1 bg-[#1F1F1F] hover:bg-[#252526] text-[#FFFFFF] rounded-[3px] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
          title="View all skills in new window"
        >
          <Sparkles size={12} className="text-[#0078D4]" />
          <span>Skills Catalog ({activeSkills.length})</span>
        </button>

        <button
          onClick={onOpenMcpModal}
          className="flex-1 px-2 py-1 bg-[#1F1F1F] hover:bg-[#252526] text-[#FFFFFF] rounded-[3px] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
          title="View MCP servers in new window"
        >
          <Cpu size={12} className="text-[#0078D4]" />
          <span>MCP Servers ({mcpServerCount})</span>
        </button>
      </div>

      {/* Tab 1: Autonomous Agent Chat & Tool Execution */}
      {activeTab === 'agent' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1F1F1F]">
          {/* Messages & Trace Area */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 select-text font-sans">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 gap-2 text-[#696969]">
                <div className="w-10 h-10 flex items-center justify-center bg-[#181818] rounded-[8px] mb-1">
                  <Bot size={20} className="text-[#0078D4]" />
                </div>
                <p className="font-semibold text-[#FFFFFF] text-xs">ApkRtool Autonomous Agent</p>
                <p className="text-[11px] leading-relaxed max-w-xs text-[#696969]">
                  Reverse engineering assistant with file tools, grep search, shell execution, MCP servers, and GitHub skills.
                </p>
                <div className="flex flex-col gap-1.5 w-full mt-2">
                  {[
                    'Audit AndroidManifest.xml for exported activities',
                    'Explain Smali method in active file',
                    'Search for AES cipher instances',
                    'Generate Frida hook for SSL unpinning',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRunAgent(preset)}
                      className="px-2.5 py-1.5 bg-[#181818] hover:bg-[#252526] text-[#FFFFFF] rounded-[3px] text-[11px] text-left transition-colors truncate"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[95%] rounded-[4px] p-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#0078D4]/20 self-end text-[#FFFFFF]'
                      : 'bg-[#181818] self-start text-[#FFFFFF]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-semibold text-[9px] uppercase tracking-wider ${
                        msg.sender === 'user' ? 'text-[#0078D4]' : 'text-[#696969]'
                      }`}
                    >
                      {msg.sender === 'user' ? 'YOU' : 'AUTONOMOUS AGENT'}
                    </span>
                  </div>

                  {/* Render Execution Steps Cards if present */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="my-2 space-y-1">
                      {msg.steps.map((st, i) => (
                        <React.Fragment key={i}>
                          {st.type === 'tool_calls' &&
                            st.toolCalls &&
                            st.toolCalls.map((tc, tcIdx) => {
                              let fnArgs = tc.parsedArgs;
                              if (!fnArgs && tc.function?.arguments) {
                                try {
                                  fnArgs =
                                    typeof tc.function.arguments === 'string'
                                      ? JSON.parse(tc.function.arguments)
                                      : tc.function.arguments;
                                } catch {
                                  fnArgs = tc.function.arguments;
                                }
                              }
                              return (
                                <ToolExecutionCard
                                  key={tc.id || tcIdx}
                                  name={tc.function?.name || 'tool'}
                                  args={fnArgs}
                                  output={tc.output}
                                  isFinished={true}
                                />
                              );
                            })}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                </div>
              ))
            )}

            {/* In-Flight Agent Running Indicator */}
            {isAgentRunning && (
              <div className="bg-[#181818] rounded-[4px] p-2.5 self-start flex flex-col gap-2 text-xs text-[#696969] max-w-[95%] w-full">
                <div className="flex items-center gap-2 text-[#0078D4] font-medium">
                  <div className="animate-spin h-3.5 w-3.5 border-2 border-t-transparent border-[#0078D4] rounded-full shrink-0" />
                  <span className="truncate">{activeStatusMsg || 'Agent thinking...'}</span>
                </div>

                {activeTools.length > 0 && (
                  <div className="space-y-1">
                    {activeTools.map((t) => (
                      <ToolExecutionCard
                        key={t.id}
                        name={t.name}
                        args={t.args}
                        output={t.output}
                        isFinished={t.isFinished}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Box */}
          <div className="p-2 bg-[#181818] flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunAgent();
                }}
                disabled={isAgentRunning}
                placeholder="Ask agent to audit, patch Smali, or run commands..."
                className="flex-1 bg-[#1F1F1F] rounded-[3px] px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#696969] outline-none focus:ring-1 focus:ring-[#0078D4]"
              />
              <button
                onClick={() => handleRunAgent()}
                disabled={isAgentRunning || !query.trim()}
                className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] p-2 rounded-[3px] disabled:opacity-40 transition-colors shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
            {activeFilePath && (
              <div className="text-[10px] text-[#696969] flex items-center justify-between px-1">
                <span className="truncate max-w-[240px]">Context: {activeFilePath.split('/').pop()}</span>
                <span className="text-[#0078D4] font-medium">Active</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Bulk API Batch Runner */}
      {activeTab === 'bulk' && (
        <div className="flex-1 flex flex-col p-3 bg-[#1F1F1F] overflow-y-auto space-y-3">
          <div className="bg-[#181818] rounded-[4px] p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-[#0078D4]" />
              <span className="font-semibold text-[#FFFFFF] text-xs">Bulk API Batch Runner</span>
            </div>
            <p className="text-[11px] text-[#696969] leading-relaxed">
              Dispatch repetitive reverse-engineering audit tasks across your API key pool concurrently.
            </p>

            <div>
              <label className="text-[10px] font-medium text-[#696969] block mb-1">
                Batch Prompt Directive
              </label>
              <textarea
                value={bulkTask}
                onChange={(e) => setBulkTask(e.target.value)}
                rows={3}
                className="w-full bg-[#1F1F1F] rounded-[3px] p-2 text-xs text-[#FFFFFF] outline-none focus:ring-1 focus:ring-[#0078D4] font-sans"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-[#696969] truncate max-w-[180px]">
                Target: {activeFilePath ? activeFilePath.split('/').pop() : 'Open File'}
              </div>
              <button
                onClick={handleRunBulk}
                disabled={isBulkRunning}
                className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] px-3 py-1 rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
              >
                {isBulkRunning ? (
                  <RotateCcw size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                <span>Start Batch</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {bulkProgress && (
            <div className="bg-[#181818] rounded-[4px] p-2.5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#696969] text-[10px]">Batch Progress</span>
                <span className="text-[#FFFFFF] font-mono text-[10px]">
                  {bulkProgress.completed} / {bulkProgress.total}
                </span>
              </div>
              <div className="w-full bg-[#1F1F1F] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#0078D4] h-full transition-all duration-200"
                  style={{
                    width: `${(bulkProgress.completed / Math.max(1, bulkProgress.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Results table */}
          {bulkResults.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#FFFFFF]">Batch Results</span>
              <div className="space-y-1.5">
                {bulkResults.map((res, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-[#181818] rounded-[3px] space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#FFFFFF] text-[11px] truncate">{res.item}</span>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                          res.success ? 'bg-[#0078D4] text-[#FFFFFF]' : 'bg-[#2B2B2B] text-[#696969]'
                        }`}
                      >
                        {res.success ? 'SUCCESS' : 'FAILED'}
                      </span>
                    </div>
                    {res.output && (
                      <div className="p-2 bg-[#1F1F1F] rounded text-[10px] whitespace-pre-wrap text-[#FFFFFF] select-text">
                        {res.output}
                      </div>
                    )}
                    {res.error && (
                      <div className="text-[#696969] text-[10px]">{res.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
