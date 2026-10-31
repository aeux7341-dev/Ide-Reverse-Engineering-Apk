const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const archiver = require('archiver');
const { getAiAgentEngine } = require('./aiAgentEngine');
const { getSkillManager } = require('./skillManager');
const { getMcpManager } = require('./mcpManager');

// ── Directory Resolvers ───────────────────────────────────────────────────────

function getToolsDir() {
  const packagedPath = path.join(process.resourcesPath || '', 'tools');
  if (fs.existsSync(packagedPath)) return packagedPath;
  const devPath = path.resolve(__dirname, '..', 'tools');
  return devPath;
}

function getSigningDir() {
  const packagedPath = path.join(process.resourcesPath || '', 'signing');
  if (fs.existsSync(packagedPath)) return packagedPath;
  const devPath = path.resolve(__dirname, '..', 'signing');
  return devPath;
}

function getTempBaseDir() {
  const dir = path.join(app.getPath('temp'), 'apkrtool-workspaces');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeCleanup(target) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`[Cleanup Error] ${target}: ${err.message}`);
  }
}

// ── Binary & Tool Locators ────────────────────────────────────────────────────

function resolveJava(toolsDir) {
  // 1. Bundled JDK in tools/jdk
  const bundledJdkDir = path.join(toolsDir, 'jdk');
  if (fs.existsSync(bundledJdkDir)) {
    const entries = fs.readdirSync(bundledJdkDir);
    for (const entry of entries) {
      const candidate = path.join(bundledJdkDir, entry, 'bin', 'java.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // 2. JAVA_HOME environment variable
  if (process.env.JAVA_HOME) {
    const exe = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(exe)) return exe;
  }
  // 3. Fallback to system PATH
  return 'java';
}

function findApktoolJar(toolsDir) {
  const simple = path.join(toolsDir, 'apktool.jar');
  if (fs.existsSync(simple)) return simple;
  const jars = fs.readdirSync(toolsDir).filter(f => f.startsWith('apktool') && f.endsWith('.jar'));
  if (!jars.length) throw new Error(`No apktool*.jar found in ${toolsDir}`);
  jars.sort().reverse();
  return path.join(toolsDir, jars[0]);
}

function findAapt2(toolsDir) {
  // 1. Check bundled SDK
  const bundledSdk = path.join(toolsDir, 'android-sdk', 'build-tools');
  if (fs.existsSync(bundledSdk)) {
    const vers = fs.readdirSync(bundledSdk).sort().reverse();
    for (const v of vers) {
      const p = path.join(bundledSdk, v, 'aapt2.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  // 2. Check ANDROID_HOME / ANDROID_SDK_ROOT
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const btDir = path.join(sdkRoot, 'build-tools');
    if (fs.existsSync(btDir)) {
      const vers = fs.readdirSync(btDir).sort().reverse();
      for (const v of vers) {
        const p = path.join(btDir, v, 'aapt2.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  // 3. Check PATH
  try {
    execSync('aapt2 version', { stdio: 'ignore', timeout: 3000 });
    return 'aapt2';
  } catch { /* not on PATH */ }

  return null;
}

function findApksignerJar(toolsDir) {
  const bundledSdk = path.join(toolsDir, 'android-sdk', 'build-tools');
  if (fs.existsSync(bundledSdk)) {
    const vers = fs.readdirSync(bundledSdk).sort().reverse();
    for (const v of vers) {
      const p = path.join(bundledSdk, v, 'lib', 'apksigner.jar');
      if (fs.existsSync(p)) return p;
    }
  }
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const btDir = path.join(sdkRoot, 'build-tools');
    if (fs.existsSync(btDir)) {
      const vers = fs.readdirSync(btDir).sort().reverse();
      for (const v of vers) {
        const p = path.join(btDir, v, 'lib', 'apksigner.jar');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

function findZipalign(toolsDir) {
  const bundledSdk = path.join(toolsDir, 'android-sdk', 'build-tools');
  if (fs.existsSync(bundledSdk)) {
    const vers = fs.readdirSync(bundledSdk).sort().reverse();
    for (const v of vers) {
      const p = path.join(bundledSdk, v, 'zipalign.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const btDir = path.join(sdkRoot, 'build-tools');
    if (fs.existsSync(btDir)) {
      const vers = fs.readdirSync(btDir).sort().reverse();
      for (const v of vers) {
        const p = path.join(btDir, v, 'zipalign.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

function findAdb(toolsDir) {
  // 1. Check bundled platform-tools
  const bundled = path.join(toolsDir, 'android-sdk', 'platform-tools', 'adb.exe');
  if (fs.existsSync(bundled)) return bundled;

  // 2. Check LOCALAPPDATA Android SDK
  if (process.env.LOCALAPPDATA) {
    const localAdb = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
    if (fs.existsSync(localAdb)) return localAdb;
  }

  // 3. Check ANDROID_HOME / ANDROID_SDK_ROOT
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const sdkAdb = path.join(sdkRoot, 'platform-tools', 'adb.exe');
    if (fs.existsSync(sdkAdb)) return sdkAdb;
  }

  // 4. Check PATH
  try {
    execSync('adb version', { stdio: 'ignore', timeout: 3000 });
    return 'adb';
  } catch {}

  return null;
}

async function runAdbCommand(args, timeout = 35000) {
  const toolsDir = getToolsDir();
  const adb = findAdb(toolsDir);
  if (!adb) throw new Error('ADB (Android Debug Bridge) tidak ditemukan. Pastikan Android SDK platform-tools terpasang.');

  return new Promise((resolve, reject) => {
    const proc = spawn(adb, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      reject(new Error(`ADB command timed out after ${timeout}ms: adb ${args.join(' ')}`));
    }, timeout);

    proc.stdout?.on('data', d => { stdout += d; });
    proc.stderr?.on('data', d => { stderr += d; });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function captureAdbScreenshot(deviceId) {
  const toolsDir = getToolsDir();
  const adb = findAdb(toolsDir);
  if (!adb) throw new Error('ADB tidak ditemukan.');

  return new Promise((resolve, reject) => {
    const args = deviceId ? ['-s', deviceId, 'exec-out', 'screencap', '-p'] : ['exec-out', 'screencap', '-p'];
    const proc = spawn(adb, args, { shell: false, windowsHide: true });
    const chunks = [];
    let errStr = '';
    proc.stdout.on('data', chunk => chunks.push(chunk));
    proc.stderr.on('data', chunk => { errStr += chunk; });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0 || !chunks.length) {
        return reject(new Error(errStr || `Screenshot failed with code ${code}`));
      }
      const buffer = Buffer.concat(chunks);
      resolve(`data:image/png;base64,${buffer.toString('base64')}`);
    });
  });
}

function buildJadxClasspath(toolsDir) {
  const libDir = path.join(toolsDir, 'jadx', 'lib');
  if (!fs.existsSync(libDir)) throw new Error(`JADX lib dir not found: ${libDir}`);
  const jars = fs.readdirSync(libDir).filter(f => f.endsWith('.jar'));
  if (!jars.length) throw new Error(`No JARs found in ${libDir}`);
  return jars.map(j => path.join(libDir, j)).join(path.delimiter);
}

// ── Zip extraction helper (Native tar with PowerShell fallback) ─────────────

function findApktoolYml(startDir, depth = 0) {
  if (depth > 3) return null;
  const direct = path.join(startDir, 'apktool.yml');
  if (fs.existsSync(direct)) return direct;
  try {
    const entries = fs.readdirSync(startDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = findApktoolYml(path.join(startDir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

async function extractZip(zipPath, targetDir) {
  // 1. Try native tar (C-based libarchive, present on Windows 10/11, fast and reliable)
  try {
    await new Promise((resolve, reject) => {
      const p = spawn('tar', ['-xf', zipPath, '-C', targetDir], { windowsHide: true });
      p.on('error', reject);
      p.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar error ${code}`));
      });
    });
    return;
  } catch (tarErr) {
    console.warn('[extractZip] tar failed, falling back to PowerShell:', tarErr.message);
  }

  // 2. PowerShell fallback
  await new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Force -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}'`,
    ], { shell: false, windowsHide: true });

    let psErr = '';
    ps.stderr?.on('data', (d) => { psErr += d.toString(); });
    ps.on('error', reject);
    ps.on('close', (code) => {
      if (code !== 0) reject(new Error(`ZIP extraction failed (${code}): ${psErr}`));
      else resolve();
    });
  });
}

// ── Zip directory to Buffer helper ────────────────────────────────────────────

function zipDirectoryToBuffer(sourceDir) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 0 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err) => reject(err));
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// ── Main API Handler ──────────────────────────────────────────────────────────

async function handleApiRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const toolsDir = getToolsDir();
  const signingDir = getSigningDir();
  const tempBase = getTempBaseDir();

  // 1. GET /api/check-tools
  if (pathname === '/api/check-tools') {
    const javaExe = resolveJava(toolsDir);
    let javaOk = false;
    try {
      execSync(`"${javaExe}" -version`, { stdio: 'ignore', timeout: 3000 });
      javaOk = true;
    } catch { javaOk = false; }

    let apktoolOk = false;
    try {
      findApktoolJar(toolsDir);
      apktoolOk = true;
    } catch { apktoolOk = false; }

    let jadxOk = false;
    try {
      buildJadxClasspath(toolsDir);
      jadxOk = true;
    } catch { jadxOk = false; }

    const resolvedAapt2 = findAapt2(toolsDir);
    const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';

    let jarsignerOk = false;
    const jdkBin = (javaExe !== 'java' && path.isAbsolute(javaExe)) ? path.dirname(javaExe) : null;
    const exeExt = process.platform === 'win32' ? '.exe' : '';
    const jarsignerBin = `jarsigner${exeExt}`;
    const jarsignerExe = (jdkBin && fs.existsSync(path.join(jdkBin, jarsignerBin)))
      ? path.join(jdkBin, jarsignerBin)
      : 'jarsigner';
    try {
      execSync(`"${jarsignerExe}"`, { stdio: 'ignore', timeout: 3000 });
      jarsignerOk = true;
    } catch { jarsignerOk = false; }

    const resolvedAdb = findAdb(toolsDir);

    return new Response(JSON.stringify({
      java: javaOk,
      apktool: apktoolOk,
      jadx: jadxOk,
      jarsigner: jarsignerOk,
      aapt2_path: !!resolvedAapt2,
      aapt2_location: resolvedAapt2 === 'aapt2' ? 'PATH' : resolvedAapt2,
      adb_path: !!resolvedAdb,
      adb_location: resolvedAdb === 'adb' ? 'PATH' : resolvedAdb,
      android_home: sdkRoot || null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. POST /api/decompile
  if (pathname === '/api/decompile') {
    const formData = await request.formData();
    const tool = (formData.get('tool') || 'jadx').toString();
    const apkFile = formData.get('apk');
    const fastMode = formData.get('fastMode') === 'true';

    if (!apkFile || typeof apkFile.arrayBuffer !== 'function') {
      return new Response(JSON.stringify({ error: 'No APK file provided.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const wsId = crypto.randomUUID();
    const wsDir = path.join(tempBase, `ws-${wsId}`);
    const apkPath = path.join(wsDir, 'upload.apk');
    const outputDir = path.join(wsDir, 'decompiled');

    fs.mkdirSync(outputDir, { recursive: true });

    try {
      const apkBuffer = Buffer.from(await apkFile.arrayBuffer());
      fs.writeFileSync(apkPath, apkBuffer);

      const javaExe = resolveJava(toolsDir);
      let spawnArgs;

      if (tool === 'apktool') {
        const jarPath = findApktoolJar(toolsDir);
        spawnArgs = [
          '-jar',
          '-Xms512M',
          '-Xmx3072M',
          '-XX:+UseG1GC',
          '-Duser.language=en',
          '-Dfile.encoding=UTF8',
          '-Djdk.util.zip.disableZip64ExtraFieldValidation=true',
          '-Djdk.nio.zipfs.allowDotZipEntry=true',
          jarPath,
          'd', '-f',
        ];
        if (fastMode) spawnArgs.push('-b');
        spawnArgs.push('-o', outputDir, apkPath);
      } else {
        const classpath = buildJadxClasspath(toolsDir);
        spawnArgs = [
          '-Xms128M', '-XX:MaxRAMPercentage=70.0', '-XX:+UseG1GC',
          '-classpath', classpath,
          'jadx.cli.JadxCLI',
          '--threads-count', '4',
          '-d', outputDir,
          apkPath,
        ];
      }

      await new Promise((resolve, reject) => {
        const child = spawn(javaExe, spawnArgs, { shell: false, windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => { stdout += d; });
        child.stderr?.on('data', (d) => { stderr += d; });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) {
            const generatedFiles = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
            if (generatedFiles.length > 0) {
              console.warn(`[Decompiler Warning] Process exited with code ${code}, but output files were generated.`);
              return resolve();
            }
            reject(new Error(`Decompiler error (${code}): ${stderr || stdout}`));
          } else {
            resolve();
          }
        });
      });

      const zipBuffer = await zipDirectoryToBuffer(outputDir);

      return new Response(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="decompiled-${wsId}.zip"`,
        },
      });
    } catch (err) {
      console.error('[Local Decompile Error]', err);
      return new Response(JSON.stringify({ error: `Decompilation failed: ${err.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      safeCleanup(wsDir);
    }
  }

  // 3. POST /api/check-yml
  if (pathname === '/api/check-yml') {
    const formData = await request.formData();
    const wsFile = formData.get('workspace');
    const ymlText = formData.get('yml_content');

    let ymlContent = typeof ymlText === 'string' ? ymlText : null;
    let checkDir = null;

    try {
      if (!ymlContent) {
        if (!wsFile || typeof wsFile.arrayBuffer !== 'function') {
          return new Response(JSON.stringify({ error: 'Tidak ada data workspace atau apktool.yml yang dikirim.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const checkId = crypto.randomUUID();
        checkDir = path.join(tempBase, `check-${checkId}`);
        const zipPath = path.join(checkDir, 'ws.zip');
        fs.mkdirSync(checkDir, { recursive: true });

        fs.writeFileSync(zipPath, Buffer.from(await wsFile.arrayBuffer()));
        await extractZip(zipPath, checkDir);

        const ymlPath = findApktoolYml(checkDir);
        if (!ymlPath) {
          return new Response(JSON.stringify({
            valid: false,
            issues: ['File konfigurasi apktool.yml tidak ditemukan di workspace'],
            error: 'apktool.yml tidak ditemukan di workspace.',
            hint: 'Workspace ini kemungkinan hasil decompile JADX (hanya kode Java). Build APK memerlukan workspace hasil decompile Apktool (Smali + Resources).',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        ymlContent = fs.readFileSync(ymlPath, 'utf8');
      }

      const issues = [];
      if (ymlContent.includes('\x00')) {
        issues.push('File corrupt (terdapat karakter binary null)');
      }
      if (!ymlContent.includes('versionInfo:')) issues.push('Bagian versionInfo hilang');
      if (!ymlContent.includes('packageInfo:')) issues.push('Bagian packageInfo hilang');

      const hasDoNotCompress = /doNotCompress:/.test(ymlContent);

      return new Response(JSON.stringify({
        valid: issues.length === 0,
        issues,
        hasDoNotCompress,
        preview: ymlContent.slice(0, 500),
        size: ymlContent.length,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Validasi gagal: ${err.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      if (checkDir) safeCleanup(checkDir);
    }
  }

  // 4. POST /api/build
  if (pathname === '/api/build') {
    const formData = await request.formData();
    const wsFile = formData.get('workspace');
    const useAapt2 = formData.get('compiler') === 'aapt2';

    if (!wsFile || typeof wsFile.arrayBuffer !== 'function') {
      return new Response(JSON.stringify({ error: 'No workspace ZIP uploaded.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buildId = crypto.randomUUID();
    const buildDir = path.join(tempBase, `build-${buildId}`);
    const zipPath = path.join(buildDir, 'ws.zip');
    const extractDir = path.join(buildDir, 'src');
    const outputApk = path.join(buildDir, `rebuilt-${buildId}.apk`);

    fs.mkdirSync(extractDir, { recursive: true });

    try {
      fs.writeFileSync(zipPath, Buffer.from(await wsFile.arrayBuffer()));
      await extractZip(zipPath, extractDir);

      let projectDir = extractDir;
      const foundYml = findApktoolYml(extractDir);
      if (foundYml) {
        projectDir = path.dirname(foundYml);
      } else {
        throw new Error('apktool.yml tidak ditemukan di workspace (pastikan decompile menggunakan Apktool, bukan JADX).');
      }

      if (!fs.existsSync(path.join(projectDir, 'apktool.yml'))) {
        throw new Error('apktool.yml not found in workspace.');
      }

      const javaExe = resolveJava(toolsDir);
      const jarPath = findApktoolJar(toolsDir);
      const aapt2Path = findAapt2(toolsDir);
      const effectiveUseAapt2 = useAapt2 && !!aapt2Path;

      const buildEnv = { ...process.env };
      if (effectiveUseAapt2 && aapt2Path && aapt2Path !== 'aapt2') {
        const sdkRoot = path.resolve(aapt2Path, '..', '..', '..');
        buildEnv.ANDROID_HOME = sdkRoot;
        buildEnv.ANDROID_SDK_ROOT = sdkRoot;
      }

      const aaptArgs = [];
      if (!useAapt2) {
        aaptArgs.push('--use-aapt1');
      }

      const args = [
        '-jar', '-Xmx1024M',
        '-Duser.language=en',
        '-Dfile.encoding=UTF8',
        '-Djdk.util.zip.disableZip64ExtraFieldValidation=true',
        '-Djdk.nio.zipfs.allowDotZipEntry=true',
        jarPath,
        'b', projectDir,
        '-o', outputApk,
        ...aaptArgs,
      ];

      await new Promise((resolve, reject) => {
        const child = spawn(javaExe, args, { shell: false, windowsHide: true, env: buildEnv });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => { stdout += d; });
        child.stderr?.on('data', (d) => { stderr += d; });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(`Apktool build failed (${code}): ${stderr || stdout}`));
          else resolve();
        });
      });

      if (!fs.existsSync(outputApk)) {
        throw new Error('Build finished but output APK not created.');
      }

      // Signing Setup
      const KEYSTORE_PATH = path.join(signingDir, 'debug.keystore');
      const KEY_ALIAS = 'apkrtool';
      const KEY_PASS = 'apkrtool123';
      const STORE_PASS = 'apkrtool123';

      const jdkBin = (javaExe !== 'java' && path.isAbsolute(javaExe)) ? path.dirname(javaExe) : null;
      const exeExt = process.platform === 'win32' ? '.exe' : '';
      const jarsignerExe = (jdkBin && fs.existsSync(path.join(jdkBin, `jarsigner${exeExt}`)))
        ? path.join(jdkBin, `jarsigner${exeExt}`)
        : 'jarsigner';
      const keytoolExe = (jdkBin && fs.existsSync(path.join(jdkBin, `keytool${exeExt}`)))
        ? path.join(jdkBin, `keytool${exeExt}`)
        : 'keytool';

      if (!fs.existsSync(signingDir)) fs.mkdirSync(signingDir, { recursive: true });

      if (!fs.existsSync(KEYSTORE_PATH)) {
        await new Promise((resolve, reject) => {
          const ktArgs = [
            '-genkeypair',
            '-keystore', KEYSTORE_PATH,
            '-alias', KEY_ALIAS,
            '-keypass', KEY_PASS,
            '-storepass', STORE_PASS,
            '-keyalg', 'RSA',
            '-keysize', '2048',
            '-validity', '10000',
            '-dname', 'CN=ApkRtool IDE Debug, OU=Debug, O=ApkRtool, L=Local, ST=Local, C=US',
          ];
          const kt = spawn(keytoolExe, ktArgs, { shell: false, windowsHide: true });
          kt.on('error', reject);
          kt.on('close', (c) => c === 0 ? resolve() : reject(new Error(`keytool failed: ${c}`)));
        });
      }

      // Sign with apksigner or jarsigner
      const apksignerJar = findApksignerJar(toolsDir);
      const zipalignExe = findZipalign(toolsDir);
      let finalApk = outputApk;

      if (apksignerJar) {
        let apkToSign = outputApk;
        if (zipalignExe) {
          const alignedApk = outputApk.replace('.apk', '-aligned.apk');
          await new Promise((resolve) => {
            const za = spawn(zipalignExe, ['-f', '-p', '4', outputApk, alignedApk], {
              shell: false, windowsHide: true,
            });
            za.on('close', (code) => {
              if (code === 0 && fs.existsSync(alignedApk)) apkToSign = alignedApk;
              resolve();
            });
            za.on('error', () => resolve());
          });
        }

        const apksignedOut = outputApk.replace('.apk', '-apksigned.apk');
        const signArgs = [
          '-jar', apksignerJar,
          'sign',
          '--ks', KEYSTORE_PATH,
          '--ks-key-alias', KEY_ALIAS,
          '--ks-pass', `pass:${STORE_PASS}`,
          '--key-pass', `pass:${KEY_PASS}`,
          '--v1-signing-enabled', 'true',
          '--v2-signing-enabled', 'true',
          '--v3-signing-enabled', 'true',
          '--out', apksignedOut,
          apkToSign,
        ];

        await new Promise((resolve, reject) => {
          const js = spawn(javaExe, signArgs, { shell: false, windowsHide: true });
          let jsErr = '';
          js.stderr?.on('data', (d) => { jsErr += d; });
          js.on('error', reject);
          js.on('close', (code) => {
            if (code !== 0 || !fs.existsSync(apksignedOut)) reject(new Error(`apksigner failed (${code}): ${jsErr}`));
            else { finalApk = apksignedOut; resolve(); }
          });
        });
      } else {
        // jarsigner fallback
        const signedApk = outputApk.replace('.apk', '-signed.apk');
        fs.copyFileSync(outputApk, signedApk);

        await new Promise((resolve, reject) => {
          const jsArgs = [
            '-sigalg', 'SHA256withRSA',
            '-digestalg', 'SHA-256',
            '-keystore', KEYSTORE_PATH,
            '-storepass', STORE_PASS,
            '-keypass', KEY_PASS,
            signedApk,
            KEY_ALIAS,
          ];
          const js = spawn(jarsignerExe, jsArgs, { shell: false, windowsHide: true });
          let jsErr = '';
          js.stderr?.on('data', (d) => { jsErr += d; });
          js.on('error', reject);
          js.on('close', (code) => {
            if (code !== 0) reject(new Error(`jarsigner failed (${code}): ${jsErr}`));
            else resolve();
          });
        });

        finalApk = signedApk;

        if (zipalignExe) {
          const alignedApk = outputApk.replace('.apk', '-aligned-signed.apk');
          await new Promise((resolve) => {
            const za = spawn(zipalignExe, ['-f', '-p', '4', signedApk, alignedApk], {
              shell: false, windowsHide: true,
            });
            za.on('close', (code) => {
              if (code === 0 && fs.existsSync(alignedApk)) finalApk = alignedApk;
              resolve();
            });
            za.on('error', () => resolve());
          });
        }
      }

      const resultApkBytes = fs.readFileSync(finalApk);

      return new Response(resultApkBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': `attachment; filename="rebuilt-signed-${buildId}.apk"`,
        },
      });
    } catch (err) {
      console.error('[Local Build Error]', err);
      return new Response(JSON.stringify({ error: `Build failed: ${err.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      safeCleanup(buildDir);
    }
  }

  // 5. POST /api/ai/chat & /api/ai/agent
  if (pathname === '/api/ai/chat' || pathname === '/api/ai/agent') {
    const body = await request.json();
    const { message, prompt, fileName, fileContent, provider, model, workspacePath } = body;
    const apiKeyHeader = request.headers.get('x-gemini-key') || request.headers.get('x-api-key');
    const query = prompt || message || '';

    const engine = getAiAgentEngine();
    if (apiKeyHeader) {
      engine.setKeyPool(apiKeyHeader);
    }

    if (pathname === '/api/ai/agent') {
      try {
        const result = await engine.runAgentLoop({
          prompt: query,
          activeFile: fileName,
          fileContent,
          workspacePath,
          provider: provider || 'gemini',
          model: model || 'gemini-2.5-flash',
        });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const contextBlock = [
      fileName ? `[File]: ${fileName}` : '',
      fileContent ? `[Content]:\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\`` : '',
    ].filter(Boolean).join('\n');

    const fullPrompt = `You are an expert Android Reverse Engineer inside ApkRtool IDE.
${contextBlock ? contextBlock + '\n\n' : ''}[User]: ${query}

Give a concise, professional analysis. Highlight any hardcoded secrets, crypto weaknesses, insecure permissions, or interesting logic.`;

    if (engine.keyPool.hasKeys()) {
      try {
        const res = await engine.callModelWithFailover({
          provider: provider || 'gemini',
          model: model || 'gemini-2.5-flash',
          messages: [{ role: 'user', content: fullPrompt }],
        });
        return new Response(JSON.stringify({ response: res.text, keyStats: engine.getKeyStats() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `AI error: ${err.message}` }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Local heuristic scan
    const lines = [];
    if (fileContent) {
      if (/AES_KEY|SECRET_KEY|API_KEY|password\s*=/.test(fileContent))
        lines.push('🔑 **Hardcoded secret detected.** Extract and rotate immediately.');
      if (/AES.ECB/.test(fileContent))
        lines.push('⚠️ **ECB mode** — no IV, identical blocks produce identical ciphertext. Upgrade to AES-GCM.');
      if (/READ_PHONE_STATE|READ_CONTACTS|SEND_SMS/.test(fileContent))
        lines.push('📡 **Sensitive permissions** declared — confirm each is necessary.');
      if (/http:\/\//.test(fileContent))
        lines.push('🌐 **Plain HTTP** endpoint — all traffic should use HTTPS.');
      if (/Base64\.decode/.test(fileContent))
        lines.push('🔍 **Base64 decoding** — check for embedded payloads or obfuscated strings.');
    }
    if (!lines.length)
      lines.push('ℹ️ No automatic findings. Add one or more **API keys** (Bulk API pool) in Settings for full AI Agent analysis.');
    lines.push('\n_[Local heuristic scan — no API key provided]_');

    return new Response(JSON.stringify({ response: lines.join('\n') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5.1 Skills Endpoints
  if (pathname === '/api/skills') {
    const manager = getSkillManager();
    return new Response(JSON.stringify({ skills: manager.listSkills() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (pathname === '/api/skills/install') {
    try {
      const body = await request.json();
      const manager = getSkillManager();
      const skill = await manager.installSkillFromGitHub(body.repoOrUrl);
      return new Response(JSON.stringify({ success: true, skill }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 5.2 MCP Endpoints
  if (pathname === '/api/mcp/servers') {
    const manager = getMcpManager();
    return new Response(JSON.stringify({ servers: manager.getServerList() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (pathname === '/api/mcp/tools') {
    const manager = getMcpManager();
    const tools = await manager.getAllTools();
    return new Response(JSON.stringify({ tools }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. ADB Runner & Emulator Endpoints
  if (pathname === '/api/adb/devices') {
    try {
      const adb = findAdb(toolsDir);
      if (!adb) {
        return new Response(JSON.stringify({ success: false, error: 'ADB not found', devices: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

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

      return new Response(JSON.stringify({ success: true, adbPath: adb, devices }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message, devices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/connect') {
    try {
      const { target } = await request.json();
      if (!target) throw new Error('Target (host:port) required');
      const res = await runAdbCommand(['connect', target]);
      return new Response(JSON.stringify({ success: true, output: res.stdout || res.stderr }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/disconnect') {
    try {
      const { target } = await request.json();
      const res = await runAdbCommand(['disconnect', target || '']);
      return new Response(JSON.stringify({ success: true, output: res.stdout }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/install') {
    try {
      const { deviceId, apkPath, grantPermissions } = await request.json();
      let resolvedApk = apkPath;
      if (resolvedApk && !fs.existsSync(resolvedApk)) {
        if (fs.existsSync(path.resolve(process.cwd(), resolvedApk))) {
          resolvedApk = path.resolve(process.cwd(), resolvedApk);
        } else if (fs.existsSync(path.resolve(tempBase, resolvedApk))) {
          resolvedApk = path.resolve(tempBase, resolvedApk);
        }
      }
      if (!resolvedApk || !fs.existsSync(resolvedApk)) {
        throw new Error(`APK file not found on disk: ${apkPath}`);
      }
      const args = deviceId ? ['-s', deviceId] : [];
      args.push('install', '-r', '-d');
      if (grantPermissions) args.push('-g');
      args.push(resolvedApk);

      const res = await runAdbCommand(args, 120000);
      const isSuccess = res.stdout.includes('Success');
      return new Response(JSON.stringify({ success: isSuccess, output: res.stdout || res.stderr }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/launch') {
    try {
      const { deviceId, packageName, activityName } = await request.json();
      if (!packageName) throw new Error('Package name required');
      const args = deviceId ? ['-s', deviceId] : [];
      if (activityName) {
        const fullActivity = activityName.startsWith('.') ? `${packageName}/${activityName}` : (activityName.includes('/') ? activityName : `${packageName}/${activityName}`);
        args.push('shell', 'am', 'start', '-n', fullActivity);
      } else {
        args.push('shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1');
      }

      const res = await runAdbCommand(args);
      return new Response(JSON.stringify({ success: true, output: res.stdout || res.stderr }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/stop') {
    try {
      const { deviceId, packageName } = await request.json();
      const args = deviceId ? ['-s', deviceId] : [];
      args.push('shell', 'am', 'force-stop', packageName);
      const res = await runAdbCommand(args);
      return new Response(JSON.stringify({ success: true, output: res.stdout }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/clear') {
    try {
      const { deviceId, packageName } = await request.json();
      const args = deviceId ? ['-s', deviceId] : [];
      args.push('shell', 'pm', 'clear', packageName);
      const res = await runAdbCommand(args);
      return new Response(JSON.stringify({ success: true, output: res.stdout }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/uninstall') {
    try {
      const { deviceId, packageName } = await request.json();
      const args = deviceId ? ['-s', deviceId] : [];
      args.push('uninstall', packageName);
      const res = await runAdbCommand(args);
      return new Response(JSON.stringify({ success: true, output: res.stdout }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/screenshot') {
    try {
      const { deviceId } = await request.json();
      const base64 = await captureAdbScreenshot(deviceId);
      return new Response(JSON.stringify({ success: true, imageBase64: base64 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname === '/api/adb/logcat') {
    try {
      const { deviceId, filter, lines } = await request.json();
      const args = deviceId ? ['-s', deviceId] : [];
      args.push('logcat', '-d', '-t', String(lines || 150));
      if (filter) {
        args.push('-e', filter);
      }
      const res = await runAdbCommand(args);
      return new Response(JSON.stringify({ success: true, logs: res.stdout || res.stderr }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message, logs: '' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

module.exports = {
  handleApiRequest,
  getToolsDir,
  getSigningDir,
  findAdb,
  runAdbCommand,
  captureAdbScreenshot,
};
