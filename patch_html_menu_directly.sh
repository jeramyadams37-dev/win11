#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd ~/win11

python3 - << 'PYEOF'
import pathlib, re

html_path = pathlib.Path("www/index.html")
html = html_path.read_text(encoding="utf-8")

# Check if already patched
if "aurora-drag-bar" in html:
    print("[OK] index.html already has drag bar.")
    exit(0)

# Find the floating quick menu container (usually a div with absolute/fixed positioning or containing Cortex AI / Camera Studio)
# Let's inject a header bar right inside the quick menu container div
pattern = r'(<div[^>]*class="[^"]*(?:menu|popup|launcher|panel|quick)[^"]*"[^>]*>[\s\S]*?)(<button[^>]*>[\s\S]*?Cortex AI)'

match = re.search(pattern, html, re.IGNORECASE)
if not match:
    # Fallback: find any container holding Cortex AI
    print("[*] Searching for Cortex AI container in index.html...")
    # Let's wrap the menu div that contains Cortex AI
    lines = html.splitlines()
    new_lines = []
    in_menu = False
    for line in lines:
        if 'Cortex AI' in line and not 'aurora-drag-bar' in ''.join(new_lines[-5:]):
            # Insert drag bar just before the menu items
            new_lines.append('  <div class="aurora-drag-bar" style="display:flex; justify-content:space-between; align-items:center; padding:4px 10px; border-bottom:1px solid rgba(255,255,255,0.15); cursor:grab; font-size:11px; color:#cbd5e1; user-select:none;"><span>⠿ Quick Menu</span><button class="aurora-min-btn" onclick="this.parentElement.parentElement.classList.toggle(\'aurora-menu-minimized\')" style="background:rgba(255,255,255,0.2); border:none; color:#fff; border-radius:4px; padding:1px 6px; cursor:pointer;">—</button></div>')
        new_lines.append(line)
    html = '\n'.join(new_lines)
else:
    html = re.sub(pattern, r'\1<div class="aurora-drag-bar" style="display:flex; justify-content:space-between; align-items:center; padding:4px 10px; border-bottom:1px solid rgba(255,255,255,0.15); cursor:grab; font-size:11px; color:#cbd5e1; user-select:none;"><span>⠿ Quick Menu</span><button class="aurora-min-btn" onclick="this.parentElement.classList.toggle(\'aurora-menu-minimized\')" style="background:rgba(255,255,255,0.2); border:none; color:#fff; border-radius:4px; padding:1px 6px; cursor:pointer;">—</button></div>\n\2', html, count=1, flags=re.IGNORECASE)

html_path.write_text(html, encoding="utf-8")
print("[OK] Injected Quick Menu drag bar directly into www/index.html")
PYEOF

# Bump versionCode
python3 - << 'PYEOF'
import re, pathlib
gradle_path = pathlib.Path("android/app/build.gradle")
content = gradle_path.read_text(encoding="utf-8")
m = re.search(r'versionCode\s+(\d+)', content)
if m:
    old_code = int(m.group(1))
    new_code = old_code + 1
    content = content.replace(f"versionCode {old_code}", f"versionCode {new_code}")
    gradle_path.write_text(content, encoding="utf-8")
    print(f"[OK] Bumped versionCode to {new_code}")
PYEOF

npx cap copy android
git add www/index.html android/app/build.gradle
git commit -m "fix: inject Quick Menu drag bar directly into index.html" || true
git push origin main

sleep 4
RUN_ID=$(gh run list --workflow=build-apk.yml --limit 1 --json databaseId --jq '.[0].databaseId')
echo "[*] Watching GitHub Actions build #$RUN_ID..."
gh run watch "$RUN_ID" --exit-status

WORK_DIR="$HOME/tmp_gh_apk"
rm -rf "$WORK_DIR" && mkdir -p "$WORK_DIR"
gh run download "$RUN_ID" -D "$WORK_DIR"
GH_APK=$(find "$WORK_DIR" -name "*.apk" | head -n 1)
cp -f "$GH_APK" /sdcard/Download/AuroraOS-Win11.apk
echo "[OK] Direct HTML-patched APK downloaded to /sdcard/Download/AuroraOS-Win11.apk"
termux-open /sdcard/Download/AuroraOS-Win11.apk || true
