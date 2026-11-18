#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd ~/win11

echo "=== 1. Verify Backend (:8420), EdgeRider & ShopSense Endpoints ==="
pgrep -f "aurora_cortex_bridge.py" >/dev/null || (nohup python3 ~/aurora_cortex_bridge.py > ~/aurora_cortex_bridge.log 2>&1 & sleep 1)

curl -s http://127.0.0.1:8420/api/status | python3 -m json.tool
echo "--- EdgeRider Trips ---"
curl -s http://127.0.0.1:8420/api/edgerider/trips | python3 -m json.tool
echo "--- ShopSense DTC ---"
curl -s http://127.0.0.1:8420/api/shopsense/dtc | python3 -m json.tool

echo ""
echo "=== 2. Verify UI Modules in www/ ==="
grep -rnE "EdgeRider|ShopSense|aurora-drag-bar|toggleAuroraGuide" www/ | head -n 20

echo ""
echo "=== 3. Back Up & Ensure Auto-Minimize on Outside Tap Is Active ==="
mkdir -p backups
TS=$(date +%Y%m%d_%H%M%S)
cp -f www/apps-suite-v2.js "backups/apps-suite-v2.js.bak.$TS"

if ! grep -q "__auroraAutoMinBound" www/apps-suite-v2.js; then
  cat << 'JSEOF' >> www/apps-suite-v2.js

/* === AUTO-MINIMIZE QUICK MENU ON OUTSIDE TAP === */
(function() {
  if (window.__auroraAutoMinBound) return;
  window.__auroraAutoMinBound = true;

  const autoMinimize = (e) => {
    const menu = document.querySelector('[data-movable-ready="1"]');
    if (!menu || menu.classList.contains('aurora-menu-minimized')) return;
    if (menu.contains(e.target)) return;
    // Ignore clicks on the Start/launcher toggle button so opening works normally
    if (e.target.closest('#start-btn, .start-btn, [data-start-toggle]')) return;
    menu.classList.add('aurora-menu-minimized');
    const minBtn = menu.querySelector('.aurora-min-btn');
    if (minBtn) minBtn.textContent = '▲';
  };

  document.addEventListener('pointerdown', autoMinimize, true);
})();
JSEOF
  npx cap copy android
  echo "[OK] Added auto-minimize on outside tap & synced Android assets!"
else
  echo "[OK] Auto-minimize on outside tap already present."
fi
