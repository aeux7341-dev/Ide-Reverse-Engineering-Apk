import { useState, useEffect } from 'react';
import { X, Cpu, Play, Square, RefreshCw, Plus, Wrench } from 'lucide-react';

interface McpServerItem {
  name: string;
  config: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    autoStart?: boolean;
  };
  status: 'running' | 'stopped' | 'error';
  toolsCount: number;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
}

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusMessage?: (msg: string) => void;
}

export default function McpModal({ isOpen, onClose, onStatusMessage }: McpModalProps) {
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<McpServerItem | null>(null);

  // New server form state
  const [isAdding, setIsAdding] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('npx');
  const [newServerArgs, setNewServerArgs] = useState('-y @modelcontextprotocol/server-filesystem C:\\');

  const electronAPI = (window as any).electronAPI;

  const loadMcpData = async () => {
    setLoading(true);
    try {
      if (electronAPI?.mcpGetServers) {
        const list = await electronAPI.mcpGetServers();
        setServers(list);
        if (selectedServer) {
          const updated = list.find((s: McpServerItem) => s.name === selectedServer.name);
          if (updated) setSelectedServer(updated);
        }
      } else {
        const res = await fetch('/api/mcp/servers');
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (err: any) {
      console.warn('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMcpData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async (serverName: string, config: any) => {
    try {
      if (electronAPI?.mcpStartServer) {
        await electronAPI.mcpStartServer(serverName, config);
        onStatusMessage?.(`Started MCP server: ${serverName}`);
      }
      await loadMcpData();
    } catch (err: any) {
      alert(`Failed to start MCP server: ${err.message}`);
    }
  };

  const handleStop = async (serverName: string) => {
    try {
      if (electronAPI?.mcpStopServer) {
        await electronAPI.mcpStopServer(serverName);
        onStatusMessage?.(`Stopped MCP server: ${serverName}`);
      }
      await loadMcpData();
    } catch (err: any) {
      alert(`Failed to stop MCP server: ${err.message}`);
    }
  };

  const handleAddServer = async () => {
    if (!newServerName.trim() || !newServerCommand.trim()) return;
    try {
      const argsArray = newServerArgs
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const currentConfig = electronAPI?.mcpGetConfig ? await electronAPI.mcpGetConfig() : { mcpServers: {} };
      const updatedConfig = {
        mcpServers: {
          ...(currentConfig.mcpServers || {}),
          [newServerName.trim()]: {
            command: newServerCommand.trim(),
            args: argsArray,
            autoStart: true,
          },
        },
      };

      if (electronAPI?.mcpSaveConfig) {
        await electronAPI.mcpSaveConfig(updatedConfig);
      }

      // Start it right away
      await handleStart(newServerName.trim(), {
        command: newServerCommand.trim(),
        args: argsArray,
      });

      setIsAdding(false);
      setNewServerName('');
      await loadMcpData();
      onStatusMessage?.(`Added MCP server: ${newServerName}`);
    } catch (err: any) {
      alert(`Failed to add MCP server: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#181818] rounded-[8px] w-full max-w-4xl h-[620px] flex flex-col shadow-2xl overflow-hidden text-[#CCCCCC]">
        {/* Header */}
        <div className="h-11 px-4 flex items-center justify-between bg-[#1F1F1F]">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[#0078D4]" />
            <span className="font-semibold text-sm text-white">Model Context Protocol (MCP)</span>
            <span className="text-[11px] text-[#696969] ml-1">
              ({servers.filter((s) => s.status === 'running').length} running / {servers.length} configured)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[3px] text-[#858585] hover:text-white hover:bg-[#252526] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#858585]">
            <span>Connect local CLI or remote MCP tools to the ApkRtool IDE Autonomous Agent.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding((prev) => !prev)}
              className="bg-[#0078D4] hover:bg-[#1084d8] text-white px-3 py-1 rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} />
              <span>Add MCP Server</span>
            </button>
            <button
              onClick={loadMcpData}
              className="p-1.5 rounded-[3px] bg-[#1F1F1F] hover:bg-[#252526] text-[#858585] hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Add Server Form Drawer */}
        {isAdding && (
          <div className="p-4 bg-[#1C1C1C] flex flex-col gap-3">
            <span className="text-xs font-semibold text-white">Configure New MCP Stdio Server</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-[#858585] block mb-1">Server Name</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="e.g. filesystem or memory"
                  className="w-full bg-[#141414] rounded-[3px] px-2.5 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[#0078D4]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#858585] block mb-1">Command</label>
                <input
                  type="text"
                  value={newServerCommand}
                  onChange={(e) => setNewServerCommand(e.target.value)}
                  placeholder="e.g. npx, node, python"
                  className="w-full bg-[#141414] rounded-[3px] px-2.5 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[#0078D4]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#858585] block mb-1">Arguments</label>
                <input
                  type="text"
                  value={newServerArgs}
                  onChange={(e) => setNewServerArgs(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-name"
                  className="w-full bg-[#141414] rounded-[3px] px-2.5 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[#0078D4]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 bg-[#252526] hover:bg-[#2F2F2F] text-xs rounded-[3px]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddServer}
                className="px-3 py-1 bg-[#0078D4] hover:bg-[#1084d8] text-white text-xs font-medium rounded-[3px]"
              >
                Save & Start Server
              </button>
            </div>
          </div>
        )}

        {/* Content split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Server list */}
          <div className="w-1/2 overflow-y-auto p-2 space-y-1.5 bg-[#181818]">
            {servers.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#696969] flex flex-col items-center gap-2">
                <Cpu size={24} className="text-[#383838]" />
                <p>No MCP servers configured yet.</p>
                <p className="text-[11px]">Click "Add MCP Server" above to attach tools via stdio.</p>
              </div>
            ) : (
              servers.map((s) => {
                const isSelected = selectedServer?.name === s.name;
                const isRunning = s.status === 'running';

                return (
                  <div
                    key={s.name}
                    onClick={() => setSelectedServer(s)}
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
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isRunning
                              ? 'bg-[#0078D4] text-[#FFFFFF]'
                              : 'bg-[#2B2B2B] text-[#696969]'
                          }`}
                        >
                          {s.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isRunning ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStop(s.name);
                            }}
                            className="p-1 rounded bg-[#2B2B2B] hover:bg-[#383838] text-[#FFFFFF] text-[10px] flex items-center gap-1 px-2"
                            title="Stop Server"
                          >
                            <Square size={10} />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStart(s.name, s.config);
                            }}
                            className="p-1 rounded bg-[#0078D4] hover:bg-[#1084d8] text-white text-[10px] flex items-center gap-1 px-2"
                            title="Start Server"
                          >
                            <Play size={10} />
                            <span>Start</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[#858585] truncate">
                      {s.config.command} {(s.config.args || []).join(' ')}
                    </div>
                    <div className="text-[10px] text-[#0078D4]">
                      {s.toolsCount} tools exposed to AI Agent
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tools details preview */}
          <div className="w-1/2 flex flex-col bg-[#141414] overflow-hidden">
            {selectedServer ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden select-text">
                <div className="p-3 bg-[#181818] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white font-mono">
                      {selectedServer.name} Tools Catalog
                    </h3>
                    <span className="text-[10px] text-[#858585]">
                      {selectedServer.tools.length} functions available
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto space-y-2">
                  {selectedServer.tools.length === 0 ? (
                    <div className="text-xs text-[#858585] p-4 text-center">
                      {selectedServer.status === 'running'
                        ? 'No tools exported by this server.'
                        : 'Server is stopped. Click "Start" to inspect exported tools.'}
                    </div>
                  ) : (
                    selectedServer.tools.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-[#181818] rounded-[4px] space-y-1 font-mono text-xs"
                      >
                        <div className="flex items-center gap-1.5 text-[#9CDCFE] font-semibold">
                          <Wrench size={12} className="text-[#0078D4]" />
                          <span>{t.name}</span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] font-sans text-[#858585] leading-relaxed">
                            {t.description}
                          </p>
                        )}
                        {t.inputSchema && (
                          <div className="text-[10px] text-[#696969] bg-[#141414] p-1.5 rounded overflow-x-auto">
                            <code>{JSON.stringify(t.inputSchema.properties || {}, null, 2)}</code>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#696969] gap-2">
                <Wrench size={24} className="text-[#383838]" />
                <p className="text-xs">Select a server to view exported tools and parameters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 px-4 flex items-center justify-between bg-[#1F1F1F] text-xs">
          <span className="text-[11px] text-[#858585]">
            Configuration stored in <code className="text-[#9CDCFE]">mcp_servers.json</code>
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
