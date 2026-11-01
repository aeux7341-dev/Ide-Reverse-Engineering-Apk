const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  watchWorkspace: (dirPath) => ipcRenderer.invoke('watch-workspace', dirPath),
  unwatchWorkspace: () => ipcRenderer.invoke('unwatch-workspace'),
  openNewWindow: () => ipcRenderer.invoke('open-new-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  dialogOpenDirectory: () => ipcRenderer.invoke('dialog-open-directory'),
  fsExists: (targetPath) => ipcRenderer.invoke('fs-exists', targetPath),
  fsStat: (targetPath) => ipcRenderer.invoke('fs-stat', targetPath),
  fsReaddir: (targetPath) => ipcRenderer.invoke('fs-readdir', targetPath),
  fsReadFile: (targetPath) => ipcRenderer.invoke('fs-readfile', targetPath),
  fsWriteFile: (targetPath, data) => ipcRenderer.invoke('fs-writefile', targetPath, data),
  fsMkdir: (targetPath) => ipcRenderer.invoke('fs-mkdir', targetPath),
  fsRemove: (targetPath, options) => ipcRenderer.invoke('fs-remove', targetPath, options),
  fsRename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
  // Window & Fullscreen Controls
  toggleFullscreen: () => ipcRenderer.invoke('window-toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onFullscreenChanged: (callback) => {
    const listener = (_event, val) => callback(val);
    ipcRenderer.on('window-fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window-fullscreen-changed', listener);
  },
  onMaximizeChanged: (callback) => {
    const listener = (_event, val) => callback(val);
    ipcRenderer.on('window-maximize-changed', listener);
    return () => ipcRenderer.removeListener('window-maximize-changed', listener);
  },

  // Terminal Runtime IPC
  createTerminal: (opts) => ipcRenderer.invoke('terminal-create', opts),
  sendTerminalInput: (id, input) => ipcRenderer.invoke('terminal-input', { id, input }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.invoke('terminal-kill', { id }),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('show-item-in-folder', fullPath),
  onTerminalData: (id, callback) => {
    const channel = `terminal-data-${id}`;
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onTerminalExit: (id, callback) => {
    const channel = `terminal-exit-${id}`;
    const listener = (_event, code) => callback(code);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // ADB Runner & Emulator Controls
  adbGetDevices: () => ipcRenderer.invoke('adb-get-devices'),
  adbConnect: (target) => ipcRenderer.invoke('adb-connect', target),
  adbDisconnect: (target) => ipcRenderer.invoke('adb-disconnect', target),
  adbInstall: (opts) => ipcRenderer.invoke('adb-install', opts),
  adbLaunch: (opts) => ipcRenderer.invoke('adb-launch', opts),
  adbStop: (opts) => ipcRenderer.invoke('adb-stop', opts),
  adbClear: (opts) => ipcRenderer.invoke('adb-clear', opts),
  adbUninstall: (opts) => ipcRenderer.invoke('adb-uninstall', opts),
  adbScreenshot: (deviceId) => ipcRenderer.invoke('adb-screenshot', deviceId),
  adbLogcat: (opts) => ipcRenderer.invoke('adb-logcat', opts),

  // Antigravity AI Agent & Bulk API
  aiSetKeys: (keys) => ipcRenderer.invoke('ai-set-keys', keys),
  aiGetKeyStats: () => ipcRenderer.invoke('ai-get-key-stats'),
  aiAgentRun: (params) => ipcRenderer.invoke('ai-agent-run', params),
  aiAgentCancel: () => ipcRenderer.invoke('ai-agent-cancel'),
  aiBulkBatch: (params) => ipcRenderer.invoke('ai-bulk-batch', params),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onAiAgentStep: (callback) => {
    const listener = (_event, step) => callback(step);
    ipcRenderer.on('ai-agent-step', listener);
    return () => ipcRenderer.removeListener('ai-agent-step', listener);
  },
  onAiBulkProgress: (callback) => {
    const listener = (_event, prog) => callback(prog);
    ipcRenderer.on('ai-bulk-progress', listener);
    return () => ipcRenderer.removeListener('ai-bulk-progress', listener);
  },

  // Skills Management & GitHub Integration
  skillList: () => ipcRenderer.invoke('skill-list'),
  skillToggle: (id, enabled) => ipcRenderer.invoke('skill-toggle', { id, enabled }),
  skillInstallGithub: (repoOrUrl) => ipcRenderer.invoke('skill-install-github', repoOrUrl),
  skillSave: (skillData) => ipcRenderer.invoke('skill-save', skillData),
  skillRemove: (id) => ipcRenderer.invoke('skill-remove', id),

  // Model Context Protocol (MCP) Manager
  mcpGetConfig: () => ipcRenderer.invoke('mcp-get-config'),
  mcpSaveConfig: (config) => ipcRenderer.invoke('mcp-save-config', config),
  mcpGetServers: () => ipcRenderer.invoke('mcp-get-servers'),
  mcpGetTools: () => ipcRenderer.invoke('mcp-get-tools'),
  mcpStartServer: (name, config) => ipcRenderer.invoke('mcp-start-server', { name, config }),
  mcpStopServer: (name) => ipcRenderer.invoke('mcp-stop-server', name),
  mcpCallTool: (server, tool, args) => ipcRenderer.invoke('mcp-call-tool', { server, tool, args }),

  onWorkspaceChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('workspace-changed', listener);
    return () => ipcRenderer.removeListener('workspace-changed', listener);
  },
  // Auto-Updater (GitHub Releases)
  updaterCheck: () => ipcRenderer.invoke('updater-check'),
  updaterDownload: () => ipcRenderer.invoke('updater-download'),
  updaterRestart: () => ipcRenderer.invoke('updater-restart'),
  onUpdaterStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('updater-status', listener);
    return () => ipcRenderer.removeListener('updater-status', listener);
  },
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
      return file.path || '';
    } catch {
      return '';
    }
  },
});
