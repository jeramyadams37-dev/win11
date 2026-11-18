#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "=================================================="
echo "🚀 AuroraOS / Win11 APK Build Pipeline"
echo "=================================================="

# 1. Regenerate latest web static assets via deploy script
if [ -f "deploy_aurora.sh" ]; then
    echo "[*] Executing deploy_aurora.sh to refresh index.html..."
    bash deploy_aurora.sh &
    sleep 2
    # Kill the background http server started by deploy script
    fuser -k 8000/tcp 2>/dev/null || true
else
    echo "[!] deploy_aurora.sh not found. Proceeding with existing assets..."
fi

# 2. Check Capacitor project structure
if [ -f "capacitor.config.json" ]; then
    echo "[*] Synchronizing Capacitor assets..."
    npx cap sync
    
    if [ -d "android" ]; then
        echo "[*] Building Android APK via Gradle..."
        cd android
        ./gradlew assembleDebug
        cd ..
        
        echo "=================================================="
        echo "✅ APK Build Complete!"
        echo "📍 Output location: android/app/build/outputs/apk/debug/app-debug.apk"
        echo "=================================================="
    else
        echo "[!] Android platform folder missing. Run 'npx cap add android' first."
    fi
else
    echo "[!] Not a Capacitor project root or capacitor.config.json missing in current directory."
    echo "[*] Static build files are successfully updated in index.html."
fi
