const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running ApkRtool IDE v0.3.0 Self-Checks...');

// 0. Version checks
const pkg = require('../package.json');
const frontPkg = require('../frontend/package.json');
assert.strictEqual(pkg.version, '0.3.0', 'Root version must be 0.3.0');
assert.strictEqual(frontPkg.version, '0.3.0', 'Frontend version must be 0.3.0');
console.log('✓ Project version 0.3.0 verified across all packages');

// 0.1 i18n checks
const i18nFile = path.resolve(__dirname, '..', 'frontend', 'src', 'utils', 'i18n.tsx');
assert(fs.existsSync(i18nFile), 'i18n.tsx must exist');
const i18nContent = fs.readFileSync(i18nFile, 'utf8');
const langCodes = ['en', 'id', 'zh', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'ru', 'ja'];
langCodes.forEach(code => {
  assert(i18nContent.includes(`code: '${code}'`), `Language '${code}' must be registered in LANGUAGES`);
});
console.log('✓ 11 World Languages verified in i18n engine (Default: en)');

// 1. Tools Directory
const toolsDir = path.resolve(__dirname, '..', 'tools');
assert(fs.existsSync(toolsDir), 'tools dir must exist');
console.log('✓ Tools directory resolved:', toolsDir);

// 2. ADB resolution
const adbPath = path.join(toolsDir, 'android-sdk', 'platform-tools', 'adb.exe');
assert(fs.existsSync(adbPath), `adb.exe must be found at ${adbPath}`);
console.log('✓ ADB resolved at:', adbPath);

// 3. Icons sharp square check
const icoPath = path.resolve(__dirname, '..', 'build', 'icon.ico');
const pngPath = path.resolve(__dirname, '..', 'build', 'icon.png');
const svgPath = path.resolve(__dirname, '..', 'build', 'icon.svg');
assert(fs.existsSync(icoPath), 'icon.ico must exist');
assert(fs.existsSync(pngPath), 'icon.png must exist');
assert(fs.existsSync(svgPath), 'icon.svg must exist');

const svgContent = fs.readFileSync(svgPath, 'utf8');
assert(!svgContent.includes('rx="224"'), 'Squircle rx="224" should not be present');
assert(svgContent.includes('width="960" height="960"'), 'Square frame 960x960 must be present');
console.log('✓ Sharp square flat vector icons verified');

// 4. Frontend bundle & VS Code / ApkRtool IDE design tokens verification
const indexHtml = path.resolve(__dirname, '..', 'frontend', 'dist', 'index.html');
assert(fs.existsSync(indexHtml), 'frontend dist/index.html must exist');

const indexCss = fs.readFileSync(path.resolve(__dirname, '..', 'frontend', 'src', 'index.css'), 'utf8');
assert(indexCss.includes('--vsc-main: #1F1F1F;'), 'Primary bg #1F1F1F must exist at :root');
assert(indexCss.includes('--vsc-secondary: #181818;'), 'Secondary bg #181818 must exist at :root');
assert(indexCss.includes('--vsc-btn: #0078D4;'), 'Action button #0078D4 must exist at :root');
assert(indexCss.includes('--vsc-icon: #696969;'), 'Icon/muted text #696969 must exist at :root');
assert(indexCss.includes('--vsc-btn-text: #FFFFFF;'), 'Button text #FFFFFF must exist at :root');
assert(!indexCss.includes('transition: all'), 'transition: all must never be used');
console.log('✓ Frontend ApkRtool IDE design tokens verified');

// 5. AI Agent KeyPool & Failover Unit Verification
const { KeyPool } = require('../electron/aiAgentEngine');
const pool = new KeyPool(['key-1', 'key-2', 'key-3']);
assert.strictEqual(pool.getKeyCount(), 3, 'KeyPool must parse 3 keys');
assert.strictEqual(pool.getActiveKey(), 'key-1', 'Initial active key must be key-1');
pool.markFailure('key-1', '429 Rate Limit');
assert.strictEqual(pool.getActiveKey(), 'key-2', 'KeyPool must auto-failover to key-2');
console.log('✓ KeyPool bulk rotation & failover verified');

// 6. Skill Manager & GitHub Markdown Parser Verification
const { BUILT_IN_SKILLS } = require('../electron/skillManager');
assert(BUILT_IN_SKILLS.some((s) => s.id === 'ponytail'), 'Skill ponytail must exist in built-ins');
assert(BUILT_IN_SKILLS.some((s) => s.id === 'smali-master'), 'Skill smali-master must exist in built-ins');
assert(BUILT_IN_SKILLS.some((s) => s.id === 'security-guard'), 'Skill security-guard must exist in built-ins');
console.log('✓ Skill catalog built-ins verified');

console.log('ALL CHECKS PASSED SUCCESSFULLY.');
