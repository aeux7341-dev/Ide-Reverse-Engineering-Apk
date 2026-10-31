const rceditPkg = require('rcedit');
const rcedit = typeof rceditPkg === 'function' ? rceditPkg : rceditPkg.rcedit;
const path = require('path');
const fs = require('fs');

module.exports = async function (context) {
  if (context.electronPlatformName === 'win32') {
    const exeName = `${context.packager.appInfo.productFilename}.exe`;
    const exePath = path.join(context.appOutDir, exeName);
    const iconPath = path.resolve(__dirname, '..', 'build', 'icon.ico');

    if (fs.existsSync(exePath) && fs.existsSync(iconPath)) {
      try {
        console.log(`[AfterPack] Injecting custom icon into ${exeName}...`);
        await rcedit(exePath, {
          icon: iconPath,
          'version-string': {
            FileDescription: 'ApkRtool IDE',
            ProductName: 'ApkRtool IDE',
            LegalCopyright: 'Copyright © 2026 ApkRtool',
            ProductVersion: '0.2.0',
            FileVersion: '0.2.0.0',
          },
        });
        console.log(`[AfterPack] ✅ Successfully embedded custom icon into ${exeName}`);
      } catch (err) {
        console.warn(`[AfterPack] Warning: Could not inject icon into exe: ${err.message}`);
      }
    }
  }
};
