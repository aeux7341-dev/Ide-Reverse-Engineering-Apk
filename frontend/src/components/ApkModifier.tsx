/**
 * ApkModifier — one-click APK property editor.
 *
 * Reads the workspace's AndroidManifest.xml and apktool.yml, lets the user
 * change:
 *   • Package name  → AndroidManifest.xml (package + applicationId) +
 *                     every smali file that references the old package as a
 *                     type descriptor (L<old/pkg>/ → L<new/pkg>/)
 *   • App label     → AndroidManifest.xml android:label +
 *                     res/values/strings.xml (app_name)
 *   • Version name  → AndroidManifest.xml android:versionName + apktool.yml
 *   • Version code  → AndroidManifest.xml android:versionCode + apktool.yml
 *   • App icon      → replaces ic_launcher*.png in all mipmap-* folders
 */

import { useState, useRef } from 'react';
import { Package, Tag, Hash, Image as ImageIcon, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getFileHandleRecursive } from '../utils/fsHelper';

interface ApkModifierProps {
  dirHandle: FileSystemDirectoryHandle | null;
  onRefreshTrigger: () => void;
  onStatusMessage: (msg: string) => void;
}

interface ModResult {
  ok: boolean;
  message: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function readTextFile(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<string | null> {
  try {
    const fh = await getFileHandleRecursive(dirHandle, path);
    const f  = await fh.getFile();
    return await f.text();
  } catch {
    return null;
  }
}

async function writeTextFile(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  content: string
): Promise<void> {
  const parts   = path.split('/').filter(Boolean);
  const fname   = parts.pop()!;
  let cur: FileSystemDirectoryHandle = dirHandle;
  for (const p of parts) cur = await cur.getDirectoryHandle(p, { create: true });
  const fh = await cur.getFileHandle(fname, { create: true });
  const wr = await fh.createWritable();
  await wr.write(content);
  await wr.close();
}

/** Walk all files matching a glob-like predicate and return their paths + handles */
async function walkFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  predicate: (name: string, path: string) => boolean
): Promise<Array<{ path: string; handle: FileSystemFileHandle }>> {
  const results: Array<{ path: string; handle: FileSystemFileHandle }> = [];
  for await (const entry of (dirHandle as any).values()) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      if (predicate(entry.name, entryPath)) results.push({ path: entryPath, handle: entry });
    } else if (entry.kind === 'directory') {
      const sub = await walkFiles(entry as FileSystemDirectoryHandle, entryPath, predicate);
      results.push(...sub);
    }
  }
  return results;
}

// ── Core patch functions ─────────────────────────────────────────────────────

/**
 * Patch AndroidManifest.xml — updates package, versionName, versionCode,
 * android:label when android:label="@string/app_name" or literal value.
 */
function patchManifest(
  xml: string,
  opts: {
    oldPkg?:     string;
    newPkg?:     string;
    versionName?: string;
    versionCode?: string;
    appLabel?:   string;
  }
): string {
  let out = xml;

  if (opts.newPkg && opts.oldPkg && opts.newPkg !== opts.oldPkg) {
    // package="..." attribute on <manifest>
    out = out.replace(
      /(<manifest[^>]*\s)package="[^"]*"/,
      `$1package="${opts.newPkg}"`
    );
    // applicationId in any provider/activity authorities
    out = out.replace(new RegExp(escapeRx(opts.oldPkg), 'g'), opts.newPkg);
  }

  if (opts.versionName) {
    out = out.replace(
      /(\s)android:versionName="[^"]*"/,
      `$1android:versionName="${opts.versionName}"`
    );
  }

  if (opts.versionCode) {
    out = out.replace(
      /(\s)android:versionCode="[^"]*"/,
      `$1android:versionCode="${opts.versionCode}"`
    );
  }

  // android:label — only patch inline literal labels, not @string references
  if (opts.appLabel) {
    out = out.replace(
      /(<application[^>]*\s)android:label="(?!@string)[^"]*"/,
      `$1android:label="${opts.appLabel}"`
    );
  }

  return out;
}

/**
 * Patch apktool.yml — updates versionName, versionCode, apkFileName.
 */
function patchApktoolYml(
  yml: string,
  opts: { versionName?: string; versionCode?: string; newPkg?: string }
): string {
  let out = yml;
  if (opts.versionName) {
    out = out.replace(/(versionName:\s*).+/, `$1${opts.versionName}`);
  }
  if (opts.versionCode) {
    out = out.replace(/(versionCode:\s*).+/, `$1${opts.versionCode}`);
  }
  return out;
}

