#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd ~/win11
mkdir -p backups
TS=$(date +%Y%m%d_%H%M%S)

TARGET=$(grep -rl "Camera Studio" ~/win11 --exclude-dir=node_modules --exclude-dir=backups --exclude-dir=.git | head -n 1 || true)
if [ -z "$TARGET" ]; then
  echo "[!] Could not find 'Camera Studio' in ~/win11. Listing HTML files:"
  find ~/win11 -maxdepth 4 -name "*.html" -not -path "*/node_modules/*"
  exit 1
fi

cp "$TARGET" "backups/$(basename "$TARGET").bak.$TS"
[ -f www/index.html ] && cp www/index.html "backups/www_index.bak.$TS.html"
echo "[OK] Backed up $TARGET to ~/win11/backups/"

cat << 'PYEOF' > make_menu_movable.py
import sys, pathlib

target = pathlib.Path(sys.argv[1])
html = target.read_text(encoding="utf-8")

patch = """
<style>
  .aurora-drag-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 10px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.14);
    cursor: grab; touch-action: none; user-select: none; font-size: 11px; color: #cbd5e1;
  }
  .aurora-drag-bar:active { cursor: grabbing; }
  .aurora-min-btn {
    background: rgba(255,255,255,0.14); border: none; color: #fff;
    border-radius: 4px; padding: 2px 8px; font-size: 12px; cursor: pointer;
  }
  .aurora-menu-minimized > *:not(.aurora-drag-bar) { display: none !important; }
  .aurora-menu-minimized { width: auto !important; min-width: 145px !important; padding: 6px 8px !important; }
</style>
<script>
(function() {
  function initMovableLauncher() {
    const btn = Array.from(document.querySelectorAll('button, div, span')).find(
      el => el.textContent && el.textContent.trim() === 'Camera Studio'
    );
    if (!btn) return;
    let menu = btn.parentElement;
    while (menu && menu !== document.body) {
      const pos = window.getComputedStyle(menu).position;
      if (pos === 'fixed' || pos === 'absolute') break;
      menu = menu.parentElement;
    }
    if (!menu || menu === document.body || menu.dataset.movableReady) return;
    menu.dataset.movableReady = '1';

    const bar = document.createElement('div');
    bar.className = 'aurora-drag-bar';
    bar.innerHTML = '<span>⠿ Quick Menu</span><button class="aurora-min-btn" title="Minimize">—</button>';
    menu.insertBefore(bar, menu.firstChild);

    const minBtn = bar.querySelector('.aurora-min-btn');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const minimized = menu.classList.toggle('aurora-menu-minimized');
      minBtn.textContent = minimized ? '▲' : '—';
    });

    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
    const onDown = (e) => {
      if (e.target === minBtn) return;
      const pt = e.touches ? e.touches[0] : e;
      const rect = menu.getBoundingClientRect();
      menu.style.transform = 'none';
      menu.style.bottom = 'auto';
      menu.style.right = 'auto';
      menu.style.left = rect.left + 'px';
      menu.style.top = rect.top + 'px';
      dragging = true;
      startX = pt.clientX; startY = pt.clientY;
      origLeft = rect.left; origTop = rect.top;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const nx = Math.max(4, Math.min(window.innerWidth - menu.offsetWidth - 4, origLeft + (pt.clientX - startX)));
      const ny = Math.max(4, Math.min(window.innerHeight - 56, origTop + (pt.clientY - startY)));
      menu.style.left = nx + 'px';
      menu.style.top = ny + 'px';
    };
    const onUp = () => { dragging = false; };

    bar.addEventListener('mousedown', onDown);
    bar.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMovableLauncher);
  else initMovableLauncher();
})();
</script>
"""

if "aurora-drag-bar" not in html:
    html = html.replace("</body>", patch + "\n</body>") if "</body>" in html else html + patch
    target.write_text(html, encoding="utf-8")
    print(f"[OK] Patched movable & minimizable menu into {target}")
else:
    print(f"[INFO] {target} already patched")
PYEOF

python3 make_menu_movable.py "$TARGET"
mkdir -p www
[ "$TARGET" != "$HOME/win11/www/index.html" ] && cp -f "$TARGET" ~/win11/www/index.html
npx cap copy android
echo "[OK] Synced to www/index.html and Android assets!"
