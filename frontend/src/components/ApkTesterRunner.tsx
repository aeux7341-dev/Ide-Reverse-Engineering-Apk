import { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Play,
  RotateCw,
  Square,
  Trash2,
  Camera,
  RefreshCw,
  Wifi,
  Terminal as TerminalIcon,
  Search,
  Download,
  Ban,
} from 'lucide-react';

interface DeviceItem {
  id: string;
  state: string;
  model: string;
  device: string;
  product: string;
  androidVersion: string;
  apiLevel: string;
  isEmulator: boolean;
}

interface ApkTesterRunnerProps {
  dirHandle: FileSystemDirectoryHandle | null;
  onStatusMessage?: (msg: string) => void;
  onOpenTerminalCmd?: (cmd: string) => void;
}

const EMULATOR_PRESETS = [
  { label: 'BlueStacks / LDPlayer', host: '127.0.0.1:5555' },
  { label: 'Nox Player', host: '127.0.0.1:62001' },
  { label: 'MuMu Player', host: '127.0.0.1:7555' },
  { label: 'MEmu Player', host: '127.0.0.1:21503' },
  { label: 'WSA (Windows Subsystem)', host: '127.0.0.1:58526' },
];

export default function ApkTesterRunner({
  dirHandle,
  onStatusMessage,
  onOpenTerminalCmd,
}: ApkTesterRunnerProps) {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [connectTarget, setConnectTarget] = useState<string>('127.0.0.1:5555');

  const [packageName, setPackageName] = useState<string>('');
  const [activityName, setActivityName] = useState<string>('');
  const [targetApkName, setTargetApkName] =
    useState<string>('rebuilt-signed.apk');

  const [activeSubTab, setActiveSubTab] = useState<
    'console' | 'logcat' | 'screenshot'
  >('console');
  const [isRunningAction, setIsRunningAction] = useState<boolean>(false);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const [logcatFilter, setLogcatFilter] = useState<string>('');
  const [logcatLogs, setLogcatLogs] = useState<string>('');
  const [isLogcatLoading, setIsLogcatLoading] = useState<boolean>(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (activeSubTab === 'console') {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actionLog, activeSubTab]);

  // Extract package & activity from AndroidManifest.xml
  useEffect(() => {
    if (!dirHandle) return;
    (async () => {
      try {
        const manifestHandle =
          await dirHandle.getFileHandle('AndroidManifest.xml');
        const file = await manifestHandle.getFile();
        const text = await file.text();

        const pkgMatch = text.match(/package\s*=\s*["']([^"']+)["']/);
        if (pkgMatch && pkgMatch[1]) {
          setPackageName(pkgMatch[1]);
        }

        const actMatch = text.match(
          /<activity[^>]*android:name\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?android.intent.action.MAIN[\s\S]*?<\/activity>/
        );
        if (actMatch && actMatch[1]) {
          setActivityName(actMatch[1]);
        }
      } catch {}
    })();
  }, [dirHandle]);

  const fetchDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const electronAPI = (window as any).electronAPI;
      let data: any;

      if (electronAPI?.adbGetDevices) {
        data = await electronAPI.adbGetDevices();
      } else {
        const res = await fetch('/api/adb/devices');
        data = await res.json();
      }

      if (data?.devices) {
        setDevices(data.devices);
        if (data.devices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(data.devices[0].id);
        }
        if (data.devices.length === 0) {
          onStatusMessage?.('No ADB devices/emulators found.');
        } else {
          onStatusMessage?.(`Found ${data.devices.length} ADB device(s).`);
        }
      }
    } catch (err: any) {
      console.warn('[ADB Devices]', err);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 8000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setActionLog((prev) => [...prev, `[${time}] ${msg}`]);
  };

  const handleConnectEmulator = async () => {
    if (!connectTarget.trim()) return;
    addLog(`Connecting to ${connectTarget}...`);
    try {
      const electronAPI = (window as any).electronAPI;
      let res: any;
      if (electronAPI?.adbConnect) {
        res = await electronAPI.adbConnect(connectTarget);
      } else {
        const r = await fetch('/api/adb/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: connectTarget }),
        });
        res = await r.json();
      }
      addLog(`Result: ${res.output || (res.success ? 'Connected' : res.error)}`);
      await fetchDevices();
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    }
  };

  const handleInstallAndLaunch = async () => {
    if (!selectedDeviceId) {
      addLog('Error: Select an active target Device or Emulator first.');
      return;
    }
    if (!packageName) {
      const pkg = prompt('Enter target APK Package Name (e.g. com.example.app):');
      if (!pkg) return;
      setPackageName(pkg);
    }

    setIsRunningAction(true);
    setActiveSubTab('console');
    addLog(`Deploying to ${selectedDeviceId}...`);

    try {
      addLog('Installing APK via ADB (-r -d -g)...');
      const electronAPI = (window as any).electronAPI;

      let fullApkPath = targetApkName;
      const nativeDir = (dirHandle as any)?.path;
      if (nativeDir && !/^[a-zA-Z]:[/\\]|^\//.test(targetApkName)) {
        const sep = nativeDir.includes('\\') ? '\\' : '/';
        fullApkPath = `${nativeDir.replace(/[\\/]+$/, '')}${sep}${targetApkName}`;
      }

      let installRes: any;
      if (electronAPI?.adbInstall) {
        installRes = await electronAPI.adbInstall({
          deviceId: selectedDeviceId,
          apkPath: fullApkPath,
          grantPermissions: true,
        });
      } else {
        const r = await fetch('/api/adb/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDeviceId,
            apkPath: fullApkPath,
            grantPermissions: true,
          }),
        });
        installRes = await r.json();
      }

      addLog(
        `Install status: ${
          installRes.output || (installRes.success ? 'Success' : installRes.error)
        }`
      );

      addLog(`Starting ${packageName} ${activityName ? `(${activityName})` : ''}...`);
      let launchRes: any;
      if (electronAPI?.adbLaunch) {
        launchRes = await electronAPI.adbLaunch({
          deviceId: selectedDeviceId,
          packageName,
          activityName,
        });
      } else {
        const r = await fetch('/api/adb/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDeviceId,
            packageName,
            activityName,
          }),
        });
        launchRes = await r.json();
      }

      addLog(
        `Launch status: ${launchRes.output || 'Application started successfully.'}`
      );
      onStatusMessage?.(`App ${packageName} running on ${selectedDeviceId}.`);
    } catch (err: any) {
      addLog(`Execution error: ${err.message}`);
    } finally {
      setIsRunningAction(false);
    }
  };

  const handleForceStop = async () => {
    if (!selectedDeviceId || !packageName) return;
    addLog(`Stopping process ${packageName}...`);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.adbStop) {
        await electronAPI.adbStop({ deviceId: selectedDeviceId, packageName });
      } else {
        await fetch('/api/adb/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: selectedDeviceId, packageName }),
        });
      }
      addLog(`Process stopped for ${packageName}.`);
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    }
  };

  const handleClearData = async () => {
    if (!selectedDeviceId || !packageName) return;
    addLog(`Clearing package data (pm clear ${packageName})...`);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.adbClear) {
        await electronAPI.adbClear({ deviceId: selectedDeviceId, packageName });
      } else {
        await fetch('/api/adb/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: selectedDeviceId, packageName }),
        });
      }
      addLog(`Data wiped for ${packageName}.`);
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    }
  };

  const handleUninstall = async () => {
    if (!selectedDeviceId || !packageName) return;
    if (
      !confirm(
        `Uninstall package "${packageName}" from device ${selectedDeviceId}?`
      )
    )
      return;
    addLog(`Uninstalling ${packageName}...`);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.adbUninstall) {
        await electronAPI.adbUninstall({
          deviceId: selectedDeviceId,
          packageName,
        });
      } else {
        await fetch('/api/adb/uninstall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: selectedDeviceId, packageName }),
        });
      }
      addLog(`Package ${packageName} uninstalled.`);
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    }
  };

  const handleScreenshot = async () => {
    if (!selectedDeviceId) return;
    addLog('Capturing framebuffer screenshot...');
    try {
      const electronAPI = (window as any).electronAPI;
      let res: any;
      if (electronAPI?.adbScreenshot) {
        res = await electronAPI.adbScreenshot(selectedDeviceId);
      } else {
        const r = await fetch('/api/adb/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: selectedDeviceId }),
        });
        res = await r.json();
      }

      if (res?.imageBase64) {
        setScreenshotUrl(res.imageBase64);
        setActiveSubTab('screenshot');
        addLog('Screenshot captured.');
      } else {
        addLog(`Screenshot failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    }
  };

  const handleFetchLogcat = async () => {
    if (!selectedDeviceId) return;
    setIsLogcatLoading(true);
    setActiveSubTab('logcat');
    try {
      const electronAPI = (window as any).electronAPI;
      let res: any;
      if (electronAPI?.adbLogcat) {
        res = await electronAPI.adbLogcat({
          deviceId: selectedDeviceId,
          filter: logcatFilter || packageName || '',
          lines: 150,
        });
      } else {
        const r = await fetch('/api/adb/logcat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDeviceId,
            filter: logcatFilter || packageName || '',
            lines: 150,
          }),
        });
        res = await r.json();
      }

      setLogcatLogs(res.logs || 'No logcat entries found.');
    } catch (err: any) {
      setLogcatLogs(`Logcat error: ${err.message}`);
    } finally {
      setIsLogcatLoading(false);
    }
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div className="h-full w-full flex flex-col bg-[#181818] text-[#CCCCCC] text-xs overflow-hidden select-text font-sans">
      {/* Top VS Code Style Action Bar */}
      <div className="h-9 bg-[#1F1F1F] px-3 flex items-center justify-between gap-3 select-none">
        {/* Left: Device Selection & Connect */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-xs text-[#858585]">
            <Smartphone size={13} className="text-[#0078D4]" />
            <span className="font-medium">Device:</span>
          </div>

          <div className="relative">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-[#181818] text-[#FFFFFF] rounded-[3px] px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0078D4] max-w-[200px] truncate"
            >
              {devices.length === 0 ? (
                <option value="">No devices detected</option>
              ) : (
                devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.model} ({d.id}) [{d.state}]
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={fetchDevices}
            disabled={isLoadingDevices}
            className="p-1 rounded-[3px] text-[#858585] hover:text-[#FFFFFF] hover:bg-[#252526] transition-colors"
            title="Scan ADB Devices"
          >
            <RefreshCw
              size={12}
              className={isLoadingDevices ? 'animate-spin text-[#0078D4]' : ''}
            />
          </button>

          {selectedDevice && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[#181818] text-[#0078D4] font-mono">
              {selectedDevice.apiLevel || selectedDevice.androidVersion}
            </span>
          )}

          <div className="h-3.5 w-[1px] bg-[#252526] mx-1" />

          {/* Quick Connect Input */}
          <div className="flex items-center gap-1">
            <Wifi size={12} className="text-[#858585]" />
            <select
              value=""
              onChange={(e) => e.target.value && setConnectTarget(e.target.value)}
              className="bg-[#181818] text-[#858585] px-1 py-0.5 rounded-[3px] text-[11px] outline-none"
              title="Emulator Presets"
            >
              <option value="">Presets...</option>
              {EMULATOR_PRESETS.map((p) => (
                <option key={p.host} value={p.host}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={connectTarget}
              onChange={(e) => setConnectTarget(e.target.value)}
              placeholder="127.0.0.1:5555"
              className="bg-[#181818] text-[#CCCCCC] px-1.5 py-0.5 rounded-[3px] w-28 text-[11px] font-mono outline-none focus:ring-1 focus:ring-[#0078D4]"
            />
            <button
              onClick={handleConnectEmulator}
              className="px-2 py-0.5 bg-[#181818] hover:bg-[#252526] rounded-[3px] text-[11px] text-[#0078D4] font-medium transition-colors"
            >
              Connect
            </button>
          </div>

          <div className="h-3.5 w-[1px] bg-[#252526] mx-1" />

          {/* Target APK input */}
          <div className="flex items-center gap-1 text-[11px] text-[#858585]">
            <span>APK:</span>
            <input
              type="text"
              value={targetApkName}
              onChange={(e) => setTargetApkName(e.target.value)}
              placeholder="rebuilt-signed.apk"
              className="bg-[#181818] text-[#CCCCCC] px-1.5 py-0.5 rounded-[3px] w-32 text-[11px] font-mono outline-none focus:ring-1 focus:ring-[#0078D4]"
              title="Target APK output file"
            />
          </div>
        </div>

        {/* Right: Primary Run Button & Management Tools */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleInstallAndLaunch}
            disabled={isRunningAction || !selectedDeviceId}
            className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] px-3 py-1 rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors duration-100 disabled:opacity-40 shadow-sm"
          >
            {isRunningAction ? (
              <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full" />
            ) : (
              <Play size={11} fill="currentColor" />
            )}
            <span>Run APK</span>
          </button>

          <div className="h-3.5 w-[1px] bg-[#252526] mx-1" />

          <button
            onClick={handleForceStop}
            disabled={!selectedDeviceId || !packageName}
            className="p-1 rounded-[3px] text-[#858585] hover:text-[#FFFFFF] hover:bg-[#252526] transition-colors disabled:opacity-30"
            title="Force Stop App"
          >
            <Square size={13} />
          </button>

          <button
            onClick={handleClearData}
            disabled={!selectedDeviceId || !packageName}
            className="p-1 rounded-[3px] text-[#858585] hover:text-[#FFFFFF] hover:bg-[#252526] transition-colors disabled:opacity-30"
            title="Clear App Data (pm clear)"
          >
            <RotateCw size={13} />
          </button>

          <button
            onClick={handleUninstall}
            disabled={!selectedDeviceId || !packageName}
            className="p-1 rounded-[3px] text-[#858585] hover:text-[#FFFFFF] hover:bg-[#252526] transition-colors disabled:opacity-30"
            title="Uninstall App"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={handleScreenshot}
            disabled={!selectedDeviceId}
            className="p-1 rounded-[3px] text-[#858585] hover:text-[#0078D4] hover:bg-[#252526] transition-colors disabled:opacity-30"
            title="Capture Framebuffer Screenshot"
          >
            <Camera size={13} />
          </button>

          {onOpenTerminalCmd && (
            <button
              onClick={() =>
                onOpenTerminalCmd(`adb -s ${selectedDeviceId} shell`)
              }
              disabled={!selectedDeviceId}
              className="p-1 rounded-[3px] text-[#858585] hover:text-[#0078D4] hover:bg-[#252526] transition-colors disabled:opacity-30"
              title="Open ADB Shell Terminal"
            >
              <TerminalIcon size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Secondary Navigation & Filter Bar */}
      <div className="h-7 bg-[#181818] px-3 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('console')}
            className={`px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-colors ${
              activeSubTab === 'console'
                ? 'bg-[#252526] text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            Runner Console
          </button>

          <button
            onClick={() => {
              setActiveSubTab('logcat');
              if (!logcatLogs) handleFetchLogcat();
            }}
            className={`px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-colors ${
              activeSubTab === 'logcat'
                ? 'bg-[#252526] text-[#FFFFFF]'
                : 'text-[#858585] hover:text-[#CCCCCC]'
            }`}
          >
            Device Logcat
          </button>

          {screenshotUrl && (
            <button
              onClick={() => setActiveSubTab('screenshot')}
              className={`px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-colors ${
                activeSubTab === 'screenshot'
                  ? 'bg-[#252526] text-[#FFFFFF]'
                  : 'text-[#858585] hover:text-[#CCCCCC]'
              }`}
            >
              Screenshot
            </button>
          )}
        </div>

        {/* Sub-bar Actions */}
        <div className="flex items-center gap-2">
          {activeSubTab === 'logcat' && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#1F1F1F] rounded-[3px]">
                <Search size={10} className="text-[#858585]" />
                <input
                  type="text"
                  value={logcatFilter}
                  onChange={(e) => setLogcatFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchLogcat()}
                  placeholder="Filter logcat..."
                  className="bg-transparent border-none outline-none text-[11px] text-[#FFFFFF] w-32 font-mono"
                />
              </div>
              <button
                onClick={handleFetchLogcat}
                disabled={isLogcatLoading}
                className="text-[11px] px-2 py-0.5 bg-[#1F1F1F] hover:bg-[#252526] rounded-[3px] text-[#0078D4]"
              >
                {isLogcatLoading ? 'Fetching...' : 'Refresh'}
              </button>
            </div>
          )}

          {activeSubTab === 'console' && (
            <button
              onClick={() => setActionLog([])}
              className="text-[#858585] hover:text-[#FFFFFF] p-0.5 rounded transition-colors"
              title="Clear Console Output"
            >
              <Ban size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-[#181818]">
        {/* SUBTAB 1: Runner Console */}
        {activeSubTab === 'console' && (
          <div className="h-full w-full p-3 overflow-y-auto font-mono text-[11.5px] leading-relaxed text-[#CCCCCC] whitespace-pre-wrap select-text">
            {actionLog.length === 0 ? (
              <div className="text-[#696969] italic flex flex-col items-center justify-center h-full text-center">
                <Smartphone size={24} className="mb-2 opacity-40 text-[#0078D4]" />
                <span>Ready. Click "Run APK" to deploy and execute on the target device.</span>
                <span className="text-[10px] mt-1 text-[#555555]">
                  Target package: {packageName || '(none)'}
                </span>
              </div>
            ) : (
              actionLog.map((log, idx) => {
                const isErr =
                  log.toLowerCase().includes('error') ||
                  log.toLowerCase().includes('fail');
                const isSuccess =
                  log.toLowerCase().includes('success') ||
                  log.toLowerCase().includes('running');
                return (
                  <div
                    key={idx}
                    className={`mb-0.5 ${
                      isErr
                        ? 'text-[#FFFFFF] font-semibold'
                        : isSuccess
                        ? 'text-[#0078D4] font-medium'
                        : 'text-[#CCCCCC]'
                    }`}
                  >
                    {log}
                  </div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        )}

        {/* SUBTAB 2: Device Logcat */}
        {activeSubTab === 'logcat' && (
          <div className="h-full w-full p-3 overflow-y-auto font-mono text-[11px] leading-snug text-[#CCCCCC] whitespace-pre-wrap select-text">
            {logcatLogs || (
              <span className="text-[#696969] italic">
                No logcat entries. Click Refresh to query recent logs.
              </span>
            )}
          </div>
        )}

        {/* SUBTAB 3: Screenshot Preview */}
        {activeSubTab === 'screenshot' && screenshotUrl && (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center overflow-auto bg-[#141414]">
            <div className="relative max-h-full flex flex-col items-center bg-[#181818] p-2 rounded-[6px] shadow-2xl">
              <img
                src={screenshotUrl}
                alt="Device Screenshot"
                className="max-h-[calc(100vh-250px)] rounded-[3px] object-contain shadow-md"
              />
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={screenshotUrl}
                  download={`screenshot-${selectedDeviceId}-${Date.now()}.png`}
                  className="px-2.5 py-1 bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download size={12} />
                  <span>Download Image</span>
                </a>
                <button
                  onClick={() => setScreenshotUrl(null)}
                  className="px-2.5 py-1 bg-[#1F1F1F] hover:bg-[#252526] text-[#CCCCCC] rounded-[3px] text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
