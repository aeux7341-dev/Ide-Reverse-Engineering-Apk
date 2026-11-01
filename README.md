# ApkRtool IDE

Desktop integrated development environment designed specifically for Android APK reverse engineering, Smali bytecode editing, binary patching, and automated rebuilding.

ApkRtool combines modern code editing (Monaco), local reverse-engineering toolchains (Apktool, JADX, AAPT/AAPT2, ADB, JDK 11), an AI bytecode analysis agent with failover key pooling, and a zero-configuration desktop workspace.

---

## Technical Highlights

- **Dual Decompilation Pipeline**: Instant toggling between **Apktool** (Smali bytecode, decoded XML resources, raw assets) and **JADX** (decompiled high-level Java source reconstruction).
- **Modern Build Engine**: Selectable build backends between **AAPT2** (incremental resource compilation) and **AAPT Legacy** for older framework compatibility.
- **Embedded ADB Device Runner**: Native USB/wireless device detection, automated APK installation, live filtered Logcat streaming (`logcat -d -t`), screen capture, and integrated terminal emulation (`node-pty` / PowerShell).
- **Autonomous AI Smali Agent**: LLM assistant with automated multi-key rotation and 429 quota failover, Smali instruction explanations, inline patch generation, and MCP (Model Context Protocol) tool execution.
- **Delta Auto-Updates**: Native background update checking via `electron-updater` directly connected to GitHub Releases, downloading binary deltas without redownloading runtime packages.
- **Multilingual Support**: First-class internationalization across 11 world languages with instantaneous runtime switching and RTL support (English default, Indonesian, Chinese, Hindi, Spanish, Arabic, French, Bengali, Portuguese, Russian, Japanese).

---

