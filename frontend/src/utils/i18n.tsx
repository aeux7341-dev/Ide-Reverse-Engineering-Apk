/**
 * Internationalization (i18n) Engine for ApkRtool IDE
 * Supports 11 languages: English (default), Indonesian, Chinese, Hindi, Spanish,
 * Arabic, French, Bengali, Portuguese, Russian, Japanese.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

export type LanguageCode =
  | 'en'
  | 'id'
  | 'zh'
  | 'hi'
  | 'es'
  | 'ar'
  | 'fr'
  | 'bn'
  | 'pt'
  | 'ru'
  | 'ja';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  direction?: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', direction: 'ltr' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', direction: 'ltr' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', direction: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', direction: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', direction: 'rtl' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', direction: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', direction: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', direction: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', direction: 'ltr' },
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Top Navbar
    'nav.file': 'File',
    'nav.edit': 'Edit',
    'nav.view': 'View',
    'nav.decompiler': 'Decompiler',
    'nav.build': 'Build',
    'nav.tools': 'Tools',
    'nav.help': 'Help',
    'nav.newFile': 'New File',
    'nav.openFolder': 'Open Workspace Folder...',
    'nav.openFile': 'Open File...',
    'nav.openWorkspaceFile': 'Open Workspace from File...',
    'nav.openRecent': 'Open Recent',
    'nav.save': 'Save',
    'nav.saveAs': 'Save As...',
    'nav.saveAll': 'Save All',
    'nav.settings': 'Settings',
    'nav.exit': 'Exit',
    'nav.commandPalette': 'Command Palette...',
    'nav.decompileApk': 'Decompile Android APK...',
    'nav.buildApk': 'Build APK',
    'nav.apkRunner': 'APK Tester Runner & Emulator',
    'nav.terminal': 'Terminal',
    'nav.skillsCatalog': 'Skills Catalog',
    'nav.mcpServers': 'MCP Servers',
    'nav.documentation': 'Documentation',
    'nav.about': 'About ApkRtool IDE',

    // ActivityBar & Sidebar
    'panel.explorer': 'Explorer',
    'panel.ai': 'AI Assistant',
    'panel.modifier': 'APK Modifier',
    'panel.settings': 'Settings',
    'panel.account': 'Account & Preferences',

    // Settings Window
    'settings.title': 'Settings — ApkRtool IDE',
    'settings.subtitle': 'Manage workspace preferences, language, AI keys, and compiler tools',
    'settings.tab.language': 'Language',
    'settings.tab.ai': 'AI & Key Pool',
    'settings.tab.decompiler': 'Decompiler & Build',
    'settings.tab.appearance': 'Appearance',
    'settings.tab.plugins': 'Skills & MCP',
    'settings.tab.about': 'About & System',

    'settings.lang.title': 'Display Language',
    'settings.lang.desc': 'Select your preferred interface language. Changes apply immediately.',
    'settings.lang.active': 'Active Language',

    'settings.ai.title': 'AI API Key Pool (Bulk & Failover)',
    'settings.ai.desc': 'Enter one or multiple API keys separated by commas or lines for automatic rotation and quota failover.',
    'settings.ai.placeholder': 'Enter API keys (one per line or comma-separated)...',

    'settings.decompile.title': 'Decompiler Engine',
    'settings.decompile.apktoolDesc': 'Decompile to Smali bytecode, resources, and AndroidManifest.xml (Fast & editable).',
    'settings.decompile.jadxDesc': 'Decompile to readable high-level Java source code (Analysis only).',
    'settings.compiler.title': 'APK Compiler Backend',
    'settings.compiler.aapt2Desc': 'Modern AAPT2 pipeline with incremental resource compilation.',
    'settings.compiler.legacyDesc': 'Legacy AAPT pipeline for older Android compatibility.',

    'settings.theme.title': 'Theme & Accent',
    'settings.theme.desc': 'Customize UI theme colors and contrast.',

    'settings.about.version': 'Version',
    'settings.about.description': 'Modern Android APK Decompiler, Smali Bytecode Editor & Rebuilder',
    'settings.close': 'Close',

    // Welcome & General
    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'Professional Android APK Reverse Engineering & Smali Studio',
    'welcome.newFile': 'New File',
    'welcome.openFolder': 'Open Folder',
    'welcome.decompile': 'Decompile APK',
    'welcome.recentWorkspaces': 'Recent Workspaces',
    'welcome.noRecent': 'No recent workspaces found',

    // Bottom Panel
    'bottom.problems': 'Problems',
    'bottom.output': 'Output',
    'bottom.debug': 'Debug',
    'bottom.terminal': 'Terminal',
    'bottom.apkRunner': 'APK Tester',

    // Auto-Updater
    'updater.checking': 'Checking for updates...',
    'updater.available': 'New release found. Downloading...',
    'updater.ready': 'Update ready to install!',
    'updater.restart': 'Update & Restart',
    'updater.later': 'Later',
    'updater.upToDate': 'ApkRtool IDE is up to date.',
    'updater.check': 'Check for Updates',
  },
  id: {
    'nav.file': 'Berkas',
    'nav.edit': 'Ubah',
    'nav.view': 'Tampilan',
    'nav.decompiler': 'Dekompiler',
    'nav.build': 'Bangun',
    'nav.tools': 'Alat',
    'nav.help': 'Bantuan',
    'nav.newFile': 'Berkas Baru',
    'nav.openFolder': 'Buka Folder Workspace...',
    'nav.openFile': 'Buka Berkas...',
    'nav.openWorkspaceFile': 'Buka Workspace dari Berkas...',
    'nav.openRecent': 'Buka Terakhir',
    'nav.save': 'Simpan',
    'nav.saveAs': 'Simpan Sebagai...',
    'nav.saveAll': 'Simpan Semua',
    'nav.settings': 'Pengaturan',
    'nav.exit': 'Keluar',
    'nav.commandPalette': 'Palet Perintah...',
    'nav.decompileApk': 'Dekompilasi APK Android...',
    'nav.buildApk': 'Bangun APK',
    'nav.apkRunner': 'Penguji APK & Emulator',
    'nav.terminal': 'Terminal',
    'nav.skillsCatalog': 'Katalog Skill',
    'nav.mcpServers': 'Server MCP',
    'nav.documentation': 'Dokumentasi',
    'nav.about': 'Tentang ApkRtool IDE',

    'panel.explorer': 'Penjelajah',
    'panel.ai': 'Asisten AI',
    'panel.modifier': 'Pengubah APK',
    'panel.settings': 'Pengaturan',
    'panel.account': 'Akun & Preferensi',

    'settings.title': 'Pengaturan — ApkRtool IDE',
    'settings.subtitle': 'Atur preferensi ruang kerja, bahasa, API key AI, dan perangkat kompilasi',
    'settings.tab.language': 'Bahasa',
    'settings.tab.ai': 'AI & Pool Key',
    'settings.tab.decompiler': 'Dekompiler & Build',
    'settings.tab.appearance': 'Tampilan',
    'settings.tab.plugins': 'Skill & MCP',
    'settings.tab.about': 'Tentang & Sistem',

    'settings.lang.title': 'Bahasa Tampilan',
    'settings.lang.desc': 'Pilih bahasa antarmuka yang diinginkan. Perubahan langsung diterapkan.',
    'settings.lang.active': 'Bahasa Aktif',

    'settings.ai.title': 'Pool API Key AI (Bulk & Failover)',
    'settings.ai.desc': 'Masukkan satu atau beberapa API key dipisahkan koma atau baris baru untuk rotasi otomatis.',
    'settings.ai.placeholder': 'Masukkan API key (satu per baris atau pisahkan koma)...',

    'settings.decompile.title': 'Mesin Dekompilasi',
    'settings.decompile.apktoolDesc': 'Dekompilasi ke bytecode Smali, sumber daya, dan AndroidManifest.xml.',
    'settings.decompile.jadxDesc': 'Dekompilasi ke kode sumber Java tingkat tinggi yang mudah dibaca.',
    'settings.compiler.title': 'Backend Kompiler APK',
    'settings.compiler.aapt2Desc': 'Pipeline AAPT2 modern dengan kompilasi sumber daya bertahap.',
    'settings.compiler.legacyDesc': 'Pipeline AAPT lawas untuk kompatibilitas Android lama.',

    'settings.theme.title': 'Tema & Aksen',
    'settings.theme.desc': 'Sesuaikan warna tema dan kontras antarmuka.',

    'settings.about.version': 'Versi',
    'settings.about.description': 'Dekompiler APK Android Modern, Editor Bytecode Smali & Pembangun Ulang',
    'settings.close': 'Tutup',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'Studio Rekayasa Balik APK & Smali Android Profesional',
    'welcome.newFile': 'Berkas Baru',
    'welcome.openFolder': 'Buka Folder',
    'welcome.decompile': 'Dekompilasi APK',
    'welcome.recentWorkspaces': 'Workspace Terakhir',
    'welcome.noRecent': 'Tidak ada workspace terakhir',

    'bottom.problems': 'Masalah',
    'bottom.output': 'Keluaran',
    'bottom.debug': 'Debug',
    'bottom.terminal': 'Terminal',
    'bottom.apkRunner': 'Penguji APK',

    // Auto-Updater
    'updater.checking': 'Memeriksa pembaruan...',
    'updater.available': 'Rilis baru ditemukan. Mengunduh...',
    'updater.ready': 'Pembaruan siap dipasang!',
    'updater.restart': 'Perbarui & Mulai Ulang',
    'updater.later': 'Nanti',
    'updater.upToDate': 'ApkRtool IDE sudah versi terbaru.',
    'updater.check': 'Periksa Pembaruan',
  },
  zh: {
    'nav.file': '文件',
    'nav.edit': '编辑',
    'nav.view': '视图',
    'nav.decompiler': '反编译',
    'nav.build': '构建',
    'nav.tools': '工具',
    'nav.help': '帮助',
    'nav.newFile': '新建文件',
    'nav.openFolder': '打开工作区文件夹...',
    'nav.openFile': '打开文件...',
    'nav.openWorkspaceFile': '从文件打开工作区...',
    'nav.openRecent': '打开最近',
    'nav.save': '保存',
    'nav.saveAs': '另存为...',
    'nav.saveAll': '全部保存',
    'nav.settings': '设置',
    'nav.exit': '退出',
    'nav.commandPalette': '命令面板...',
    'nav.decompileApk': '反编译 Android APK...',
    'nav.buildApk': '构建 APK',
    'nav.apkRunner': 'APK 测试运行器与模拟器',
    'nav.terminal': '终端',
    'nav.skillsCatalog': '技能目录',
    'nav.mcpServers': 'MCP 服务器',
    'nav.documentation': '文档',
    'nav.about': '关于 ApkRtool IDE',

    'panel.explorer': '资源管理器',
    'panel.ai': 'AI 助手',
    'panel.modifier': 'APK 修改器',
    'panel.settings': '设置',
    'panel.account': '账户与偏好设置',

    'settings.title': '设置 — ApkRtool IDE',
    'settings.subtitle': '管理工作区偏好设置、语言、AI 密钥和编译器工具',
    'settings.tab.language': '语言',
    'settings.tab.ai': 'AI 与密钥池',
    'settings.tab.decompiler': '反编译器与构建',
    'settings.tab.appearance': '外观',
    'settings.tab.plugins': '技能与 MCP',
    'settings.tab.about': '关于与系统',

    'settings.lang.title': '显示语言',
    'settings.lang.desc': '选择首选界面语言，立即生效。',
    'settings.lang.active': '当前语言',

    'settings.ai.title': 'AI API 密钥池（批量与故障转移）',
    'settings.ai.desc': '输入一个或多个以逗号或换行符分隔的 API 密钥以启用自动轮询。',
    'settings.ai.placeholder': '输入 API 密钥（每行一个或用逗号分隔）...',

    'settings.decompile.title': '反编译引擎',
    'settings.decompile.apktoolDesc': '反编译为 Smali 字节码、资源和 AndroidManifest.xml。',
    'settings.decompile.jadxDesc': '反编译为可读的高级 Java 源代码（仅分析）。',
    'settings.compiler.title': 'APK 编译器后端',
    'settings.compiler.aapt2Desc': '带有增量资源编译的现代 AAPT2 管道。',
    'settings.compiler.legacyDesc': '用于兼容旧版 Android 的传统 AAPT 管道。',

    'settings.theme.title': '主题与强调色',
    'settings.theme.desc': '自定义界面主题颜色和对比度。',

    'settings.about.version': '版本',
    'settings.about.description': '现代 Android APK 反编译器、Smali 字节码编辑器和重建器',
    'settings.close': '关闭',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': '专业 Android APK 逆向工程与 Smali 工作室',
    'welcome.newFile': '新建文件',
    'welcome.openFolder': '打开文件夹',
    'welcome.decompile': '反编译 APK',
    'welcome.recentWorkspaces': '最近工作区',
    'welcome.noRecent': '未找到最近工作区',

    'bottom.problems': '问题',
    'bottom.output': '输出',
    'bottom.debug': '调试',
    'bottom.terminal': '终端',
    'bottom.apkRunner': 'APK 测试器',
  },
  hi: {
    'nav.file': 'फ़ाइल',
    'nav.edit': 'संपादित करें',
    'nav.view': 'देखें',
    'nav.decompiler': 'डिकम्पाइलर',
    'nav.build': 'बिल्ड',
    'nav.tools': 'उपकरण',
    'nav.help': 'सहायता',
    'nav.newFile': 'नई फ़ाइल',
    'nav.openFolder': 'वर्कस्पेस फ़ोल्डर खोलें...',
    'nav.openFile': 'फ़ाइल खोलें...',
    'nav.openWorkspaceFile': 'फ़ाइल से वर्कस्पेस खोलें...',
    'nav.openRecent': 'हाल ही में खोला गया',
    'nav.save': 'सहेजें',
    'nav.saveAs': 'इस रूप में सहेजें...',
    'nav.saveAll': 'सभी सहेजें',
    'nav.settings': 'सेटिंग्स',
    'nav.exit': 'बाहर निकलें',
    'nav.commandPalette': 'कमांड पैलेट...',
    'nav.decompileApk': 'Android APK डिकम्पाइल करें...',
    'nav.buildApk': 'APK बनाएं',
    'nav.apkRunner': 'APK परीक्षक व एमुलेटर',
    'nav.terminal': 'टर्मिनल',
    'nav.skillsCatalog': 'कौशल कैटलॉग',
    'nav.mcpServers': 'MCP सर्वर',
    'nav.documentation': 'दस्तावेज़ीकरण',
    'nav.about': 'ApkRtool IDE के बारे में',

    'panel.explorer': 'एक्सप्लोरर',
    'panel.ai': 'AI सहायक',
    'panel.modifier': 'APK मॉडिफायर',
    'panel.settings': 'सेटिंग्स',
    'panel.account': 'खाता व प्राथमिकताएं',

    'settings.title': 'सेटिंग्स — ApkRtool IDE',
    'settings.subtitle': 'प्राथमिकताएं, भाषा, AI कुंजियाँ और कंपाइलर प्रबंधित करें',
    'settings.tab.language': 'भाषा',
    'settings.tab.ai': 'AI कुंजी पूल',
    'settings.tab.decompiler': 'डिकम्पाइलर व बिल्ड',
    'settings.tab.appearance': 'दिखावट',
    'settings.tab.plugins': 'कौशल व MCP',
    'settings.tab.about': 'के बारे में व सिस्टम',

    'settings.lang.title': 'प्रदर्शन भाषा',
    'settings.lang.desc': 'अपनी पसंदीदा भाषा चुनें। परिवर्तन तुरंत लागू होते हैं।',
    'settings.lang.active': 'सक्रिय भाषा',

    'settings.ai.title': 'AI API कुंजी पूल',
    'settings.ai.desc': 'स्वचालित रोटेशन के लिए एकाधिक कुंजियाँ दर्ज करें।',
    'settings.ai.placeholder': 'API कुंजियाँ दर्ज करें...',

    'settings.decompile.title': 'डिकम्पाइलर इंजन',
    'settings.decompile.apktoolDesc': 'Smali बाइटकोड और संसाधनों में डिकम्पाइल करें।',
    'settings.decompile.jadxDesc': 'पठनीय Java स्रोत कोड में डिकम्पाइल करें।',
    'settings.compiler.title': 'APK कंपाइलर बैकएंड',
    'settings.compiler.aapt2Desc': 'आधुनिक AAPT2 पाइपलाइन।',
    'settings.compiler.legacyDesc': 'लेगेसी AAPT पाइपलाइन।',

    'settings.theme.title': 'थीम और रंग',
    'settings.theme.desc': 'UI थीम रंगों को अनुकूलित करें।',

    'settings.about.version': 'संस्करण',
    'settings.about.description': 'आधुनिक Android APK डिकम्पाइलर व Smali संपादक',
    'settings.close': 'बंद करें',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'पेशेवर Android APK रिवर्स इंजीनियरिंग स्टूडियो',
    'welcome.newFile': 'नई फ़ाइल',
    'welcome.openFolder': 'फ़ोल्डर खोलें',
    'welcome.decompile': 'APK डिकम्पाइल करें',
    'welcome.recentWorkspaces': 'हाल के वर्कस्पेस',
    'welcome.noRecent': 'कोई हालिया वर्कस्पेस नहीं मिला',

    'bottom.problems': 'समस्याएँ',
    'bottom.output': 'आउटपुट',
    'bottom.debug': 'डीबग',
    'bottom.terminal': 'टर्मिनल',
    'bottom.apkRunner': 'APK परीक्षक',
  },
  es: {
    'nav.file': 'Archivo',
    'nav.edit': 'Editar',
    'nav.view': 'Ver',
    'nav.decompiler': 'Descompilador',
    'nav.build': 'Compilar',
    'nav.tools': 'Herramientas',
    'nav.help': 'Ayuda',
    'nav.newFile': 'Nuevo Archivo',
    'nav.openFolder': 'Abrir Carpeta de Trabajo...',
    'nav.openFile': 'Abrir Archivo...',
    'nav.openWorkspaceFile': 'Abrir Espacio de Trabajo desde Archivo...',
    'nav.openRecent': 'Abrir Reciente',
    'nav.save': 'Guardar',
    'nav.saveAs': 'Guardar Como...',
    'nav.saveAll': 'Guardar Todo',
    'nav.settings': 'Configuración',
    'nav.exit': 'Salir',
    'nav.commandPalette': 'Paleta de Comandos...',
    'nav.decompileApk': 'Descompilar APK Android...',
    'nav.buildApk': 'Compilar APK',
    'nav.apkRunner': 'Ejecutor APK y Emulador',
    'nav.terminal': 'Terminal',
    'nav.skillsCatalog': 'Catálogo de Habilidades',
    'nav.mcpServers': 'Servidores MCP',
    'nav.documentation': 'Documentación',
    'nav.about': 'Acerca de ApkRtool IDE',

    'panel.explorer': 'Explorador',
    'panel.ai': 'Asistente IA',
    'panel.modifier': 'Modificador APK',
    'panel.settings': 'Configuración',
    'panel.account': 'Cuenta y Preferencias',

    'settings.title': 'Configuración — ApkRtool IDE',
    'settings.subtitle': 'Gestionar preferencias, idioma, claves IA y compilador',
    'settings.tab.language': 'Idioma',
    'settings.tab.ai': 'IA y Claves',
    'settings.tab.decompiler': 'Descompilador y Build',
    'settings.tab.appearance': 'Apariencia',
    'settings.tab.plugins': 'Habilidades y MCP',
    'settings.tab.about': 'Acerca de y Sistema',

    'settings.lang.title': 'Idioma de Interfaz',
    'settings.lang.desc': 'Seleccione su idioma preferido. Los cambios se aplican de inmediato.',
    'settings.lang.active': 'Idioma Activo',

    'settings.ai.title': 'Grupo de Claves API de IA',
    'settings.ai.desc': 'Ingrese múltiples claves para rotación automática y conmutación por error.',
    'settings.ai.placeholder': 'Ingrese claves API (una por línea o separadas por comas)...',

    'settings.decompile.title': 'Motor de Descompilación',
    'settings.decompile.apktoolDesc': 'Descompilar a bytecode Smali y recursos.',
    'settings.decompile.jadxDesc': 'Descompilar a código fuente Java legible.',
    'settings.compiler.title': 'Compilador APK',
    'settings.compiler.aapt2Desc': 'Canal AAPT2 moderno con compilación incremental.',
    'settings.compiler.legacyDesc': 'Canal AAPT heredado.',

    'settings.theme.title': 'Tema y Contraste',
    'settings.theme.desc': 'Personalice los colores de la interfaz.',

    'settings.about.version': 'Versión',
    'settings.about.description': 'Descompilador APK Android Moderno y Editor de Bytecode Smali',
    'settings.close': 'Cerrar',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'Estudio Profesional de Ingeniería Inversa de APK Android',
    'welcome.newFile': 'Nuevo Archivo',
    'welcome.openFolder': 'Abrir Carpeta',
    'welcome.decompile': 'Descompilar APK',
    'welcome.recentWorkspaces': 'Espacios Recientes',
    'welcome.noRecent': 'No se encontraron espacios recientes',

    'bottom.problems': 'Problemas',
    'bottom.output': 'Salida',
    'bottom.debug': 'Depurar',
    'bottom.terminal': 'Terminal',
    'bottom.apkRunner': 'Probador APK',
  },
  ar: {
    'nav.file': 'ملف',
    'nav.edit': 'تعديل',
    'nav.view': 'عرض',
    'nav.decompiler': 'مفكك التجميع',
    'nav.build': 'بناء',
    'nav.tools': 'أدوات',
    'nav.help': 'مساعدة',
    'nav.newFile': 'ملف جديد',
    'nav.openFolder': 'فتح مجلد مساحة العمل...',
    'nav.openFile': 'فتح ملف...',
    'nav.openWorkspaceFile': 'فتح مساحة عمل من ملف...',
    'nav.openRecent': 'فتح الأحدث',
    'nav.save': 'حفظ',
    'nav.saveAs': 'حفظ باسم...',
    'nav.saveAll': 'حفظ الكل',
    'nav.settings': 'الإعدادات',
    'nav.exit': 'خروج',
    'nav.commandPalette': 'لوحة الأوامر...',
    'nav.decompileApk': 'تفكيك حزمة APK لنظام أندرويد...',
    'nav.buildApk': 'بناء APK',
    'nav.apkRunner': 'مُشغل ومُحاكي APK',
    'nav.terminal': 'الطرفية',
    'nav.skillsCatalog': 'دليل المهارات',
    'nav.mcpServers': 'خوادم MCP',
    'nav.documentation': 'التوثيق',
    'nav.about': 'حول ApkRtool IDE',

    'panel.explorer': 'المستكشف',
    'panel.ai': 'مساعد الذكاء الاصطناعي',
    'panel.modifier': 'معدل APK',
    'panel.settings': 'الإعدادات',
    'panel.account': 'الحساب والتفضيلات',

    'settings.title': 'الإعدادات — ApkRtool IDE',
    'settings.subtitle': 'إدارة التفضيلات واللغة ومفاتيح الذكاء الاصطناعي وأدوات البناء',
    'settings.tab.language': 'اللغة',
    'settings.tab.ai': 'الذكاء الاصطناعي والمفاتيح',
    'settings.tab.decompiler': 'التفكيك والبناء',
    'settings.tab.appearance': 'المظهر',
    'settings.tab.plugins': 'المهارات و MCP',
    'settings.tab.about': 'حول والنظام',

    'settings.lang.title': 'لغة العرض',
    'settings.lang.desc': 'اختر لغة الواجهة المفضلة. يتم تطبيق التغييرات فوراً.',
    'settings.lang.active': 'اللغة الحالية',

    'settings.ai.title': 'مجموعة مفاتيح الذكاء الاصطناعي',
    'settings.ai.desc': 'أدخل عدة مفاتيح للتدوير التلقائي وتجنب حدود الحصص.',
    'settings.ai.placeholder': 'أدخل مفاتيح API (مفتاح لكل سطر أو مفصولة بفواصل)...',

    'settings.decompile.title': 'محرك التفكيك',
    'settings.decompile.apktoolDesc': 'تفكيك إلى كود Smali والموارد ومصفوفة التطبيق.',
    'settings.decompile.jadxDesc': 'تفكيك إلى كود جافا قابل للقراءة.',
    'settings.compiler.title': 'مترجم APK',
    'settings.compiler.aapt2Desc': 'مسار AAPT2 الحديث مع تجميع الموارد التدريجي.',
    'settings.compiler.legacyDesc': 'مسار AAPT التقليدي للأجهزة القديمة.',

    'settings.theme.title': 'السمة والتباين',
    'settings.theme.desc': 'تخصيص ألوان الواجهة ومظهرها.',

    'settings.about.version': 'الإصدار',
    'settings.about.description': 'أداة تفكيك وتعديل وبناء APK الحديثة',
    'settings.close': 'إغلاق',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'استوديو الهندسة العكسية الاحترافي لتطبيقات أندرويد',
    'welcome.newFile': 'ملف جديد',
    'welcome.openFolder': 'فتح مجلد',
    'welcome.decompile': 'تفكيك APK',
    'welcome.recentWorkspaces': 'مساحات العمل الأخيرة',
    'welcome.noRecent': 'لم يتم العثور على مساحات عمل حديثة',

    'bottom.problems': 'المشاكل',
    'bottom.output': 'المخرجات',
    'bottom.debug': 'التصحيح',
    'bottom.terminal': 'الطرفية',
    'bottom.apkRunner': 'مختبر APK',
  },
  fr: {
    'nav.file': 'Fichier',
    'nav.edit': 'Modifier',
    'nav.view': 'Affichage',
    'nav.decompiler': 'Décompilateur',
    'nav.build': 'Compiler',
    'nav.tools': 'Outils',
    'nav.help': 'Aide',
    'nav.newFile': 'Nouveau fichier',
    'nav.openFolder': 'Ouvrir le dossier de travail...',
    'nav.openFile': 'Ouvrir un fichier...',
    'nav.openWorkspaceFile': 'Ouvrir un espace depuis un fichier...',
    'nav.openRecent': 'Ouvrir récents',
    'nav.save': 'Enregistrer',
    'nav.saveAs': 'Enregistrer sous...',
    'nav.saveAll': 'Tout enregistrer',
    'nav.settings': 'Paramètres',
    'nav.exit': 'Quitter',
    'nav.commandPalette': 'Palette de commandes...',
    'nav.decompileApk': 'Décompiler APK Android...',
    'nav.buildApk': 'Compiler APK',
    'nav.apkRunner': 'Testeur APK & Émulateur',
    'nav.terminal': 'Terminal',
    'nav.skillsCatalog': 'Catalogue de compétences',
    'nav.mcpServers': 'Serveurs MCP',
    'nav.documentation': 'Documentation',
    'nav.about': 'À propos de ApkRtool IDE',

    'panel.explorer': 'Explorateur',
    'panel.ai': 'Assistant IA',
    'panel.modifier': 'Modificateur APK',
    'panel.settings': 'Paramètres',
    'panel.account': 'Compte et préférences',

    'settings.title': 'Paramètres — ApkRtool IDE',
    'settings.subtitle': 'Gérer les préférences, la langue, les clés IA et le compilateur',
    'settings.tab.language': 'Langue',
    'settings.tab.ai': 'IA et Clés',
    'settings.tab.decompiler': 'Décompilateur & Build',
    'settings.tab.appearance': 'Apparence',
    'settings.tab.plugins': 'Compétences & MCP',
    'settings.tab.about': 'À propos & Système',

    'settings.lang.title': 'Langue d’affichage',
    'settings.lang.desc': 'Sélectionnez votre langue d’interface préférée.',
    'settings.lang.active': 'Langue active',

    'settings.ai.title': 'Groupe de clés API IA',
    'settings.ai.desc': 'Entrez plusieurs clés API pour une rotation automatique.',
    'settings.ai.placeholder': 'Entrez les clés API (une par ligne ou séparées par des virgules)...',

    'settings.decompile.title': 'Moteur de décompilation',
    'settings.decompile.apktoolDesc': 'Décompiler en bytecode Smali et ressources.',
    'settings.decompile.jadxDesc': 'Décompiler en code source Java lisible.',
    'settings.compiler.title': 'Compilateur APK',
    'settings.compiler.aapt2Desc': 'Pipeline AAPT2 moderne avec compilation incrémentielle.',
    'settings.compiler.legacyDesc': 'Pipeline AAPT classique pour compatibilité.',

    'settings.theme.title': 'Thème et contraste',
    'settings.theme.desc': 'Personnalisez les couleurs de l’interface.',

    'settings.about.version': 'Version',
    'settings.about.description': 'Décompilateur et éditeur de bytecode Smali Android moderne',
    'settings.close': 'Fermer',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'Studio d’ingénierie inverse Android APK professionnel',
    'welcome.newFile': 'Nouveau fichier',
    'welcome.openFolder': 'Ouvrir dossier',
    'welcome.decompile': 'Décompiler APK',
    'welcome.recentWorkspaces': 'Espaces récents',
    'welcome.noRecent': 'Aucun espace récent trouvé',

    'bottom.problems': 'Problèmes',
    'bottom.output': 'Sortie',
    'bottom.debug': 'Débogage',
    'bottom.terminal': 'Terminal',
    'bottom.apkRunner': 'Testeur APK',
  },
  bn: {
    'nav.file': 'ফাইল',
    'nav.edit': 'সম্পাদনা',
    'nav.view': 'ভিউ',
    'nav.decompiler': 'ডিকম্পাইলার',
    'nav.build': 'বিল্ড',
    'nav.tools': 'টুলস',
    'nav.help': 'সাহায্য',
    'nav.newFile': 'নতুন ফাইল',
    'nav.openFolder': 'ওয়ার্কস্পেস ফোল্ডার খুলুন...',
    'nav.openFile': 'ফাইল খুলুন...',
    'nav.openWorkspaceFile': 'ফাইল থেকে ওয়ার্কস্পেস...',
    'nav.openRecent': 'সাম্প্রতিক খুলুন',
    'nav.save': 'সংরক্ষণ',
    'nav.saveAs': 'হিসেবে সংরক্ষণ...',
    'nav.saveAll': 'সব সংরক্ষণ',
    'nav.settings': 'সেটিংস',
    'nav.exit': 'প্রস্থান',
    'nav.commandPalette': 'কমান্ড প্যালেট...',
    'nav.decompileApk': 'অ্যান্ড্রয়েড APK ডিকম্পাইল...',
    'nav.buildApk': 'APK বিল্ড করুন',
    'nav.apkRunner': 'APK রানার ও এমুলেটর',
    'nav.terminal': 'টার্মিনাল',
    'nav.skillsCatalog': 'স্কিল ক্যাটালগ',
    'nav.mcpServers': 'MCP সার্ভার',
    'nav.documentation': 'নথি',
    'nav.about': 'ApkRtool IDE সম্পর্কে',

    'panel.explorer': 'এক্সপ্লোরার',
    'panel.ai': 'AI সহকারী',
    'panel.modifier': 'APK পরিবর্তনকারী',
    'panel.settings': 'সেটিংস',
    'panel.account': 'অ্যাকাউন্ট ও পছন্দ',

    'settings.title': 'সেটিংস — ApkRtool IDE',
    'settings.subtitle': 'ওয়ার্কস্পেস পছন্দ, ভাষা, AI কী এবং কম্পাইলার পরিচালনা করুন',
    'settings.tab.language': 'ভাষা',
    'settings.tab.ai': 'AI কী পুল',
    'settings.tab.decompiler': 'ডিকম্পাইলার ও বিল্ড',
    'settings.tab.appearance': 'চেহারা',
    'settings.tab.plugins': 'স্কিল ও MCP',
    'settings.tab.about': 'সম্পর্কে ও সিস্টেম',

    'settings.lang.title': 'প্রদর্শন ভাষা',
    'settings.lang.desc': 'পছন্দের ভাষা নির্বাচন করুন। তাৎক্ষণিক কার্যকর হবে।',
    'settings.lang.active': 'সক্রিয় ভাষা',

    'settings.ai.title': 'AI API কী পুল',
    'settings.ai.desc': 'স্বয়ংক্রিয় আবর্তনের জন্য একাধিক কী প্রবেশ করান।',
    'settings.ai.placeholder': 'API কী লিখুন (প্রতি লাইনে একটি বা কমা দ্বারা পৃথক)...',

    'settings.decompile.title': 'ডিকম্পাইলার ইঞ্জিন',
    'settings.decompile.apktoolDesc': 'Smali বাইটকোড এবং রিসোর্সে রূপান্তর করুন।',
    'settings.decompile.jadxDesc': 'পঠনযোগ্য Java কোডে ডিকম্পাইল করুন।',
    'settings.compiler.title': 'APK কম্পাইলার ব্যাকএন্ড',
    'settings.compiler.aapt2Desc': 'আধুনিক AAPT2 পাইপলাইন।',
    'settings.compiler.legacyDesc': 'লেগ্যাসি AAPT পাইপলাইন।',

    'settings.theme.title': 'থিম ও বৈসাদৃশ্য',
    'settings.theme.desc': 'ইন্টারফেসের রঙ কাস্টমাইজ করুন।',

    'settings.about.version': 'সংস্করণ',
    'settings.about.description': 'আধুনিক Android APK ডিকম্পাইলার ও Smali এডিটর',
    'settings.close': 'বন্ধ করুন',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'পেশাদার Android APK রিভার্স ইঞ্জিনিয়ারিং স্টুডিও',
    'welcome.newFile': 'নতুন ফাইল',
    'welcome.openFolder': 'ফোল্ডার খুলুন',
    'welcome.decompile': 'APK ডিকম্পাইল',
    'welcome.recentWorkspaces': 'সাম্প্রতিক ওয়ার্কস্পেস',
    'welcome.noRecent': 'কোনো সাম্প্রতিক ওয়ার্কস্পেস নেই',

    'bottom.problems': 'সমস্যা',
    'bottom.output': 'আউটপুট',
    'bottom.debug': 'ডিবাগ',
    'bottom.terminal': 'টার্মিনাল',
    'bottom.apkRunner': 'APK টেস্টার',
  },
  pt: {
    'nav.file': 'Arquivo',
    'nav.edit': 'Editar',
    'nav.view': 'Exibir',
    'nav.decompiler': 'Descompilador',
    'nav.build': 'Compilar',
    'nav.tools': 'Ferramentas',
    'nav.help': 'Ajuda',
    'nav.newFile': 'Novo Arquivo',
    'nav.openFolder': 'Abrir Pasta do Workspace...',
    'nav.openFile': 'Abrir Arquivo...',
    'nav.openWorkspaceFile': 'Abrir Workspace de Arquivo...',
    'nav.openRecent': 'Abrir Recente',
    'nav.save': 'Salvar',
    'nav.saveAs': 'Salvar Como...',
    'nav.saveAll': 'Salvar Tudo',
    'nav.settings': 'Configurações',
    'nav.exit': 'Sair',
    'nav.commandPalette': 'Paleta de Comandos...',
    'nav.decompileApk': 'Descompilar APK Android...',
    'nav.buildApk': 'Compilar APK',
    'nav.apkRunner': 'Testador APK e Emulador',
    'nav.terminal': 'Terminal',
    'nav.skillsCatalog': 'Catálogo de Habilidades',
    'nav.mcpServers': 'Servidores MCP',
    'nav.documentation': 'Documentação',
    'nav.about': 'Sobre ApkRtool IDE',

    'panel.explorer': 'Explorador',
    'panel.ai': 'Assistente IA',
    'panel.modifier': 'Modificador APK',
    'panel.settings': 'Configurações',
    'panel.account': 'Conta e Preferências',

    'settings.title': 'Configurações — ApkRtool IDE',
    'settings.subtitle': 'Gerenciar preferências, idioma, chaves IA e compilador',
    'settings.tab.language': 'Idioma',
    'settings.tab.ai': 'IA e Chaves',
    'settings.tab.decompiler': 'Descompilador e Build',
    'settings.tab.appearance': 'Aparência',
    'settings.tab.plugins': 'Habilidades e MCP',
    'settings.tab.about': 'Sobre e Sistema',

    'settings.lang.title': 'Idioma de Exibição',
    'settings.lang.desc': 'Selecione seu idioma preferido. Aplicação instantânea.',
    'settings.lang.active': 'Idioma Ativo',

    'settings.ai.title': 'Pool de Chaves API de IA',
    'settings.ai.desc': 'Insira várias chaves para rotação automática e failover.',
    'settings.ai.placeholder': 'Insira chaves API (uma por linha ou separadas por vírgulas)...',

    'settings.decompile.title': 'Motor de Descompilação',
    'settings.decompile.apktoolDesc': 'Descompilar para bytecode Smali e recursos.',
    'settings.decompile.jadxDesc': 'Descompilar para código fonte Java legível.',
    'settings.compiler.title': 'Compilador APK',
    'settings.compiler.aapt2Desc': 'Pipeline AAPT2 moderno com compilação incremental.',
    'settings.compiler.legacyDesc': 'Pipeline AAPT legado para compatibilidade.',

    'settings.theme.title': 'Tema e Contraste',
    'settings.theme.desc': 'Personalize as cores da interface.',

    'settings.about.version': 'Versão',
    'settings.about.description': 'Descompilador APK Android Moderno e Editor Smali',
    'settings.close': 'Fechar',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'Estúdio Profissional de Engenharia Reversa de APK Android',
    'welcome.newFile': 'Novo Arquivo',
    'welcome.openFolder': 'Abrir Pasta',
    'welcome.decompile': 'Descompilar APK',
    'welcome.recentWorkspaces': 'Workspaces Recentes',
    'welcome.noRecent': 'Nenhum workspace recente encontrado',

    'bottom.problems': 'Problemas',
    'bottom.output': 'Saída',
    'bottom.debug': 'Depuração',
    'bottom.terminal': 'Terminal',
    'bottom.apkRunner': 'Testador APK',
  },
  ru: {
    'nav.file': 'Файл',
    'nav.edit': 'Правка',
    'nav.view': 'Вид',
    'nav.decompiler': 'Декомпилятор',
    'nav.build': 'Сборка',
    'nav.tools': 'Инструменты',
    'nav.help': 'Справка',
    'nav.newFile': 'Новый файл',
    'nav.openFolder': 'Открыть папку проекта...',
    'nav.openFile': 'Открыть файл...',
    'nav.openWorkspaceFile': 'Открыть проект из файла...',
    'nav.openRecent': 'Недавние проекты',
    'nav.save': 'Сохранить',
    'nav.saveAs': 'Сохранить как...',
    'nav.saveAll': 'Сохранить все',
    'nav.settings': 'Настройки',
    'nav.exit': 'Выход',
    'nav.commandPalette': 'Палитра команд...',
    'nav.decompileApk': 'Декомпилировать APK Android...',
    'nav.buildApk': 'Собрать APK',
    'nav.apkRunner': 'Тестировщик APK и эмулятор',
    'nav.terminal': 'Терминал',
    'nav.skillsCatalog': 'Каталог навыков',
    'nav.mcpServers': 'Серверы MCP',
    'nav.documentation': 'Документация',
    'nav.about': 'О программе ApkRtool IDE',

    'panel.explorer': 'Проводник',
    'panel.ai': 'ИИ Ассистент',
    'panel.modifier': 'Модификатор APK',
    'panel.settings': 'Настройки',
    'panel.account': 'Аккаунт и параметры',

    'settings.title': 'Настройки — ApkRtool IDE',
    'settings.subtitle': 'Настройка рабочей среды, языка, ключей ИИ и компилятора',
    'settings.tab.language': 'Язык',
    'settings.tab.ai': 'ИИ и Ключи',
    'settings.tab.decompiler': 'Декомпиляция и сборка',
    'settings.tab.appearance': 'Оформление',
    'settings.tab.plugins': 'Навыки и MCP',
    'settings.tab.about': 'О системе',

    'settings.lang.title': 'Язык интерфейса',
    'settings.lang.desc': 'Выберите удобный язык. Применяется мгновенно.',
    'settings.lang.active': 'Текущий язык',

    'settings.ai.title': 'Пул API ключей ИИ',
    'settings.ai.desc': 'Введите несколько ключей для автоматической ротации.',
    'settings.ai.placeholder': 'Введите API ключи (по одному на строку или через запятую)...',

    'settings.decompile.title': 'Движок декомпиляции',
    'settings.decompile.apktoolDesc': 'Декомпиляция в байткод Smali и ресурсы.',
    'settings.decompile.jadxDesc': 'Декомпиляция в читаемый Java код.',
    'settings.compiler.title': 'Компилятор APK',
    'settings.compiler.aapt2Desc': 'Современный AAPT2 конвейер.',
    'settings.compiler.legacyDesc': 'Устаревший AAPT для совместимости.',

    'settings.theme.title': 'Тема и оформление',
    'settings.theme.desc': 'Настройка цветов и контраста интерфейса.',

    'settings.about.version': 'Версия',
    'settings.about.description': 'Современный декомпилятор APK и редактор Smali',
    'settings.close': 'Закрыть',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'Профессиональная среда реверс-инжиниринга APK Android',
    'welcome.newFile': 'Новый файл',
    'welcome.openFolder': 'Открыть папку',
    'welcome.decompile': 'Декомпилировать APK',
    'welcome.recentWorkspaces': 'Недавние проекты',
    'welcome.noRecent': 'Недавних проектов нет',

    'bottom.problems': 'Проблемы',
    'bottom.output': 'Вывод',
    'bottom.debug': 'Отладка',
    'bottom.terminal': 'Терминал',
    'bottom.apkRunner': 'Тестер APK',
  },
  ja: {
    'nav.file': 'ファイル',
    'nav.edit': '編集',
    'nav.view': '表示',
    'nav.decompiler': '逆コンパイラ',
    'nav.build': 'ビルド',
    'nav.tools': 'ツール',
    'nav.help': 'ヘルプ',
    'nav.newFile': '新規ファイル',
    'nav.openFolder': 'ワークスペースを開く...',
    'nav.openFile': 'ファイルを開く...',
    'nav.openWorkspaceFile': 'ファイルからワークスペースを開く...',
    'nav.openRecent': '最近開いた項目',
    'nav.save': '保存',
    'nav.saveAs': '名前を付けて保存...',
    'nav.saveAll': 'すべて保存',
    'nav.settings': '設定',
    'nav.exit': '終了',
    'nav.commandPalette': 'コマンドパレット...',
    'nav.decompileApk': 'Android APKを逆コンパイル...',
    'nav.buildApk': 'APKをビルド',
    'nav.apkRunner': 'APKテスト実行＆エミュレータ',
    'nav.terminal': 'ターミナル',
    'nav.skillsCatalog': 'スキルカタログ',
    'nav.mcpServers': 'MCPサーバー',
    'nav.documentation': 'ドキュメント',
    'nav.about': 'ApkRtool IDE について',

    'panel.explorer': 'エクスプローラー',
    'panel.ai': 'AI アシスタント',
    'panel.modifier': 'APK 修飾ツール',
    'panel.settings': '設定',
    'panel.account': 'アカウントと設定',

    'settings.title': '設定 — ApkRtool IDE',
    'settings.subtitle': '言語、AIキー、コンパイラ設定、表示をカスタマイズ',
    'settings.tab.language': '言語',
    'settings.tab.ai': 'AI & キー管理',
    'settings.tab.decompiler': '逆コンパイラ & ビルド',
    'settings.tab.appearance': '外観',
    'settings.tab.plugins': 'スキル & MCP',
    'settings.tab.about': '情報 & システム',

    'settings.lang.title': '表示言語',
    'settings.lang.desc': '希望するインターフェース言語を選択します。即座に適用されます。',
    'settings.lang.active': '現在の言語',

    'settings.ai.title': 'AI APIキープール',
    'settings.ai.desc': '自動ローテーション用に複数のAPIキーを入力します。',
    'settings.ai.placeholder': 'APIキーを入力（1行に1つ、またはカンマ区切り）...',

    'settings.decompile.title': '逆コンパイラエンジン',
    'settings.decompile.apktoolDesc': 'Smaliバイトコードおよびリソースに逆コンパイルします。',
    'settings.decompile.jadxDesc': '読み取り可能なJavaソースコードに逆コンパイルします。',
    'settings.compiler.title': 'APKコンパイラバックエンド',
    'settings.compiler.aapt2Desc': 'インクリメンタルコンパイルを備えた最新のAAPT2パイプライン。',
    'settings.compiler.legacyDesc': '互換性のためのレガシーAAPTパイプライン。',

    'settings.theme.title': 'テーマとアクセント',
    'settings.theme.desc': 'UIカラーとコントラストをカスタマイズします。',

    'settings.about.version': 'バージョン',
    'settings.about.description': '最新のAndroid APK逆コンパイラおよびSmaliエディタ',
    'settings.close': '閉じる',

    'welcome.title': 'ApkRtool IDE',
    'welcome.subtitle': 'プロフェッショナルなAndroid APKリバースエンジニアリング環境',
    'welcome.newFile': '新規ファイル',
    'welcome.openFolder': 'フォルダを開く',
    'welcome.decompile': 'APK逆コンパイル',
    'welcome.recentWorkspaces': '最近のワークスペース',
    'welcome.noRecent': '最近のワークスペースは見つかりませんでした',

    'bottom.problems': '問題',
    'bottom.output': '出力',
    'bottom.debug': 'デバッグ',
    'bottom.terminal': 'ターミナル',
    'bottom.apkRunner': 'APKテスター',
  },
};

interface I18nContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageInfo[];
  currentLangInfo: LanguageInfo;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'apkrtool_language';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved && TRANSLATIONS[saved]) return saved;
    return 'en'; // default English
  });

  const setLang = (newLang: LanguageCode) => {
    if (TRANSLATIONS[newLang]) {
      setLangState(newLang);
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = (key: string, fallback?: string): string => {
    const langDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (langDict[key]) return langDict[key];
    if (TRANSLATIONS.en[key]) return TRANSLATIONS.en[key];
    return fallback || key;
  };

  const currentLangInfo = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <I18nContext.Provider value={{ lang, setLang, t, languages: LANGUAGES, currentLangInfo }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback outside provider
    return {
      lang: 'en',
      setLang: () => {},
      t: (k: string, fb?: string) => fb || k,
      languages: LANGUAGES,
      currentLangInfo: LANGUAGES[0],
    };
  }
  return ctx;
}
