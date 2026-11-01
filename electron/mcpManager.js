const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { app } = require('electron');

class McpManager {
  constructor() {
    this.servers = new Map(); // name -> { process, config, tools: [], status: 'stopped' | 'running' | 'error' }
    this.configPath = path.join(app.getPath('userData'), 'mcp_servers.json');
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(raw);
      } else {
        // Default template config
        this.config = {
          mcpServers: {
            // Pre-configured optional examples
          },
        };
        this.saveConfig(this.config);
      }
    } catch (err) {
      console.warn('[MCP] Failed to load config:', err.message);
      this.config = { mcpServers: {} };
    }
  }

  saveConfig(newConfig) {
    try {
      this.config = newConfig || { mcpServers: {} };
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[MCP] Failed to save config:', err);
      return false;
    }
  }

  getConfig() {
    return this.config;
  }

  async startServer(name, serverConfig) {
    this.stopServer(name);

    const { command, args = [], env = {} } = serverConfig;
    if (!command) throw new Error(`Server ${name} has no command specified.`);

    const mergedEnv = {
      ...process.env,
      ...env,
    };

    try {
      const proc = spawn(command, args, {
        env: mergedEnv,
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const serverInfo = {
        name,
        config: serverConfig,
        process: proc,
        status: 'starting',
        tools: [],
        resources: [],
        buffer: '',
        nextRequestId: 1,
        pendingRequests: new Map(),
      };

      this.servers.set(name, serverInfo);

      proc.stdout.on('data', (chunk) => {
        this.handleServerOutput(serverInfo, chunk.toString('utf8'));
      });

      proc.stderr.on('data', (chunk) => {
        console.warn(`[MCP:${name} stderr]:`, chunk.toString('utf8').trim());
      });

      proc.on('close', (code) => {
        console.log(`[MCP:${name}] Process exited with code:`, code);
        serverInfo.status = 'stopped';
        this.servers.delete(name);
      });

      proc.on('error', (err) => {
        console.error(`[MCP:${name}] Process error:`, err);
        serverInfo.status = 'error';
        serverInfo.error = err.message;
      });

      // Send JSON-RPC initialize
      await this.sendRequest(name, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'ApkRtool-IDE',
          version: '0.3.5',
        },
      }, 8000);

      // Send initialized notification
      this.sendNotification(name, 'notifications/initialized', {});

      // Query tools
      const toolsRes = await this.sendRequest(name, 'tools/list', {}, 5000).catch(() => ({ tools: [] }));
      serverInfo.tools = toolsRes?.tools || [];
      serverInfo.status = 'running';

      return {
        name,
        status: 'running',
        toolsCount: serverInfo.tools.length,
        tools: serverInfo.tools,
      };
    } catch (err) {
      this.stopServer(name);
      throw err;
    }
  }

  stopServer(name) {
    const s = this.servers.get(name);
    if (s && s.process) {
      try {
        s.process.kill();
      } catch {}
      this.servers.delete(name);
    }
  }

  handleServerOutput(serverInfo, text) {
    serverInfo.buffer += text;
    const lines = serverInfo.buffer.split('\n');
    serverInfo.buffer = lines.pop(); // keep remainder

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && serverInfo.pendingRequests.has(msg.id)) {
          const { resolve, reject, timer } = serverInfo.pendingRequests.get(msg.id);
          clearTimeout(timer);
          serverInfo.pendingRequests.delete(msg.id);

          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // Not a JSON-RPC message line or logging
      }
    }
  }

  sendNotification(serverName, method, params = {}) {
    const s = this.servers.get(serverName);
    if (!s || !s.process || !s.process.stdin.writable) return;
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    s.process.stdin.write(msg);
  }

  sendRequest(serverName, method, params = {}, timeoutMs = 15000) {
    const s = this.servers.get(serverName);
    if (!s || !s.process || !s.process.stdin.writable) {
      return Promise.reject(new Error(`Server ${serverName} is not running`));
    }

    const id = s.nextRequestId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (s.pendingRequests.has(id)) {
          s.pendingRequests.delete(id);
          reject(new Error(`MCP request to ${serverName}.${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      s.pendingRequests.set(id, { resolve, reject, timer });
      s.process.stdin.write(payload);
    });
  }

  async callTool(serverName, toolName, args = {}) {
    const s = this.servers.get(serverName);
    if (!s) {
      // Try to auto-start if configured
      if (this.config.mcpServers && this.config.mcpServers[serverName]) {
        await this.startServer(serverName, this.config.mcpServers[serverName]);
      } else {
        throw new Error(`MCP Server '${serverName}' is not running or not configured`);
      }
    }

    const res = await this.sendRequest(serverName, 'tools/call', {
      name: toolName,
      arguments: args,
    });
    return res;
  }

  async getAllTools() {
    const allTools = [];
    for (const [name, s] of this.servers.entries()) {
      for (const t of s.tools) {
        allTools.push({
          server: name,
          name: t.name,
          fullName: `${name}__${t.name}`,
          description: t.description || '',
          inputSchema: t.inputSchema || {},
        });
      }
    }
    return allTools;
  }

  getServerList() {
    const configured = Object.keys(this.config.mcpServers || {});
    return configured.map((name) => {
      const active = this.servers.get(name);
      return {
        name,
        config: this.config.mcpServers[name],
        status: active ? active.status : 'stopped',
        toolsCount: active ? active.tools.length : 0,
        tools: active ? active.tools : [],
      };
    });
  }

  async autoStartConfiguredServers() {
    if (!this.config?.mcpServers) return;
    for (const [name, conf] of Object.entries(this.config.mcpServers)) {
      if (conf.autoStart !== false) {
        try {
          await this.startServer(name, conf);
        } catch (e) {
          console.warn(`[MCP] Auto-start failed for ${name}:`, e.message);
        }
      }
    }
  }
}

let mcpInstance = null;
function getMcpManager() {
  if (!mcpInstance) {
    mcpInstance = new McpManager();
  }
  return mcpInstance;
}

module.exports = {
  McpManager,
  getMcpManager,
};