## Architectural Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ApkRtool Desktop UI                             │
│       React 18 + TypeScript + Tailwind CSS + Monaco Editor 0.52        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (ContextBridge)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Electron Main Process                            │
│  - Custom Protocol (app://)        - Native FS Handle Adapter          │
│  - ADB ChildProcess Manager        - Terminal PTY Engine (node-pty)    │
│  - AI Agent Loop & MCP Bridge      - GitHub electron-updater           │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
┌───────▼───────────┐      ┌────────▼──────────┐       ┌─────────▼───────┐
│ Embedded Toolchain│      │ AI Key Pool Engine│       │   Target Device │
│ - Apktool 2.9.x   │      │ - Round-Robin     │       │ - ADB over USB  │
│ - JADX 1.5.x      │      │ - Quota Failover  │       │ - Wi-Fi ADB     │
│ - AAPT / AAPT2    │      │ - Skills Catalog  │       │ - Emulator      │
│ - JDK 11 Portable │      │ - MCP Stdio/HTTP  │       │                 │
└───────────────────┘      └───────────────────┘       └─────────────────┘
```

---

## Core Capabilities

### 1. Reverse Engineering & Bytecode Editing
- **Smali Disassembly & Assembly**: Parse and edit Dalvik bytecode (`.smali`) with syntax highlighting, indentation guides, and folding.
- **Android Manifest & Resource Decoding**: Direct editing of `AndroidManifest.xml`, resource tables (`resources.arsc`), values (`strings.xml`, `colors.xml`, `styles.xml`), and raw assets.
- **JADX Source View**: Inspect deobfuscated Java classes alongside bytecode for logic analysis.

### 2. Compilation, Alignment, and Signing
- **AAPT2 Compilation**: Fast incremental asset compilation using Android Asset Packaging Tool 2.
- **AAPT Legacy Mode**: Fallback compiler backend for legacy APK structures that fail modern AAPT2 resource parsing.
- **Automated Signature & Alignment**: Post-build pipeline automatically aligns byte boundaries via `zipalign` and applies a debug keystore with `apksigner` so the output APK can immediately install on physical hardware.

### 3. Integrated Android Debug Bridge (ADB)
- Detects attached physical devices and emulators (BlueStacks, LDPlayer, Android Studio AVD).
- Direct APK deployment via `adb install -r <output.apk>`.
- Filtered Logcat terminal (`adb logcat -e <regex>`) for real-time crash diagnosis and Smali log verification.
- Device screenshot capture streamed straight into the IDE workspace.

### 4. AI Smali Assistant & Key Pool
- Native agent engine built for reverse engineering queries.
- **Bulk Key Pool**: Supports entering multiple API keys separated by commas or newlines. The engine rotates requests across active keys and automatically fails over on HTTP 429 (rate-limit) or quota exhaustion.
- **GitHub Skills Catalog**: Loads markdown and YAML skills directly from local repositories or GitHub URLs to guide specific tasks (e.g. anti-debug bypass, SSL pinning hooks, Smali syntax patching).
- **Model Context Protocol (MCP)**: Communicates with local MCP tool servers over stdio and HTTP.

### 5. Draggable Native Settings Window
- Independent floating modal window movable via cursor titlebar dragging.
- Tabbed layout: Language, AI Key Pool, Decompiler & Build, Themes & Appearance, Skills & MCP, and About & System.

### 6. Background Auto-Updates
- Integrated with GitHub Releases via `electron-updater`.
- Silent delta checking at application startup.
- Visual status indicator and floating banner notification with a single-click **"Update & Restart"** action.

---

## Directory Structure

```
ApkRtool-IDE/
├── electron/
│   ├── main.js             # Electron main process, window management, auto-updater
│   ├── preload.js          # Context bridge exposing native APIs to renderer
│   ├── apiHandler.js       # Local HTTP/protocol API router for decompilation & builds
│   ├── aiAgentEngine.js    # AI agent orchestration, multi-key rotation, failover
│   ├── skillManager.js     # GitHub skills parser and catalog management
│   └── mcpManager.js       # Model Context Protocol stdio/HTTP server client
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components (Navbar, ActivityBar, Sidebar, EditorArea, etc.)
│   │   │   ├── SettingsModal.tsx  # Draggable desktop settings window
│   │   │   ├── BottomPanel.tsx    # Terminal, Output, Problems, APK Tester
│   │   │   └── ApkTesterRunner.tsx# ADB device controller & Logcat monitor
│   │   ├── utils/
│   │   │   ├── i18n.tsx    # 11-language translation dictionaries & context
│   │   │   └── fsHelper.ts # File system abstraction and recursive handlers
│   │   ├── App.tsx         # Root workspace container and updater event handler
│   │   └── main.tsx        # React entrypoint
├── tools/                  # Embedded offline tool binaries
│   ├── android-sdk/        # AAPT, AAPT2, ADB, apksigner, zipalign
│   ├── apktool/            # Apktool JAR & wrappers
│   ├── jadx/               # JADX command-line decompiler
│   └── jdk/                # Portable Java Runtime Environment (JDK 11)
├── scripts/
│   ├── test-checks.js      # Automated regression self-test suite
│   └── build-icons.js      # Flat vector icon asset generator
└── package.json            # Application manifest and electron-builder config
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x`
- **Git**

### Installation

Clone the repository and install root and frontend dependencies:

```bash
git clone https://github.com/aeux7341-dev/Ide-Reverse-Engineering-Apk.git
cd Ide-Reverse-Engineering-Apk
npm install
npm --prefix frontend install
```

### Running in Development

Compile the frontend bundle and launch the Electron application:

```bash
npm run dev
```

### Running Self-Checks

Run the automated verification suite (tools resolution, design tokens, key pool failover, i18n dictionary integrity, updater bindings):

```bash
node scripts/test-checks.js
```

### Building Standalone Distribution (Windows NSIS)

To build a standalone Windows executable (`.exe` installer):

```bash
npm run build
```

The resulting package will be output to:
```
release/ApkRtool IDE Setup 0.3.2.exe
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` | Create New File |
| `Ctrl + O` | Open Workspace Directory |
| `Ctrl + S` | Save Active File |
| `Ctrl + Shift + S` | Save All Open Files |
| `Ctrl + W` | Close Active Tab |
| `Ctrl + P` | Command Palette |
| `Ctrl + B` | Toggle Primary Sidebar |
| `Ctrl + ~` | Toggle Bottom Terminal & Dock Panel |
| `Ctrl + ,` | Open Settings Window |
| `F11` | Toggle Fullscreen Mode |
| `F12` | Toggle Developer Tools (Dev Mode) |

---

## Supported Languages

ApkRtool IDE includes full UI translation across 11 languages with zero external dependencies:

1. **English** (`en`) — Default
2. **Bahasa Indonesia** (`id`)
3. **简体中文** (`zh`)
4. **हिन्दी** (`hi`)
5. **Español** (`es`)
6. **العربية** (`ar`) — Right-to-Left (RTL) layout
7. **Français** (`fr`)
8. **বাংলা** (`bn`)
9. **Português** (`pt`)
10. **Русский** (`ru`)
11. **日本語** (`ja`)

Languages can be switched on the fly from the titlebar or the draggable Settings window. The selection persists in local workspace storage.

---

## License

This project is licensed under the Apache License 2.0. Third-party binary tools (`apktool`, `jadx`, `adb`, `aapt2`) retain their respective original licenses.
