const { app, BrowserWindow, Menu, dialog, shell, session, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Prevent EPIPE crashes when stdout/stderr pipes disconnect or parent shell exits
if (process.stdout && typeof process.stdout.on === 'function') {
  process.stdout.on('error', (err) => {
    if (err && err.code === 'EPIPE') return;
  });
}
if (process.stderr && typeof process.stderr.on === 'function') {
  process.stderr.on('error', (err) => {
    if (err && err.code === 'EPIPE') return;
  });
}
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EPIPE' || err.message?.includes('EPIPE'))) return;
  console.error('[Uncaught Exception]', err);
});

const { spawn } = require('child_process');
let nodePty = null;
try {
  nodePty = require('node-pty');
} catch (e) {
  console.warn('[node-pty] not available, using child_process fallback:', e.message);
}
const { handleApiRequest, getToolsDir, findAdb, runAdbCommand, captureAdbScreenshot } = require('./apiHandler');
const { getAiAgentEngine } = require('./aiAgentEngine');
const { getMcpManager } = require('./mcpManager');
const { getSkillManager } = require('./skillManager');

// ── Active Interactive Terminals ──────────────────────────────────────────────
const activeTerminals = new Map();

function getEnhancedPath(toolsDir) {
  const delimiter = path.delimiter;
  const pathsToAdd = [
    path.join(toolsDir, 'android-sdk', 'platform-tools'),
    path.join(toolsDir, 'android-sdk', 'build-tools', '35.0.0'),
    path.join(toolsDir, 'jdk', 'jdk11.0.31_11', 'bin'),
    path.join(toolsDir, 'jadx', 'bin'),
    toolsDir,
  ];
  return pathsToAdd.filter(p => fs.existsSync(p)).join(delimiter) + delimiter + (process.env.PATH || '');
}

// ── Register Privileged Custom Protocol ───────────────────────────────────────
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Enable Chromium File System Access API features in Electron
app.commandLine.appendSwitch('enable-features', 'FileSystemAccessAPI');

let mainWindow = null;

// ── Single Instance Lock ──────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Static Asset MIME Types ───────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

function serveStatic(pathname) {
  const distDir = path.resolve(__dirname, '..', 'frontend', 'dist');
  let cleanPath = pathname.replace(/^\/+/, '');
  if (!cleanPath || cleanPath === 'bundle') cleanPath = 'index.html';
  if (cleanPath.startsWith('bundle/')) cleanPath = cleanPath.slice(7);

  let filePath = path.join(distDir, cleanPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    return new Response('Frontend not built. Run: npm run build', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileBytes = fs.readFileSync(filePath);

  return new Response(fileBytes, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

// ── Build Application Menu ────────────────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload App',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload(),
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.setZoomLevel(0),
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const cur = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(cur + 0.5);
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const cur = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(cur - 0.5);
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ApkRtool IDE',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ApkRtool IDE',
              message: 'ApkRtool IDE Desktop',
              detail: 'Modern Android APK Decompiler, Bytecode Editor & Rebuilder.\nVersion 0.2 (Beta Edition)\nPowered by Apktool, JADX, and Electron.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Create Main Window ────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    title: 'ApkRtool IDE',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#181818',
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadURL('app://bundle/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window-fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window-fullscreen-changed', false);
  });
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', false);
  });

  mainWindow.on('closed', () => {
    stopWorkspaceWatcher();
    mainWindow = null;
  });
}

// ── Live Workspace Watcher ────────────────────────────────────────────────────
let currentWorkspaceWatcher = null;
let currentWorkspacePath = null;
let watcherDebounceTimer = null;

function stopWorkspaceWatcher() {
  currentWorkspacePath = null;
  if (currentWorkspaceWatcher) {
    try {
      currentWorkspaceWatcher.close();
    } catch {}
    currentWorkspaceWatcher = null;
  }
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = null;
  }
}

