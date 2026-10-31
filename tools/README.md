# ApkRtool IDE Tools Directory

This directory contains standalone tools used by ApkRtool IDE:
- `apktool.jar` & `apktool.bat`: APK decompilation and recompilation
- `android-sdk/`: (Optional) Bundled Android SDK build-tools and platform-tools (adb, aapt2, apksigner)
- `jadx/`: (Optional) Bundled JADX Java decompiler
- `jdk/`: (Optional) Bundled OpenJDK 11+ runtime

If bundled tools are not present, ApkRtool IDE automatically falls back to system PATH, `JAVA_HOME`, and `ANDROID_HOME`.