/**
 * Patch res/values/strings.xml — updates <string name="app_name">...</string>
 */
function patchStringsXml(xml: string, appName: string): string {
  return xml.replace(
    /(<string\s+name="app_name"\s*>)[^<]*(<\/string>)/,
    `$1${appName}$2`
  );
}

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convert package name (com.example.app) to smali path prefix (com/example/app) */
function pkgToPath(pkg: string) {
  return pkg.replace(/\./g, '/');
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ApkModifier({ dirHandle, onRefreshTrigger, onStatusMessage }: ApkModifierProps) {
  // Form state
  const [newPkg,     setNewPkg]     = useState('');
  const [appLabel,   setAppLabel]   = useState('');
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [iconFile,   setIconFile]   = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Operation state
  const [running,  setRunning]  = useState(false);
  const [results,  setResults]  = useState<ModResult[]>([]);
  const [step,     setStep]     = useState('');

  const hasAnyChange =
    newPkg.trim() || appLabel.trim() || versionName.trim() || versionCode.trim() || iconFile;

  // ── Icon picker ─────────────────────────────────────────────────────────────
  function handleIconPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setIconFile(f);
    const url = URL.createObjectURL(f);
    setIconPreview(url);
  }

  // ── Apply all changes ───────────────────────────────────────────────────────
  async function applyAll() {
    if (!dirHandle || !hasAnyChange) return;
    setRunning(true);
    setResults([]);
    const log = (ok: boolean, message: string) => {
      setResults(prev => [...prev, { ok, message }]);
    };

    try {
      // ── 1. Read AndroidManifest.xml ──────────────────────────────────────
      setStep('Reading AndroidManifest.xml…');
      const manifestText = await readTextFile(dirHandle, 'AndroidManifest.xml');
      if (!manifestText) {
        log(false, 'AndroidManifest.xml not found — is this an Apktool workspace?');
        return;
      }

      // Extract current package name from manifest
      const currentPkgMatch = manifestText.match(/package="([^"]+)"/);
      const currentPkg = currentPkgMatch?.[1] ?? '';

      // ── 2. Patch AndroidManifest.xml ─────────────────────────────────────
      if (newPkg.trim() || appLabel.trim() || versionName.trim() || versionCode.trim()) {
        setStep('Patching AndroidManifest.xml…');
        const patched = patchManifest(manifestText, {
          oldPkg:      currentPkg,
          newPkg:      newPkg.trim()      || undefined,
          appLabel:    appLabel.trim()    || undefined,
          versionName: versionName.trim() || undefined,
          versionCode: versionCode.trim() || undefined,
        });
        await writeTextFile(dirHandle, 'AndroidManifest.xml', patched);
        log(true, 'AndroidManifest.xml — updated');
      }

      // ── 3. Patch apktool.yml ─────────────────────────────────────────────
      if (versionName.trim() || versionCode.trim()) {
        setStep('Patching apktool.yml…');
        const ymlText = await readTextFile(dirHandle, 'apktool.yml');
        if (ymlText) {
          const patched = patchApktoolYml(ymlText, {
            versionName: versionName.trim() || undefined,
            versionCode: versionCode.trim() || undefined,
          });
          await writeTextFile(dirHandle, 'apktool.yml', patched);
          log(true, 'apktool.yml — version info updated');
        } else {
          log(false, 'apktool.yml not found — skipping');
        }
      }

      // ── 4. Patch res/values/strings.xml (app_name) ──────────────────────
      if (appLabel.trim()) {
        setStep('Patching res/values/strings.xml…');
        const stringsText = await readTextFile(dirHandle, 'res/values/strings.xml');
        if (stringsText) {
          const patched = patchStringsXml(stringsText, appLabel.trim());
          await writeTextFile(dirHandle, 'res/values/strings.xml', patched);
          log(true, 'res/values/strings.xml — app_name updated');
        } else {
          log(false, 'res/values/strings.xml not found — app label only patched in manifest');
        }
      }

      // ── 5. Rename package in all Smali files + directories ──────────────
      if (newPkg.trim() && currentPkg && newPkg.trim() !== currentPkg) {
        setStep('Updating smali file contents…');
        const oldPath = pkgToPath(currentPkg);
        const newPath = pkgToPath(newPkg.trim());
        const oldDescriptor = `L${oldPath}/`;
        const newDescriptor = `L${newPath}/`;

        // Step 5a: Update content in all .smali files
        const smaliFiles = await walkFiles(dirHandle, '', (name) => name.endsWith('.smali'));
        let patchedSmali = 0;

        for (const { path, handle } of smaliFiles) {
          try {
            const file    = await handle.getFile();
            const content = await file.text();
            if (content.includes(oldDescriptor) || content.includes(oldPath)) {
              const patched = content
                .split(oldDescriptor).join(newDescriptor)
                .split(`.class public L${oldPath}`).join(`.class public L${newPath}`)
                .split(`.class L${oldPath}`).join(`.class L${newPath}`)
                .split(`L${oldPath};`).join(`L${newPath};`);
              const parent  = path.split('/').slice(0, -1).join('/');
              const fname   = path.split('/').pop()!;
              let cur: FileSystemDirectoryHandle = dirHandle;
              if (parent) {
                for (const p of parent.split('/')) {
                  cur = await cur.getDirectoryHandle(p, { create: false });
                }
              }
              const fh = await cur.getFileHandle(fname);
              const wr = await fh.createWritable();
              await wr.write(patched);
              await wr.close();
              patchedSmali++;
            }
          } catch { /* skip unreadable */ }
        }

        log(true, `Smali contents — updated ${patchedSmali} file(s)`);

        // Step 5b: Move smali directory structure old/pkg → new/pkg
        // Walk each smali_* and smali root, find matching dirs, copy+delete
        setStep('Renaming smali package directories…');
        let movedDirs = 0;

        const moveSmaliDirs = async (rootDir: FileSystemDirectoryHandle, _rootPrefix: string) => {
          const oldParts = oldPath.split('/');
          const newParts = newPath.split('/');

          // Navigate to old package directory
          let oldPkgDir: FileSystemDirectoryHandle | null = null;
          try {
            let cur = rootDir;
            for (const part of oldParts) {
              cur = await cur.getDirectoryHandle(part);
            }
            oldPkgDir = cur;
          } catch { return; } // old package dir doesn't exist here

          if (!oldPkgDir) return;

          // Collect all files from old package dir recursively
          const filesToMove: Array<{ relPath: string; handle: FileSystemFileHandle }> = [];
          const collectFiles = async (dir: FileSystemDirectoryHandle, prefix: string) => {
            for await (const entry of (dir as any).values()) {
              const p = prefix ? `${prefix}/${entry.name}` : entry.name;
              if (entry.kind === 'file') {
                filesToMove.push({ relPath: p, handle: entry as FileSystemFileHandle });
              } else if (entry.kind === 'directory') {
                await collectFiles(entry as FileSystemDirectoryHandle, p);
              }
            }
          };
          await collectFiles(oldPkgDir, '');

          if (filesToMove.length === 0) return;

          // Create new package directory structure
          const createDirPath = async (base: FileSystemDirectoryHandle, parts: string[]) => {
            let cur = base;
            for (const part of parts) {
              cur = await cur.getDirectoryHandle(part, { create: true });
            }
            return cur;
          };

          const newPkgBaseDir = await createDirPath(rootDir, newParts);

          // Copy each file to new location
          for (const { relPath, handle } of filesToMove) {
            const file = await handle.getFile();
            const content = await file.arrayBuffer();

            // Create subdirs if needed
            const relParts = relPath.split('/');
            const relFile = relParts.pop()!;
            let targetDir = newPkgBaseDir;
            for (const p of relParts) {
              targetDir = await targetDir.getDirectoryHandle(p, { create: true });
            }

            const newFh = await targetDir.getFileHandle(relFile, { create: true });
            const wr = await newFh.createWritable();
            await wr.write(content);
            await wr.close();
            movedDirs++;
          }

          // Only delete the deepest unique part (not shared parent dirs)
          // Find where new and old paths diverge
          let commonDepth = 0;
          for (let i = 0; i < Math.min(oldParts.length, newParts.length); i++) {
            if (oldParts[i] === newParts[i]) commonDepth = i + 1;
            else break;
          }

          // Navigate to the divergence point and delete old branch
          try {
            let cur = rootDir;
            for (let i = 0; i < commonDepth; i++) {
              cur = await cur.getDirectoryHandle(oldParts[i]);
            }
            if (commonDepth < oldParts.length) {
              await cur.removeEntry(oldParts[commonDepth], { recursive: true });
            }
          } catch { /* ignore cleanup errors */ }
        };

        // Apply to smali/ and all smali_classesN/ directories
        for await (const entry of (dirHandle as any).values()) {
          if (entry.kind === 'directory' && /^smali(_classes\d+|_.*)?$/i.test(entry.name)) {
            await moveSmaliDirs(entry as FileSystemDirectoryHandle, entry.name);
          }
        }

        if (movedDirs > 0) {
          log(true, `Smali dirs — moved ${movedDirs} file(s) from "${oldPath}" → "${newPath}"`);
        } else {
          log(true, `Smali dirs — no "${oldPath}" directory found (may already be correct or different structure)`);
        }

        log(true, `Package name: "${currentPkg}" → "${newPkg.trim()}" — fully applied`);
      }

      // ── 6. Replace app icon in all mipmap-* folders ─────────────────────
      if (iconFile) {
        setStep('Replacing app icon in all mipmap folders…');
        const iconBuf = await iconFile.arrayBuffer();

        // Find all mipmap directories
        const mipmapDirs: FileSystemDirectoryHandle[] = [];
        for await (const entry of (dirHandle as any).values()) {
          if (entry.kind === 'directory' && entry.name.startsWith('mipmap-')) {
            mipmapDirs.push(entry as FileSystemDirectoryHandle);
          }
        }

        // Also check res/mipmap-*
        try {
          const resDir = await dirHandle.getDirectoryHandle('res');
          for await (const entry of (resDir as any).values()) {
            if (entry.kind === 'directory' && entry.name.startsWith('mipmap-')) {
              mipmapDirs.push(entry as FileSystemDirectoryHandle);
            }
          }
        } catch { /* no res/ dir */ }

        let replacedIcons = 0;
        for (const mipmapDir of mipmapDirs) {
          // Replace all ic_launcher*.png / ic_launcher*.webp files
          for await (const iconEntry of (mipmapDir as any).values()) {
            if (
              iconEntry.kind === 'file' &&
              (iconEntry.name.startsWith('ic_launcher') || iconEntry.name.startsWith('ic_round_launcher')) &&
              /\.(png|webp)$/i.test(iconEntry.name)
            ) {
              try {
                const fh = iconEntry as FileSystemFileHandle;
                const wr = await fh.createWritable();
                await wr.write(iconBuf);
                await wr.close();
                replacedIcons++;
              } catch { /* skip locked */ }
            }
          }
        }

        if (replacedIcons > 0) {
          log(true, `App icon — replaced in ${replacedIcons} mipmap target(s)`);
        } else {
          log(false, 'App icon — no ic_launcher*.png/webp found in mipmap folders');
        }
      }

      setStep('Done!');
      onRefreshTrigger();
      onStatusMessage(`APK properties updated successfully.`);

    } catch (err: any) {
      log(false, `Unexpected error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!dirHandle) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center text-xs text-[#696969]">
        Open a decompiled Apktool workspace to use APK Modifier.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 text-xs select-text bg-[#1F1F1F]">

      {/* Header hint */}
      <div className="bg-[#181818] rounded-[4px] p-2.5 text-[11px] text-[#696969] leading-relaxed">
        <span className="text-[#0078D4] font-medium uppercase">Apktool workspace required.</span>
        {' '}Fill in fields to modify, then click Apply. Empty fields are left untouched.
      </div>

      {/* Package Name */}
      <div className="flex flex-col gap-1.5">
        <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
          <Package size={13} className="text-[#0078D4]" />
          <span>New Package Name</span>
        </label>
        <input
          type="text"
          value={newPkg}
          onChange={(e) => setNewPkg(e.target.value)}
          placeholder="e.g. com.myapp.modded"
          spellCheck={false}
          className="bg-[#181818] rounded-[3px] px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#696969] focus:outline-none focus:ring-1 focus:ring-[#0078D4]"
        />
        <p className="text-[11px] text-[#696969]">
          Updates manifest package, content provider authorities, and all Smali type descriptors.
        </p>
      </div>

      {/* App Label */}
      <div className="flex flex-col gap-1.5">
        <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
          <Tag size={13} className="text-[#0078D4]" />
          <span>App Name (Label)</span>
        </label>
        <input
          type="text"
          value={appLabel}
          onChange={(e) => setAppLabel(e.target.value)}
          placeholder="e.g. My Modded App"
          className="bg-[#181818] rounded-[3px] px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#696969] focus:outline-none focus:ring-1 focus:ring-[#0078D4]"
        />
        <p className="text-[11px] text-[#696969]">
          Updates <code className="text-[#0078D4]">app_name</code> in strings.xml and android:label in manifest.
        </p>
      </div>

      {/* Version Name */}
      <div className="flex flex-col gap-1.5">
        <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
          <Tag size={13} className="text-[#0078D4]" />
          <span>Version Name</span>
        </label>
        <input
          type="text"
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          placeholder="e.g. 2.0.0"
          className="bg-[#181818] rounded-[3px] px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#696969] focus:outline-none focus:ring-1 focus:ring-[#0078D4]"
        />
      </div>

      {/* Version Code */}
      <div className="flex flex-col gap-1.5">
        <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
          <Hash size={13} className="text-[#0078D4]" />
          <span>Version Code</span>
        </label>
        <input
          type="number"
          value={versionCode}
          onChange={(e) => setVersionCode(e.target.value)}
          placeholder="e.g. 200"
          className="bg-[#181818] rounded-[3px] px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#696969] focus:outline-none focus:ring-1 focus:ring-[#0078D4]"
        />
        <p className="text-[11px] text-[#696969]">
          Updated in both AndroidManifest.xml and apktool.yml.
        </p>
      </div>

      {/* App Icon */}
      <div className="flex flex-col gap-1.5">
        <label className="font-medium text-[#CCCCCC] flex items-center gap-1.5 text-xs">
          <ImageIcon size={13} className="text-[#0078D4]" />
          <span>App Icon</span>
        </label>
        <div className="flex items-center gap-3">
          {iconPreview ? (
            <img
              src={iconPreview}
              alt="New icon"
              className="w-12 h-12 rounded-[4px] object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-[4px] flex items-center justify-center flex-shrink-0 bg-[#181818]">
              <ImageIcon size={20} className="text-[#696969] opacity-40" />
            </div>
          )}
          <div className="flex flex-col gap-1.5 min-w-0">
            <button
              onClick={() => iconInputRef.current?.click()}
              className="bg-[#181818] hover:bg-[#252526] px-3 py-1.5 rounded-[3px] text-[#CCCCCC] hover:text-[#FFFFFF] text-xs font-medium transition-colors"
            >
              {iconFile ? 'Change Icon...' : 'Pick Icon File...'}
            </button>
            {iconFile && (
              <span className="text-[10px] text-[#0078D4] truncate">{iconFile.name}</span>
            )}
            <p className="text-[11px] text-[#696969]">
              PNG or WebP. Replaces all ic_launcher* in every mipmap-* folder.
            </p>
          </div>
        </div>
        <input
          ref={iconInputRef}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={handleIconPick}
        />
      </div>

      {/* Apply Button */}
      <button
        onClick={applyAll}
        disabled={running || !hasAnyChange}
        className="bg-[#0078D4] hover:bg-[#1084d8] text-[#FFFFFF] w-full py-2 rounded-[3px] font-medium text-xs disabled:opacity-40 flex items-center justify-center gap-2 transition-colors duration-100"
      >
        {running ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span>{step || 'Applying...'}</span>
          </>
        ) : (
          <>
            <CheckCircle size={14} />
            <span>Apply Changes</span>
          </>
        )}
      </button>

      {/* Results log */}
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[4px] overflow-hidden bg-[#181818]">
          <div className="px-3 py-1.5 bg-[#181818] text-[10px] font-medium text-[#696969] uppercase tracking-wider">
            Operation Log
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-1.5 text-[11px] leading-relaxed ${
                r.ok ? 'text-[#FFFFFF] font-medium' : 'text-[#696969] font-medium'
              }`}
            >
              {r.ok
                ? <CheckCircle size={12} className="flex-shrink-0 mt-0.5 text-[#0078D4]" />
                : <AlertCircle size={12} className="flex-shrink-0 mt-0.5 text-[#696969]" />}
              <span>{r.message}</span>
            </div>
          ))}
          {!running && results.every(r => r.ok) && (
            <div className="px-3 py-2 bg-[#0078D4]/10 border-t border-[#0078D4]/30 text-[11px] text-[#0078D4] font-medium">
              All changes applied. Build APK to generate modified binary.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
