#!/usr/bin/env bash
set -euo pipefail
cd ~/win11

if [ ! -d "$HOME/storage/downloads" ]; then
  termux-setup-storage
  sleep 2
fi
mkdir -p /sdcard/Download ~/.android

BRANCH=$(git branch --show-current 2>/dev/null || true)
[ -z "$BRANCH" ] && BRANCH="main"
WF_PATH=$(find .github/workflows -maxdepth 1 -type f \( -name "*apk*" -o -name "*android*" -o -name "*build*" -o -name "*.yml" \) 2>/dev/null | head -n 1 || true)
WF_NAME=$(basename "${WF_PATH:-build-apk.yml}")

TARGET_SHA=""
if [ -d ".git" ]; then
  if [ -n "$(git status --porcelain www android .github 2>/dev/null || true)" ]; then
    git add www android .github 2>/dev/null || true
    git commit -m "chore: sync Win11 project" || true
  fi
  git push -u origin "$BRANCH" 2>/dev/null || git push 2>/dev/null || true
  TARGET_SHA=$(git rev-parse HEAD)
fi

RUN_ID=""
for _ in $(seq 1 6); do
  if [ -n "$TARGET_SHA" ]; then
    RUN_ID=$(gh run list --workflow="$WF_NAME" --commit "$TARGET_SHA" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)
  fi
  [ -n "$RUN_ID" ] && break
  sleep 3
done
[ -z "$RUN_ID" ] && RUN_ID=$(gh run list --workflow="$WF_NAME" --limit 1 --json databaseId --jq '.[0].databaseId')

RUN_STATUS=$(gh run view "$RUN_ID" --json status --jq '.status')
if [ "$RUN_STATUS" != "completed" ]; then
  echo "Watching build #$RUN_ID ($RUN_STATUS)..."
  gh run watch "$RUN_ID" --exit-status
else
  CONCLUSION=$(gh run view "$RUN_ID" --json conclusion --jq '.conclusion')
  [ "$CONCLUSION" = "success" ] || { echo "Build #$RUN_ID failed ($CONCLUSION)."; exit 1; }
fi

TMP_DL=$(mktemp -d)
trap 'rm -rf "$TMP_DL"' EXIT

LATEST_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName // empty' 2>/dev/null || true)
[ -n "$LATEST_TAG" ] && gh release download "$LATEST_TAG" --pattern "*.apk" -D "$TMP_DL" --clobber 2>/dev/null || true
[ -z "$(find "$TMP_DL" -type f -name "*.apk" 2>/dev/null)" ] && gh run download "$RUN_ID" -D "$TMP_DL" 2>/dev/null || true

FOUND_APK=$(find "$TMP_DL" -type f -name "*.apk" | head -n 1 || true)
[ -n "$FOUND_APK" ] && [ -s "$FOUND_APK" ] || { echo "ERROR: No .apk found."; exit 1; }

# Align & sign APK before staging to /sdcard/Download
if [ ! -f ~/.android/debug.keystore ]; then
  keytool -genkeypair -v -keystore ~/.android/debug.keystore \
    -storepass android -alias androiddebugkey -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=AuroraOS,O=Android,C=US"
fi
cp -f "$FOUND_APK" "$TMP_DL/raw.apk"
zip -qd "$TMP_DL/raw.apk" 'META-INF/*' 2>/dev/null || true
zipalign -f -p 4 "$TMP_DL/raw.apk" "$TMP_DL/aligned.apk"

APK_OUT="/sdcard/Download/AuroraOS-Win11.apk"
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --key-pass pass:android --ks-key-alias androiddebugkey \
  --out "$APK_OUT" "$TMP_DL/aligned.apk"

echo ""
echo "=== APK VISUAL VERIFICATION CHECKLIST ==="
echo "  [x] Workflow Run: #$RUN_ID (success)"
echo "  [x] Aligned/Signed: $(apksigner verify "$APK_OUT" && echo 'Verified OK')"
echo "  [x] Staged Path:  $(ls -lh "$APK_OUT" | awk '{print $5, $9}')"
echo "  [x] SHA-256:      $(sha256sum "$APK_OUT" | awk '{print substr($1,1,16)"..."}')"

echo "Opening Android Package Installer..."
termux-open --content-type application/vnd.android.package-archive "$APK_OUT"