ipcMain.handle('watch-workspace', (event, dirPath) => {
  stopWorkspaceWatcher();

  if (!dirPath || typeof dirPath !== 'string' || !fs.existsSync(dirPath)) {
    return false;
  }

  currentWorkspacePath = dirPath;

  try {
    currentWorkspaceWatcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (filename) {
        const norm = filename.replace(/\\/g, '/');
        // Ignore internal build outputs or VCS dirs
        if (norm.startsWith('.git/') || norm.startsWith('build/') || norm.startsWith('.vscode/')) {
          return;
        }
      }

      if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
      watcherDebounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('workspace-changed', { eventType, filename });
        }
      }, 200);
    });

    try {
      console.log('[Electron] Live watcher active on:', dirPath);
    } catch {}
    return true;
  } catch (err) {
    try {
      console.warn('[Electron] fs.watch setup failed:', err.message);
    } catch {}
    return false;
  }
});

ipcMain.handle('unwatch-workspace', () => {
  stopWorkspaceWatcher();
  return true;
});

ipcMain.handle('open-new-window', () => {
  const newWin = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    title: 'ApkRtool IDE',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#181818',
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });
  newWin.setMenu(null);
  newWin.loadURL('app://bundle/index.html');
  newWin.once('ready-to-show', () => newWin.show());
  return true;
});

ipcMain.handle('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
  }
  return true;
});

ipcMain.handle('exit-app', () => {
  app.quit();
  return true;
});

// ── Window State & Fullscreen IPC ───────────────────────────────────────────
ipcMain.handle('window-toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) {
    const newState = !win.isFullScreen();
    win.setFullScreen(newState);
    return newState;
  }
  return false;
});

ipcMain.handle('window-is-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return win ? win.isFullScreen() : false;
});

ipcMain.handle('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  win?.minimize();
  return true;
});

ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  return true;
});

ipcMain.handle('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.close();
  }
  return true;
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return win ? win.isMaximized() : false;
});

