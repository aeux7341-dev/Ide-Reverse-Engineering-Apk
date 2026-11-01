const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { getSkillManager } = require('./skillManager');
const { getMcpManager } = require('./mcpManager');

function getToolsDir() {
  const packagedPath = path.join(process.resourcesPath || '', 'tools');
  if (fs.existsSync(packagedPath)) return packagedPath;
  return path.resolve(__dirname, '..', 'tools');
}

function getEnhancedPath(toolsDir) {
  const resolvedTools = path.resolve(toolsDir);
  const delimiter = path.delimiter;
  const pathsToAdd = [
    path.join(resolvedTools, 'android-sdk', 'platform-tools'),
    path.join(resolvedTools, 'android-sdk', 'build-tools', '35.0.0'),
    path.join(resolvedTools, 'jdk', 'jdk11.0.31_11', 'bin'),
    path.join(resolvedTools, 'jadx', 'bin'),
    resolvedTools,
  ];
  return pathsToAdd.filter((p) => fs.existsSync(p)).join(delimiter) + delimiter + (process.env.PATH || '');
}

/**
 * KeyPool manages multiple API keys, round-robin dispatch, and auto-failover on 429/quota errors.
 */
class KeyPool {
  constructor(rawKeys = []) {
    this.keys = this.parseKeys(rawKeys);
    this.currentIndex = 0;
    this.keyStats = new Map(); // key -> { failures: 0, lastError: null, successCount: 0 }
  }

  parseKeys(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((k) => String(k).trim()).filter(Boolean);
    if (typeof input === 'string') {
      return input
        .split(/[\n,;]+/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
    return [];
  }

  setKeys(input) {
    this.keys = this.parseKeys(input);
    this.currentIndex = 0;
  }

  hasKeys() {
    return this.keys.length > 0;
  }

  getKeyCount() {
    return this.keys.length;
  }

  getActiveKey() {
    if (!this.keys.length) return null;
    return this.keys[this.currentIndex % this.keys.length];
  }

  rotate() {
    if (!this.keys.length) return null;
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return this.getActiveKey();
  }

  markFailure(key, error) {
    const stat = this.keyStats.get(key) || { failures: 0, lastError: null, successCount: 0 };
    stat.failures++;
    stat.lastError = error;
    this.keyStats.set(key, stat);
    // Auto-advance to next key
    this.rotate();
  }

  markSuccess(key) {
    const stat = this.keyStats.get(key) || { failures: 0, lastError: null, successCount: 0 };
    stat.successCount++;
    this.keyStats.set(key, stat);
  }

  getStats() {
    return {
      totalKeys: this.keys.length,
      currentIndex: this.currentIndex,
      activeKeyMasked: this.getActiveKey()
        ? this.getActiveKey().slice(0, 4) + '...' + this.getActiveKey().slice(-4)
        : 'none',
      details: Array.from(this.keyStats.entries()).map(([k, s]) => ({
        key: k.slice(0, 4) + '...' + k.slice(-4),
        ...s,
      })),
    };
  }
}

/**
 * Built-in Agent Tools definition (OpenAI standard tool schema)
 */
function getAgentToolsSchema(mcpTools = []) {
  const coreTools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description:
          'Read the contents of a file in the workspace or filesystem. Returns line-numbered content (<line>: <content>). You can read ANY file across the entire workspace, not only the active open file.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from workspace root or absolute path' },
            offset: { type: 'number', description: 'The 1-based line number to start reading from (default: 1)' },
            limit: { type: 'number', description: 'Maximum number of lines to read (default: 2000)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Create or completely overwrite a file in the workspace with new content. Automatically creates parent directories.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from workspace root or absolute path' },
            content: { type: 'string', description: 'Full content to write to the file' },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'edit_file',
        description:
          'Make precise edits to a file by finding exact text and replacing it. Fails if old_string is ambiguous unless replace_all is true.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path or absolute path to the target file' },
            old_string: { type: 'string', description: 'Exact text segment to find and replace' },
            new_string: { type: 'string', description: 'Exact replacement text' },
            replace_all: { type: 'boolean', description: 'Whether to replace every occurrence (default: false)' },
          },
          required: ['path', 'old_string', 'new_string'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List files and directories in a given workspace path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from workspace root (empty for workspace root)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'glob_files',
        description:
          'Search file paths using a glob pattern (e.g. "**/*.smali", "res/**/*.xml", "src/**/*.java"). Essential for locating classes and resources.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern to match against (e.g. "**/*.smali", "AndroidManifest.xml")' },
            path: { type: 'string', description: 'Subdirectory to search inside (optional)' },
          },
          required: ['pattern'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'grep_search',
        description: 'Search for text or regular expressions across workspace files.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search string or regex' },
            path: { type: 'string', description: 'Subdirectory to narrow search (optional)' },
            include: { type: 'string', description: 'File extension filter (e.g. *.smali, *.xml)' },
          },
          required: ['pattern'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'run_command',
        description:
          'Execute a shell command (adb, apktool, jadx, git, powershell, python, etc.) in the workspace terminal environment. All embedded Android SDK/JDK tools are pre-configured in PATH.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Terminal command string to execute' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default: 60000)' },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'install_github_skill',
        description: 'Install and activate an expert skill directly from GitHub (e.g. owner/repo or raw link).',
        parameters: {
          type: 'object',
          properties: {
            repo_or_url: { type: 'string', description: 'GitHub repo or URL' },
          },
          required: ['repo_or_url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'call_mcp_tool',
        description: 'Execute a tool on a connected Model Context Protocol (MCP) server.',
        parameters: {
          type: 'object',
          properties: {
            server: { type: 'string', description: 'MCP server name' },
            tool: { type: 'string', description: 'Tool name on the server' },
            arguments: { type: 'object', description: 'Arguments object for the tool' },
          },
          required: ['server', 'tool'],
        },
      },
    },
  ];

  // Also append connected MCP tools directly
  for (const mcpTool of mcpTools) {
    coreTools.push({
      type: 'function',
      function: {
        name: `mcp__${mcpTool.server}__${mcpTool.name}`,
        description: `[MCP:${mcpTool.server}] ${mcpTool.description || ''}`,
        parameters: mcpTool.inputSchema || { type: 'object', properties: {} },
      },
    });
  }

  return coreTools;
}

