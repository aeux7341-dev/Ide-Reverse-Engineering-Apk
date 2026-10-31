const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, BrowserWindow } = require('electron');

app.setPath('userData', path.join(os.tmpdir(), 'apkrtool-icon-gen-' + Date.now()));
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// 1024x1024 Master Vector: Android Bugdroid emerging from Unpack Cardboard Box on Clean White Background
// Low detail, flat vector, zero gradients, zero shadows
const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <!-- 1. Background: Clean White Sharp Square Frame (No Rounded Corners) -->
  <rect x="32" y="32" width="960" height="960" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="16"/>

  <!-- 2. Cardboard Box: Back Flaps (Behind Bugdroid) -->
  <!-- Back-Left Flap -->
  <polygon points="212,470 512,340 442,255 142,385" fill="#9E6932"/>
  <!-- Back-Right Flap -->
  <polygon points="512,340 812,470 882,385 582,255" fill="#AC763C"/>

  <!-- 3. Cardboard Box: Interior Floor/Walls -->
  <polygon points="212,470 512,340 812,470 512,600" fill="#523010"/>

  <!-- 4. BUGDROID (Emerging from Box) -->
  <!-- Left Arm (Angled out) -->
  <rect x="268" y="375" width="48" height="140" rx="24" fill="#3DDC84" transform="rotate(14 292 375)"/>
  <!-- Right Arm (Angled out) -->
  <rect x="708" y="375" width="48" height="140" rx="24" fill="#3DDC84" transform="rotate(-14 732 375)"/>

  <!-- Torso Body -->
  <path d="M 342,374 L 682,374 L 682,570 C 682,586 668,600 650,600 L 374,600 C 356,600 342,586 342,570 Z" fill="#3DDC84"/>

  <!-- Chest Terminal Glyph </> (Clean White) -->
  <text x="512" y="474" font-family="'JetBrains Mono', Consolas, 'Segoe UI', monospace" font-size="58" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">&lt;/&gt;</text>

  <!-- Head Dome -->
  <path d="M 342,358 A 170,170 0 0,1 682,358 Z" fill="#3DDC84"/>

  <!-- Antennae (Rounded Thick Bars at 30 deg) -->
  <line x1="416" y1="220" x2="366" y2="120" stroke="#3DDC84" stroke-width="28" stroke-linecap="round"/>
  <line x1="608" y1="220" x2="658" y2="120" stroke="#3DDC84" stroke-width="28" stroke-linecap="round"/>

  <!-- Authentic White Android Eyes -->
  <circle cx="418" cy="286" r="18" fill="#FFFFFF"/>
  <circle cx="606" cy="286" r="18" fill="#FFFFFF"/>

  <!-- 5. Cardboard Box: Front Walls -->
  <!-- Front-Left Wall -->
  <polygon points="212,470 512,600 512,870 212,740" fill="#BA8244"/>
  <!-- Front-Right Wall -->
  <polygon points="512,600 812,470 812,740 512,870" fill="#D49B5B"/>

  <!-- Center Corner Seam -->
  <line x1="512" y1="600" x2="512,870" stroke="#7A4C1C" stroke-width="4"/>

  <!-- 6. Cardboard Box: Front Open Folded Flaps (Hanging Down) -->
  <!-- Front-Left Flap -->
  <polygon points="212,470 512,600 457,695 157,565" fill="#DFAB6E"/>
  <line x1="212" y1="470" x2="512" y2="600" stroke="#7A4C1C" stroke-width="4"/>

  <!-- Front-Right Flap -->
  <polygon points="512,600 812,470 867,565 567,695" fill="#E8B87E"/>
  <line x1="512" y1="600" x2="812" y2="470" stroke="#7A4C1C" stroke-width="4"/>

  <!-- 7. APK Badge on Front Box -->
  <rect x="422" y="740" width="180" height="60" fill="#3DDC84"/>
  <text x="512" y="783" font-family="'JetBrains Mono', Consolas, 'Segoe UI', monospace" font-size="34" font-weight="900" fill="#0D1117" text-anchor="middle" letter-spacing="4">APK</text>
</svg>`;

function createIco(images) {
  const count = images.length;
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((img) => img.buffer)]);
}

app.whenReady().then(async () => {
  const rootDir = path.resolve(__dirname, '..');
  const buildDir = path.join(rootDir, 'build');
  const publicDir = path.join(rootDir, 'frontend', 'public');
  const electronDir = path.join(rootDir, 'electron');

  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  // 1. Write SVG files
  fs.writeFileSync(path.join(buildDir, 'icon.svg'), SVG_CONTENT, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), SVG_CONTENT, 'utf8');
  console.log('✅ icon.svg (1024x1024) saved to build/ and frontend/public/');

  // 2. Open offscreen browser window at 1024x1024 resolution
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1024px; height: 1024px; background: transparent; overflow: hidden; }
  </style>
</head>
<body>
  ${SVG_CONTENT}
</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for rendering
  await new Promise((r) => setTimeout(r, 600));

  // Capture master 1024x1024 image
  const masterImage = await win.webContents.capturePage();
  const png1024 = masterImage.toPNG();

  // Save 1024x1024 PNG
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png1024);
  fs.writeFileSync(path.join(publicDir, 'icon.png'), png1024);
  fs.writeFileSync(path.join(electronDir, 'icon.png'), png1024);
  console.log('✅ icon.png (1024x1024) saved to build/, public/, electron/');

  // 3. Convert to WebP via canvas in the offscreen window
  const webpDataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const img = new Image();
      img.src = 'data:image/png;base64,${png1024.toString('base64')}';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/webp', 0.95));
      };
    })
  `);

  if (webpDataUrl && webpDataUrl.startsWith('data:image/webp;base64,')) {
    const webpBuffer = Buffer.from(webpDataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(buildDir, 'icon.webp'), webpBuffer);
    fs.writeFileSync(path.join(publicDir, 'icon.webp'), webpBuffer);
    console.log('✅ icon.webp (1024x1024) saved to build/ and public/');
  }

  // 4. Generate multi-resolution ICO for Windows (256, 128, 64, 48, 32, 16)
  const iconSizes = [256, 128, 64, 48, 32, 16];
  const icoImages = iconSizes.map((size) => {
    const resized = masterImage.resize({ width: size, height: size, quality: 'best' });
    return {
      width: size,
      height: size,
      buffer: resized.toPNG(),
    };
  });

  const icoBuffer = createIco(icoImages);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(electronDir, 'icon.ico'), icoBuffer);
  console.log('✅ icon.ico (multi-resolution 16-256px) saved to build/ and electron/');

  win.destroy();
  process.exit(0);
});