// ── Interactive Terminal Runtime IPC ─────────────────────────────────────────
ipcMain.handle('terminal-create', (event, { id, shellType, cwd, cols, rows }) => {
  const toolsDir = getToolsDir();
  const enhancedEnv = {
    ...process.env,
    PATH: getEnhancedPath(toolsDir),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  };

  const workingDir = cwd && fs.existsSync(cwd) ? cwd : (app.getPath('home') || process.cwd());
  let shellCmd = 'powershell.exe';
  let shellArgs = ['-NoLogo', '-NoExit'];

  if (shellType === 'cmd') {
    shellCmd = 'cmd.exe';
    shellArgs = [];
  } else if (shellType === 'bash') {
    const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
    if (fs.existsSync(gitBash)) {
      shellCmd = gitBash;
      shellArgs = ['--login', '-i'];
    } else {
      shellCmd = 'bash.exe';
      shellArgs = [];
    }
  } else {
    // Default: Prefer modern pwsh.exe (PowerShell 7) if present
    const pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
    if (fs.existsSync(pwshPath)) {
      shellCmd = pwshPath;
      shellArgs = ['-NoExit'];
    } else {
      shellCmd = 'powershell.exe';
      shellArgs = ['-NoLogo', '-NoExit'];
    }
  }

  const sender = event.sender;

  if (nodePty) {
    try {
      const ptyProcess = nodePty.spawn(shellCmd, shellArgs, {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: workingDir,
        env: enhancedEnv,
      });

      activeTerminals.set(id, ptyProcess);

      ptyProcess.onData((data) => {
        if (!sender.isDestroyed()) {
          sender.send(`terminal-data-${id}`, data);
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        activeTerminals.delete(id);
        if (!sender.isDestroyed()) {
          sender.send(`terminal-exit-${id}`, exitCode);
        }
      });

      return { success: true, id, shellType, cwd: workingDir };
    } catch (ptyErr) {
      console.warn('[node-pty spawn failed, falling back to spawn]', ptyErr);
    }
  }

  try {
    const proc = spawn(shellCmd, shellArgs, {
      cwd: workingDir,
      env: enhancedEnv,
      shell: false,
      windowsHide: true,
    });

    activeTerminals.set(id, proc);

    proc.stdout.on('data', (chunk) => {
      if (!sender.isDestroyed()) {
        sender.send(`terminal-data-${id}`, chunk.toString('utf8'));
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (!sender.isDestroyed()) {
        sender.send(`terminal-data-${id}`, chunk.toString('utf8'));
      }
    });

    proc.on('close', (code) => {
      activeTerminals.delete(id);
      if (!sender.isDestroyed()) {
        sender.send(`terminal-exit-${id}`, code);
      }
    });

    proc.on('error', (err) => {
      if (!sender.isDestroyed()) {
        sender.send(`terminal-data-${id}`, `\r\n\x1b[31m[Process Error]: ${err.message}\x1b[0m\r\n`);
      }
    });

    return { success: true, id, shellType, cwd: workingDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('terminal-input', (_event, { id, input }) => {
  const proc = activeTerminals.get(id);
  if (proc) {
    if (typeof proc.write === 'function') {
      proc.write(input);
      return true;
    } else if (proc.stdin && proc.stdin.writable) {
      proc.stdin.write(input);
      return true;
    }
  }
  return false;
});

ipcMain.handle('terminal-resize', (_event, { id, cols, rows }) => {
  const proc = activeTerminals.get(id);
  if (proc && typeof proc.resize === 'function') {
    try {
      proc.resize(cols, rows);
      return true;
    } catch {}
  }
  return false;
});

ipcMain.handle('terminal-kill', (_event, { id }) => {
  const proc = activeTerminals.get(id);
  if (proc) {
    try { proc.kill(); } catch {}
    activeTerminals.delete(id);
    return true;
  }
  return false;
});

ipcMain.handle('show-item-in-folder', (_event, fullPath) => {
  if (fullPath && fs.existsSync(fullPath)) {
    shell.showItemInFolder(fullPath);
    return true;
  }
  return false;
});

// ── ADB Runner & Emulator Direct IPC ─────────────────────────────────────────
ipcMain.handle('adb-get-devices', async () => {
  try {
    const toolsDir = getToolsDir();
    const adb = findAdb(toolsDir);
    if (!adb) return { success: false, error: 'ADB not found', devices: [] };

    const res = await runAdbCommand(['devices', '-l']);
    const lines = res.stdout.split('\n').map(l => l.trim()).filter(Boolean);
    const devices = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('*')) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const id = parts[0];
        const state = parts[1];
        const modelMatch = line.match(/model:(\S+)/);
        const deviceMatch = line.match(/device:(\S+)/);
        const productMatch = line.match(/product:(\S+)/);
        const isEmulator = id.startsWith('emulator-') || id.includes('127.0.0.1:') || id.includes('localhost:');
        
        let androidVersion = '';
        let apiLevel = '';
        if (state === 'device') {
          try {
            const verRes = await runAdbCommand(['-s', id, 'shell', 'getprop', 'ro.build.version.release'], 4000);
            androidVersion = verRes.stdout;
            const apiRes = await runAdbCommand(['-s', id, 'shell', 'getprop', 'ro.build.version.sdk'], 4000);
            apiLevel = apiRes.stdout;
          } catch {}
        }

        devices.push({
          id,
          state,
          model: modelMatch ? modelMatch[1].replace(/_/g, ' ') : id,
          device: deviceMatch ? deviceMatch[1] : '',
          product: productMatch ? productMatch[1] : '',
          androidVersion: androidVersion || 'Android',
          apiLevel: apiLevel ? `API ${apiLevel}` : '',
          isEmulator,
        });
      }
    }
    return { success: true, adbPath: adb, devices };
  } catch (err) {
    return { success: false, error: err.message, devices: [] };
  }
});

ipcMain.handle('adb-connect', async (_event, target) => {
  try {
    const res = await runAdbCommand(['connect', target]);
    return { success: true, output: res.stdout || res.stderr };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-disconnect', async (_event, target) => {
  try {
    const res = await runAdbCommand(['disconnect', target || '']);
    return { success: true, output: res.stdout };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-install', async (_event, { deviceId, apkPath, grantPermissions }) => {
  try {
    let resolvedApk = apkPath;
    if (resolvedApk && !fs.existsSync(resolvedApk)) {
      if (currentWorkspacePath && fs.existsSync(path.join(currentWorkspacePath, resolvedApk))) {
        resolvedApk = path.join(currentWorkspacePath, resolvedApk);
      } else if (fs.existsSync(path.resolve(process.cwd(), resolvedApk))) {
        resolvedApk = path.resolve(process.cwd(), resolvedApk);
      }
    }
    if (!resolvedApk || !fs.existsSync(resolvedApk)) throw new Error(`APK file not found: ${apkPath}`);
    const args = deviceId ? ['-s', deviceId] : [];
    args.push('install', '-r', '-d');
    if (grantPermissions) args.push('-g');
    args.push(resolvedApk);
    const res = await runAdbCommand(args, 120000);
    return { success: res.stdout.includes('Success'), output: res.stdout || res.stderr };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-launch', async (_event, { deviceId, packageName, activityName }) => {
  try {
    const args = deviceId ? ['-s', deviceId] : [];
    if (activityName) {
      const fullActivity = activityName.startsWith('.') ? `${packageName}/${activityName}` : (activityName.includes('/') ? activityName : `${packageName}/${activityName}`);
      args.push('shell', 'am', 'start', '-n', fullActivity);
    } else {
      args.push('shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1');
    }
    const res = await runAdbCommand(args);
    return { success: true, output: res.stdout || res.stderr };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-stop', async (_event, { deviceId, packageName }) => {
  try {
    const args = deviceId ? ['-s', deviceId] : [];
    args.push('shell', 'am', 'force-stop', packageName);
    const res = await runAdbCommand(args);
    return { success: true, output: res.stdout };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-clear', async (_event, { deviceId, packageName }) => {
  try {
    const args = deviceId ? ['-s', deviceId] : [];
    args.push('shell', 'pm', 'clear', packageName);
    const res = await runAdbCommand(args);
    return { success: true, output: res.stdout };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-uninstall', async (_event, { deviceId, packageName }) => {
  try {
    const args = deviceId ? ['-s', deviceId] : [];
    args.push('uninstall', packageName);
    const res = await runAdbCommand(args);
    return { success: true, output: res.stdout };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-screenshot', async (_event, deviceId) => {
  try {
    const base64 = await captureAdbScreenshot(deviceId);
    return { success: true, imageBase64: base64 };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('adb-logcat', async (_event, { deviceId, filter, lines }) => {
  try {
    const args = deviceId ? ['-s', deviceId] : [];
    args.push('logcat', '-d', '-t', String(lines || 150));
    if (filter) args.push('-e', filter);
    const res = await runAdbCommand(args);
    return { success: true, logs: res.stdout || res.stderr };
  } catch (err) {
    return { success: false, error: err.message, logs: '' };
  }
});

// ── Native Filesystem IPC Bridge ──────────────────────────────────────────────
ipcMain.handle('dialog-open-directory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('fs-exists', async (_event, targetPath) => {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
});

ipcMain.handle('fs-stat', async (_event, targetPath) => {
  try {
    const stat = await fs.promises.stat(targetPath);
    return {
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch {
    return null;
  }
});

ipcMain.handle('fs-readdir', async (_event, targetPath) => {
  try {
    const dirents = await fs.promises.readdir(targetPath, { withFileTypes: true });
    return dirents.map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory(),
      isFile: d.isFile(),
    }));
  } catch {
    return [];
  }
});

ipcMain.handle('fs-readfile', async (_event, targetPath) => {
  try {
    const buf = await fs.promises.readFile(targetPath);
    return buf;
  } catch (err) {
    console.warn('[Electron] fs-readfile error:', err.message);
    throw err;
  }
});

ipcMain.handle('fs-writefile', async (_event, targetPath, data) => {
  try {
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) {
      await fs.promises.mkdir(parent, { recursive: true });
    }
    if (typeof data === 'string') {
      await fs.promises.writeFile(targetPath, data, 'utf8');
    } else {
      await fs.promises.writeFile(targetPath, Buffer.from(data));
    }
    return true;
  } catch (err) {
    console.warn('[Electron] fs-writefile error:', err.message);
    throw err;
  }
});

ipcMain.handle('fs-mkdir', async (_event, targetPath) => {
  try {
    await fs.promises.mkdir(targetPath, { recursive: true });
    return true;
  } catch (err) {
    console.warn('[Electron] fs-mkdir error:', err.message);
    throw err;
  }
});

ipcMain.handle('fs-remove', async (_event, targetPath, options) => {
  try {
    await fs.promises.rm(targetPath, {
      recursive: options?.recursive ?? true,
      force: true,
    });
    return true;
  } catch (err) {
    console.warn('[Electron] fs-remove error:', err.message);
    return false;
  }
});

ipcMain.handle('fs-rename', async (_event, oldPath, newPath) => {
  try {
    const parent = path.dirname(newPath);
    if (!fs.existsSync(parent)) {
      await fs.promises.mkdir(parent, { recursive: true });
    }
    await fs.promises.rename(oldPath, newPath);
    return true;
  } catch (err) {
    console.warn('[Electron] fs-rename error:', err.message);
    throw err;
  }
});

// ── Antigravity-Style AI Agent, Bulk API, Skills & MCP IPC ──────────────
ipcMain.handle('ai-set-keys', (_event, keys) => {
  const engine = getAiAgentEngine();
  engine.setKeyPool(keys);
  return engine.getKeyStats();
});

ipcMain.handle('ai-get-key-stats', () => {
  const engine = getAiAgentEngine();
  return engine.getKeyStats();
});

ipcMain.handle('ai-agent-run', async (event, params) => {
  const engine = getAiAgentEngine();
  const sender = event.sender;

  if (params.apiKeys) {
    engine.setKeyPool(params.apiKeys);
  }

  const result = await engine.runAgentLoop({
    prompt: params.prompt,
    messages: params.messages || [],
    workspacePath: params.workspacePath,
    activeFile: params.activeFile,
    fileContent: params.fileContent,
    provider: params.provider || 'gemini',
    model: params.model || 'gemini-2.5-flash',
    options: params.options || {},
    onStep: (step) => {
      if (!sender.isDestroyed()) {
        sender.send('ai-agent-step', step);
      }
    },
  });

  return result;
});

ipcMain.handle('ai-bulk-batch', async (event, params) => {
  const engine = getAiAgentEngine();
  const sender = event.sender;

  if (params.apiKeys) {
    engine.setKeyPool(params.apiKeys);
  }

  const results = await engine.runBulkBatch({
    items: params.items || [],
    taskPrompt: params.taskPrompt,
    provider: params.provider || 'gemini',
    model: params.model || 'gemini-2.5-flash',
    concurrency: params.concurrency || 2,
    onProgress: (prog) => {
      if (!sender.isDestroyed()) {
        sender.send('ai-bulk-progress', prog);
      }
    },
  });

  return results;
});

// Skills Manager IPC
ipcMain.handle('skill-list', () => {
  const manager = getSkillManager();
  return manager.listSkills();
});

ipcMain.handle('skill-toggle', (_event, { id, enabled }) => {
  const manager = getSkillManager();
  return manager.toggleSkill(id, enabled);
});

ipcMain.handle('skill-install-github', async (_event, repoOrUrl) => {
  const manager = getSkillManager();
  return await manager.installSkillFromGitHub(repoOrUrl);
});

ipcMain.handle('skill-save', (_event, skillData) => {
  const manager = getSkillManager();
  return manager.saveCustomSkill(skillData);
});

ipcMain.handle('skill-remove', (_event, id) => {
  const manager = getSkillManager();
  return manager.removeSkill(id);
});

// MCP Manager IPC
ipcMain.handle('mcp-get-config', () => {
  const manager = getMcpManager();
  return manager.getConfig();
});

ipcMain.handle('mcp-save-config', (_event, config) => {
  const manager = getMcpManager();
  return manager.saveConfig(config);
});

ipcMain.handle('mcp-get-servers', () => {
  const manager = getMcpManager();
  return manager.getServerList();
});

ipcMain.handle('mcp-get-tools', async () => {
  const manager = getMcpManager();
  return await manager.getAllTools();
});

ipcMain.handle('mcp-start-server', async (_event, { name, config }) => {
  const manager = getMcpManager();
  return await manager.startServer(name, config);
});

ipcMain.handle('mcp-stop-server', (_event, name) => {
  const manager = getMcpManager();
  manager.stopServer(name);
  return true;
});

ipcMain.handle('mcp-call-tool', async (_event, { server, tool, args }) => {
  const manager = getMcpManager();
  return await manager.callTool(server, tool, args);
});

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Protocol handler for app://
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request);
    }
    return serveStatic(url.pathname);
  });

  // Permissions for local filesystem access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler(() => {
    return true;
  });

  session.defaultSession.on('file-system-access-restricted', (event, details, callback) => {
    console.log('[Electron] Permitting restricted file system path:', details.path);
    callback('allow');
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