/**
 * Execute a tool call against the local workspace environment or MCP server
 */
async function executeAgentTool(toolName, args, context) {
  const { workspacePath, mcpManager, skillManager, onFileModified } = context;

  // Handle direct MCP tool prefix: mcp__<server>__<tool>
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const serverName = parts[1];
    const actualTool = parts.slice(2).join('__');
    const result = await mcpManager.callTool(serverName, actualTool, args);
    return JSON.stringify(result, null, 2);
  }

  switch (toolName) {
    case 'read_file': {
      if (!args.path) throw new Error('Path required');
      const targetPath = path.isAbsolute(args.path)
        ? args.path
        : path.join(workspacePath || process.cwd(), args.path);

      if (!fs.existsSync(targetPath)) {
        return `Error: File not found: ${args.path}`;
      }

      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        return `Error: ${args.path} is a directory. Use list_dir or glob_files instead.`;
      }

      if (/\.(so|dex|arsc|png|jpg|jpeg|webp|gif|jar|apk|zip|ico)$/i.test(targetPath)) {
        return `File is binary (${stat.size} bytes). Binary files cannot be displayed as plain text.`;
      }

      const content = fs.readFileSync(targetPath, 'utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;
      const offset = Math.max(1, parseInt(args.offset, 10) || 1);
      const limit = Math.max(1, parseInt(args.limit, 10) || 2000);

      const startIndex = offset - 1;
      const slice = lines.slice(startIndex, startIndex + limit);

      const numbered = slice.map((line, idx) => `${startIndex + idx + 1}: ${line}`);
      let output = numbered.join('\n');

      if (startIndex + limit < totalLines) {
        output += `\n\n... [Showing lines ${offset}-${startIndex + limit} of ${totalLines}. Use offset=${startIndex + limit + 1} to read more]`;
      }
      return output;
    }

    case 'write_file': {
      if (!args.path) throw new Error('Path required');
      const targetPath = path.isAbsolute(args.path)
        ? args.path
        : path.join(workspacePath || process.cwd(), args.path);

      const parent = path.dirname(targetPath);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }

      fs.writeFileSync(targetPath, args.content || '', 'utf8');
      if (typeof onFileModified === 'function') {
        onFileModified(targetPath);
      }
      return `File written successfully: ${args.path} (${(args.content || '').length} characters)`;
    }

    case 'edit_file': {
      if (!args.path || args.old_string === undefined || args.new_string === undefined) {
        throw new Error('path, old_string, and new_string required');
      }
      const targetPath = path.isAbsolute(args.path)
        ? args.path
        : path.join(workspacePath || process.cwd(), args.path);

      if (!fs.existsSync(targetPath)) {
        return `Error: File not found: ${args.path}`;
      }

      const content = fs.readFileSync(targetPath, 'utf8');
      const replaceAll = !!args.replace_all;

      // 1. Direct match
      if (!content.includes(args.old_string)) {
        // Relax line-endings (\r\n vs \n)
        const normContent = content.replace(/\r\n/g, '\n');
        const normOld = args.old_string.replace(/\r\n/g, '\n');

        if (!normContent.includes(normOld)) {
          return `Error: old_string not found in ${args.path}. Ensure exact indentation and content match.`;
        }

        const normNew = args.new_string.replace(/\r\n/g, '\n');
        const occurrences = normContent.split(normOld).length - 1;
        if (occurrences > 1 && !replaceAll) {
          return `Error: old_string occurs ${occurrences} times in ${args.path}. Provide more surrounding lines to make it unique or set replace_all: true.`;
        }

        const updated = replaceAll
          ? normContent.split(normOld).join(normNew)
          : normContent.replace(normOld, normNew);

        fs.writeFileSync(targetPath, updated, 'utf8');
        if (typeof onFileModified === 'function') {
          onFileModified(targetPath);
        }
        return `Successfully replaced ${replaceAll ? occurrences : 1} occurrence(s) in ${args.path}`;
      }

      const occurrences = content.split(args.old_string).length - 1;
      if (occurrences > 1 && !replaceAll) {
        return `Error: old_string occurs ${occurrences} times in ${args.path}. Provide more surrounding context to make it unique or set replace_all: true.`;
      }

      const updated = replaceAll
        ? content.split(args.old_string).join(args.new_string)
        : content.replace(args.old_string, args.new_string);

      fs.writeFileSync(targetPath, updated, 'utf8');
      if (typeof onFileModified === 'function') {
        onFileModified(targetPath);
      }
      return `Successfully replaced ${replaceAll ? occurrences : 1} occurrence(s) in ${args.path}`;
    }

    case 'list_dir': {
      const targetDir = args.path
        ? path.isAbsolute(args.path)
          ? args.path
          : path.join(workspacePath || process.cwd(), args.path)
        : workspacePath || process.cwd();

      if (!fs.existsSync(targetDir)) {
        return `Error: Directory not found: ${args.path || '.'}`;
      }

      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const formatted = entries.map((e) => {
        if (e.isDirectory()) return `[DIR]  ${e.name}/`;
        try {
          const sz = fs.statSync(path.join(targetDir, e.name)).size;
          return `[FILE] ${e.name} (${sz} bytes)`;
        } catch {
          return `[FILE] ${e.name}`;
        }
      });
      return formatted.join('\n') || '(empty directory)';
    }

    case 'glob_files': {
      if (!args.pattern) throw new Error('pattern required (e.g. "**/*.smali")');
      const searchRoot = args.path
        ? path.isAbsolute(args.path)
          ? args.path
          : path.join(workspacePath || process.cwd(), args.path)
        : workspacePath || process.cwd();

      if (!fs.existsSync(searchRoot)) {
        return `Error: Directory not found: ${args.path || '.'}`;
      }

      const results = [];
      const pattern = args.pattern.trim();
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§§')
        .replace(/\*/g, '[^/\\\\]*')
        .replace(/§§/g, '.*');
      const globRegex = new RegExp(`^${escaped}$`, 'i');

      function crawl(dir, depth = 0) {
        if (depth > 12 || results.length >= 150) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (results.length >= 150) break;
            const full = path.join(dir, ent.name);
            const rel = path.relative(searchRoot, full).replace(/\\/g, '/');
            if (ent.isDirectory()) {
              if (ent.name !== 'node_modules' && ent.name !== '.git' && ent.name !== 'build') {
                crawl(full, depth + 1);
              }
            } else if (ent.isFile()) {
              if (globRegex.test(rel) || globRegex.test(ent.name)) {
                results.push(rel);
              }
            }
          }
        } catch {}
      }

      crawl(searchRoot);
      if (results.length === 0) {
        return `No files matching pattern "${args.pattern}" found in ${args.path || 'workspace'}.`;
      }
      return results.join('\n') + (results.length >= 150 ? '\n... [results truncated at 150 items]' : '');
    }

    case 'grep_search': {
      const searchRoot = args.path
        ? path.isAbsolute(args.path)
          ? args.path
          : path.join(workspacePath || process.cwd(), args.path)
        : workspacePath || process.cwd();

      if (!fs.existsSync(searchRoot)) {
        return `Error: Search root does not exist`;
      }

      const results = [];
      let regex;
      try {
        regex = new RegExp(args.pattern, 'i');
      } catch {
        const escaped = String(args.pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, 'i');
      }

      function crawl(dir) {
        if (results.length >= 80) return;
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'build') continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            crawl(full);
          } else if (e.isFile()) {
            if (args.include) {
              const ext = path.extname(e.name);
              if (!args.include.includes(ext) && !args.include.includes(e.name)) continue;
            }
            try {
              const text = fs.readFileSync(full, 'utf8');
              const lines = text.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  const rel = path.relative(searchRoot, full).replace(/\\/g, '/');
                  results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
                  if (results.length >= 80) break;
                }
              }
            } catch {}
          }
        }
      }

      crawl(searchRoot);
      return results.length > 0 ? results.join('\n') : `No matches found for "${args.pattern}".`;
    }

    case 'run_command': {
      if (!args.command) throw new Error('Command required');
      const cwd = workspacePath && fs.existsSync(workspacePath) ? workspacePath : process.cwd();
      const toolsDir = getToolsDir();
      const enhancedPath = getEnhancedPath(toolsDir);

      const env = {
        ...process.env,
        PATH: enhancedPath,
        ANDROID_HOME: path.join(path.resolve(toolsDir), 'android-sdk'),
        JAVA_HOME: path.join(path.resolve(toolsDir), 'jdk', 'jdk11.0.31_11'),
      };

      const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
      const timeout = Math.min(180000, Math.max(5000, parseInt(args.timeout, 10) || 60000));

      return new Promise((resolve) => {
        exec(args.command, { cwd, env, shell, timeout, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
          let output = '';
          if (stdout) output += stdout;
          if (stderr) output += (output ? '\n[stderr]\n' : '') + stderr;
          if (err && !output) {
            output = `Command failed (code ${err.code || 'ERR'}):\n${err.message}`;
          }
          if (output.length > 40000) {
            output = output.slice(0, 40000) + '\n... [output truncated at 40k chars]';
          }
          resolve(output || '(Command completed with no output)');
        });
      });
    }

    case 'install_github_skill': {
      if (!args.repo_or_url) throw new Error('repo_or_url required');
      const installed = await skillManager.installSkillFromGitHub(args.repo_or_url);
      return `Skill "${installed.name}" (${installed.id}) successfully installed and activated!\nDescription: ${installed.description}`;
    }

    case 'call_mcp_tool': {
      const { server, tool, arguments: mcpArgs = {} } = args;
      const res = await mcpManager.callTool(server, tool, mcpArgs);
      return JSON.stringify(res, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * AI Agent Engine that coordinates multi-turn tool calling, key failover, and Bulk API
 */
class AiAgentEngine {
  constructor() {
    this.keyPool = new KeyPool();
    this.skillManager = getSkillManager();
    this.mcpManager = getMcpManager();
  }

  setKeyPool(keys) {
    this.keyPool.setKeys(keys);
  }

  getKeyStats() {
    return this.keyPool.getStats();
  }

  /**
   * Run model completion with automatic key failover across provider endpoints
   */
  async callModelWithFailover({ provider = 'gemini', model, messages, tools, options = {} }) {
    if (!this.keyPool.hasKeys() && provider !== 'ollama') {
      throw new Error('No API key provided. Please configure one or more API keys in Settings or AI Agent panel.');
    }

    const maxRetries = Math.max(1, this.keyPool.getKeyCount());
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = this.keyPool.getActiveKey();

      try {
        let result = null;

        if (provider === 'gemini') {
          result = await this.callGeminiApi({
            apiKey,
            model: model || 'gemini-3.6-flash',
            messages,
            tools,
            temperature: options.temperature,
          });
        } else if (provider === 'anthropic') {
          result = await this.callAnthropicApi({
            apiKey,
            model: model || 'claude-3-5-sonnet-20241022',
            messages,
            tools,
          });
        } else {
          // OpenAI / DeepSeek / Groq / OpenRouter / Ollama
          result = await this.callOpenAiCompatibleApi({
            apiKey,
            baseUrl: options.baseUrl || 'https://api.openai.com/v1',
            model: model || 'gpt-4o-mini',
            messages,
            tools,
          });
        }

        this.keyPool.markSuccess(apiKey);
        return result;
      } catch (err) {
        lastError = err;
        const errMsg = String(err.message || err);
        const isRateLimitOrQuota =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('rate_limit') ||
          errMsg.includes('503') ||
          errMsg.includes('overloaded');

        if (isRateLimitOrQuota && this.keyPool.getKeyCount() > 1) {
          console.warn(`[AI Key Failover] Key hit limit, rotating to next key. Reason: ${errMsg}`);
          this.keyPool.markFailure(apiKey, errMsg);
          continue; // retry next key
        } else {
          throw err;
        }
      }
    }

    throw lastError || new Error('All API keys failed or exhausted.');
  }

  /**
   * Gemini API client (native v1beta)
   */
  async callGeminiApi({ apiKey, model, messages, tools, temperature }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Format messages for Gemini
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        if (msg.rawParts && Array.isArray(msg.rawParts) && msg.rawParts.length > 0) {
          contents.push({ role: 'model', parts: msg.rawParts });
        } else {
          const parts = [];
          if (msg.content) parts.push({ text: msg.content });
          if (msg.tool_calls) {
            for (const tc of msg.tool_calls) {
              let parsedArgs = {};
              try {
                parsedArgs = typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments;
              } catch {}
              parts.push({
                functionCall: {
                  name: tc.function.name,
                  args: parsedArgs,
                },
              });
            }
          }
          contents.push({ role: 'model', parts });
        }
      } else if (msg.role === 'tool') {
        const fnPart = {
          functionResponse: {
            name: msg.name,
            response: { output: msg.content },
          },
        };
        const lastContent = contents[contents.length - 1];
        if (lastContent && lastContent.role === 'user' && lastContent.parts && lastContent.parts[0]?.functionResponse) {
          lastContent.parts.push(fnPart);
        } else {
          contents.push({
            role: 'user',
            parts: [fnPart],
          });
        }
      }
    }

    // Format function declarations
    const geminiTools = [];
    if (tools && tools.length > 0) {
      const functionDeclarations = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }));
      geminiTools.push({ functionDeclarations });
    }

    const payload = {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: temperature !== undefined ? temperature : 0.2,
      },
      tools: geminiTools.length ? geminiTools : undefined,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates');

    const parts = candidate.content?.parts || [];
    let textOutput = '';
    const toolCalls = [];

    for (const p of parts) {
      if (p.text) textOutput += p.text;
      if (p.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args || {}),
          },
        });
      }
    }

    return {
      text: textOutput,
      toolCalls: toolCalls.length ? toolCalls : null,
      rawParts: parts,
      raw: data,
    };
  }

  /**
   * OpenAI Compatible API (OpenAI, DeepSeek, Groq, OpenRouter, Ollama)
   */
  async callOpenAiCompatibleApi({ apiKey, baseUrl, model, messages, tools }) {
    const cleanBase = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${cleanBase}/chat/completions`;

    const payload = {
      model,
      messages,
      tools: tools && tools.length ? tools : undefined,
      tool_choice: tools && tools.length ? 'auto' : undefined,
    };

    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI-compatible ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No choice returned from model');

    return {
      text: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls || null,
      raw: data,
    };
  }

  /**
   * Anthropic Messages API
   */
  async callAnthropicApi({ apiKey, model, messages, tools }) {
    const url = 'https://api.anthropic.com/v1/messages';

    let systemPrompt = '';
    const anthropicMessages = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + m.content;
      } else {
        anthropicMessages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        });
      }
    }

    const payload = {
      model,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: anthropicMessages,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let text = '';
    for (const c of data.content || []) {
      if (c.type === 'text') text += c.text;
    }

    return {
      text,
      toolCalls: null,
      raw: data,
    };
  }

  /**
   * Autonomous Agent Execution Loop (Antigravity Style)
   */
  async runAgentLoop({
    prompt,
    messages = [],
    workspacePath,
    activeFile,
    fileContent,
    provider = 'gemini',
    model = 'gemini-3.6-flash',
    options = {},
    onStep, // callback({ type, data })
    onFileModified,
  }) {
    const mcpTools = await this.mcpManager.getAllTools();
    const toolsSchema = getAgentToolsSchema(mcpTools);
    const skillsPrompt = this.skillManager.formatSkillsForSystemPrompt();

    const systemPrompt = `You are the ApkRtool IDE Autonomous Engineering Agent, inspired by Antigravity IDE.
You specialize in Android reverse engineering, APK decompilation, Dalvik Smali bytecode surgery, Java pseudocode analysis, security audits, and Frida instrumentation.
You have full native access to workspace tools:
- read_file(path, offset, limit): Read ANY file across the entire workspace with line numbers (<line>: <content>).
- write_file(path, content): Create or overwrite any file (auto-creates directories).
- edit_file(path, old_string, new_string, replace_all): Precise find-and-replace text modifications.
- list_dir(path): List files and directories in any folder.
- glob_files(pattern, path): Search and locate files using glob patterns (e.g. "**/*.smali", "res/**/*.xml").
- grep_search(pattern, path, include): Search text or regex across workspace files.
- run_command(command, timeout): Execute shell commands (adb, apktool, jadx, git, powershell) with Android SDK and JDK pre-configured in PATH.
- install_github_skill(repo_or_url): Install expert skill from GitHub.
- call_mcp_tool(server, tool, arguments): Run Model Context Protocol server tools.

WORKSPACE CONTEXT:
Workspace Root: ${workspacePath || 'No folder open (standalone mode)'}
Active Open File: ${activeFile || 'None'}
${fileContent ? `Active File Snapshot:\n\`\`\`\n${fileContent.slice(0, 10000)}\n\`\`\`` : ''}
${skillsPrompt}

INSTRUCTIONS:
1. You are autonomous: investigate the codebase, find target files with glob_files or grep_search, inspect them with read_file, make changes with edit_file or write_file, and verify with run_command if needed.
2. Provide concise, high-density explanations. Avoid fluff.
3. If an edit is requested, prefer \`edit_file\` with exact context strings.
4. When done, output a clear summary of findings or actions taken.`;

    const conversation = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: prompt },
    ];

    const maxSteps = options.maxSteps || 16;
    const executionTrace = [];

    for (let step = 0; step < maxSteps; step++) {
      if (onStep) {
        onStep({
          type: 'status',
          data: { step: step + 1, message: step === 0 ? 'Analyzing workspace & request...' : 'Evaluating tool outputs...' },
        });
      }

      const modelResponse = await this.callModelWithFailover({
        provider,
        model,
        messages: conversation,
        tools: toolsSchema,
        options,
      });

      const { text, toolCalls } = modelResponse;

      if (!toolCalls || toolCalls.length === 0) {
        // Model reached final response
        executionTrace.push({
          step: step + 1,
          type: 'final_response',
          text,
        });

        if (onStep) {
          onStep({ type: 'final_response', data: { text, executionTrace } });
        }

        return {
          response: text,
          executionTrace,
          activeKeyStats: this.getKeyStats(),
        };
      }

      // Model requested tool calls
      executionTrace.push({
        step: step + 1,
        type: 'tool_calls',
        toolCalls,
        reasoning: text,
      });

      conversation.push({
        role: 'assistant',
        content: text || '',
        tool_calls: toolCalls,
        rawParts: modelResponse.rawParts,
      });

      // Execute each tool call
      for (const tc of toolCalls) {
        const fnName = tc.function.name;
        let fnArgs = {};
        try {
          fnArgs = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
        } catch {
          fnArgs = {};
        }

        if (onStep) {
          onStep({
            type: 'tool_start',
            data: { id: tc.id, name: fnName, args: fnArgs },
          });
        }

        let output = '';
        try {
          output = await executeAgentTool(fnName, fnArgs, {
            workspacePath,
            mcpManager: this.mcpManager,
            skillManager: this.skillManager,
            onFileModified: onFileModified || options.onFileModified,
          });
        } catch (err) {
          output = `Error executing tool ${fnName}: ${err.message}`;
        }

        tc.output = output;
        tc.parsedArgs = fnArgs;

        if (onStep) {
          onStep({
            type: 'tool_finish',
            data: { id: tc.id, name: fnName, output },
          });
        }

        conversation.push({
          role: 'tool',
          name: fnName,
          content: String(output),
        });
      }
    }

    // If max steps reached without clean finish
    const finalMsg = 'Reached maximum agent steps. Current progress and changes have been applied.';
    return {
      response: finalMsg,
      executionTrace,
      activeKeyStats: this.getKeyStats(),
    };
  }

  /**
   * Bulk API batch runner across multiple files or tasks
   */
  async runBulkBatch({ items = [], taskPrompt, provider = 'gemini', model = 'gemini-3.6-flash', concurrency = 2, onProgress }) {
    const results = [];
    let completed = 0;

    const queue = [...items];
    const workers = [];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        try {
          const userPrompt = `Task: ${taskPrompt}\n\nTarget: ${item.name || item.path}\nContent:\n\`\`\`\n${(item.content || '').slice(0, 8000)}\n\`\`\``;

          const res = await this.callModelWithFailover({
            provider,
            model,
            messages: [{ role: 'user', content: userPrompt }],
            tools: null,
          });

          results.push({
            item: item.name || item.path,
            success: true,
            output: res.text,
          });
        } catch (err) {
          results.push({
            item: item.name || item.path,
            success: false,
            error: err.message,
          });
        } finally {
          completed++;
          if (onProgress) {
            onProgress({ completed, total: items.length });
          }
        }
      }
    };

    const workerCount = Math.min(concurrency, items.length || 1);
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return results;
  }
}

let agentEngineInstance = null;
function getAiAgentEngine() {
  if (!agentEngineInstance) {
    agentEngineInstance = new AiAgentEngine();
  }
  return agentEngineInstance;
}

module.exports = {
  AiAgentEngine,
  getAiAgentEngine,
  KeyPool,
};
