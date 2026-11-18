#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd ~/win11

# 1. Back up current state before restoring
mkdir -p backups
TS=$(date +%Y%m%d_%H%M%S)
tar -czf "backups/pre_restore_$TS.tar.gz" www android/app/src/main/assets/public index.html 2>/dev/null || true

# 2. Restore the entire intact www/ directory and index.html from commit 946372b
git checkout 946372b -- www/ index.html
echo "[OK] Restored full Win11 desktop suite from commit 946372b"

# 3. Cleanly append the movable/minimizable Quick Menu + F1 Guidance Key to www/apps-suite-v2.js
cat << 'JSEOF' >> www/apps-suite-v2.js

/* === AURORAOS MOVABLE/MINIMIZABLE QUICK MENU & F1 GUIDANCE KEY === */
(function() {
  if (window.__auroraQuickFix) return;
  window.__auroraQuickFix = true;

  const style = document.createElement('style');
  style.textContent = `
    .aurora-drag-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 10px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.16);
      cursor: grab; touch-action: none; user-select: none; font-size: 11px; color: #cbd5e1;
    }
    .aurora-drag-bar:active { cursor: grabbing; }
    .aurora-min-btn {
      background: rgba(255,255,255,0.16); border: none; color: #fff;
      border-radius: 4px; padding: 2px 8px; font-size: 12px; cursor: pointer;
    }
    .aurora-menu-minimized > *:not(.aurora-drag-bar) { display: none !important; }
    .aurora-menu-minimized { width: auto !important; min-width: 145px !important; padding: 6px 8px !important; }
    #aurora-f1-modal {
      position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
      width: min(560px, 94vw); max-height: 75vh; overflow: auto;
      background: rgba(20, 24, 34, 0.96); color: #f8fafc;
      border: 1px solid rgba(56, 189, 248, 0.45); border-radius: 12px;
      padding: 16px; z-index: 999999; box-shadow: 0 20px 50px rgba(0,0,0,0.85);
      font-family: system-ui, sans-serif; display: none;
    }
    #aurora-f1-modal.open { display: block; }
    .aurora-f1-chip {
      display: inline-block; padding: 5px 10px; margin: 3px;
      background: rgba(0,120,212,0.35); border: 1px solid #38bdf8;
      border-radius: 6px; font-size: 12px; font-family: monospace; color: #fff; cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  function attachMenuControls() {
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
      menu.style.left = Math.max(4, Math.min(window.innerWidth - menu.offsetWidth - 4, origLeft + (pt.clientX - startX))) + 'px';
      menu.style.top = Math.max(4, Math.min(window.innerHeight - 56, origTop + (pt.clientY - startY))) + 'px';
    };
    const onUp = () => { dragging = false; };

    bar.addEventListener('mousedown', onDown);
    bar.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  function setupGuidanceModal() {
    if (document.getElementById('aurora-f1-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'aurora-f1-modal';
    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>❓ AuroraOS Command & Guidance Key (F1)</strong>
        <button id="aurora-f1-close" style="background:#c42b1c; color:#fff; border:none; border-radius:4px; padding:3px 9px; cursor:pointer;">✕</button>
      </div>
      <div style="margin-bottom:8px;">
        <span class="aurora-f1-chip" data-cmd="commands">commands</span>
        <span class="aurora-f1-chip" data-cmd="latest gh builds">latest gh builds</span>
        <span class="aurora-f1-chip" data-cmd="trips">trips</span>
        <span class="aurora-f1-chip" data-cmd="dtc">dtc</span>
        <span class="aurora-f1-chip" data-cmd="status">status</span>
      </div>
      <pre id="aurora-f1-out" style="background:rgba(0,0,0,0.6); padding:10px; border-radius:6px; font-size:12px; white-space:pre-wrap; margin:0;">Tap a command above to query Cortex (:8420)...</pre>
    `;
    document.body.appendChild(modal);

    const run = async (cmd) => {
      const out = document.getElementById('aurora-f1-out');
      out.textContent = '> ' + cmd + '...';
      try {
        const r = await fetch('http://127.0.0.1:8420/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: cmd })
        });
        const d = await r.json();
        out.textContent = d.response || JSON.stringify(d, null, 2);
      } catch (e) {
        out.textContent = 'Bridge offline on :8420. Start with: python3 ~/aurora_cortex_bridge.py &';
      }
    };

    modal.querySelectorAll('.aurora-f1-chip').forEach(c => c.addEventListener('click', () => run(c.dataset.cmd)));
    document.getElementById('aurora-f1-close').addEventListener('click', () => modal.classList.remove('open'));
    window.toggleAuroraGuide = () => { modal.classList.toggle('open'); if (modal.classList.contains('open')) run('commands'); };
  }

  const obs = new MutationObserver(() => attachMenuControls());
  window.addEventListener('DOMContentLoaded', () => {
    attachMenuControls();
    setupGuidanceModal();
    obs.observe(document.body, { childList: true, subtree: true });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      if (window.toggleAuroraGuide) window.toggleAuroraGuide();
    }
  });
})();
JSEOF

# 4. Sync Capacitor Android assets, rebuild APK, sign with debug.keystore, and open installer
npx cap copy android
./install-latest.sh
