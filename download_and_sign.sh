#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/win11

RUN_ID="44235430506"
ARTIFACT_NAME="win11-signed-apk"
KEYSTORE="$HOME/.android/aurora-win11.keystore"
OUT_DIR="$HOME/storage/downloads/win11-apk"

echo "[*] Preparing download directory: $OUT_DIR"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.apk

echo "[*] Downloading $ARTIFACT_NAME from GitHub Actions run $RUN_ID..."
gh run download "$RUN_ID" -n "$ARTIFACT_NAME" -D "$OUT_DIR"

APK_IN=$(find "$OUT_DIR" -name "*.apk" | head -n 1)
if [ -z "$APK_IN" ]; then
    echo "[!] Error: No .apk file found inside $OUT_DIR after download."
    exit 1
fi
echo "[OK] Downloaded: $APK_IN"

if [ ! -f "$KEYSTORE" ]; then
    echo "[!] Keystore not found at $KEYSTORE — launching unsigned/CI-signed installer..."
    termux-open "$APK_IN"
    exit 0
fi

read -rsp "Enter password for aurora-win11.keystore (leave blank to try 'android'): " KS_PASS
echo ""
KS_PASS="${KS_PASS:-android}"

# Auto-detect the alias from aurora-win11.keystore
ALIAS=$(keytool -list -keystore "$KEYSTORE" -storepass "$KS_PASS" 2>/dev/null | awk -F',' '/PrivateKeyEntry|trustedCertEntry/ {print $1; exit}')
if [ -z "$ALIAS" ]; then
    echo "[!] Could not read alias from $KEYSTORE. Check your password."
    exit 1
fi
echo "[*] Found keystore alias: $ALIAS"

command -v apksigner >/dev/null 2>&1 || pkg install -y apksigner

APK_OUT="$OUT_DIR/aurora-win11-updated.apk"
echo "[*] Re-signing APK with $KEYSTORE..."
apksigner sign \
  --ks "$KEYSTORE" \
  --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$KS_PASS" \
  --key-pass "pass:$KS_PASS" \
  --out "$APK_OUT" \
  "$APK_IN"

apksigner verify --verbose "$APK_OUT"
echo "[OK] Re-signed APK ready at: $APK_OUT"

echo "[*] Opening Android package installer..."
termux-open "$APK_OUT"
