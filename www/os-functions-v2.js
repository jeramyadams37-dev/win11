(function () {
  if (window.__auroraOSFuncsV2Loaded) return;
  window.__auroraOSFuncsV2Loaded = true;
  window.__auroraCurrentDesktop = 1;

  const notifs = [];
  window.__auroraAddNotif = function (title, msg) {
    notifs.unshift({ title, msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (notifs.length > 20) notifs.pop();
  };

  window.switchVirtualDesktop = function (num) {
    window.__auroraCurrentDesktop = num;
    document.querySelectorAll('.win11-window, .window').forEach(w => {
      const d = Number(w.dataset.desktop || 1);
      if (d === num) {
        if (w.dataset.wasOpen === '1') w.style.display = 'flex';
      } else {
        w.dataset.wasOpen = (w.style.display !== 'none') ? '1' : '0';
        w.style.display = 'none';
      }
    });
    const btn = document.getElementById('aurora-vdesk-btn');
    if (btn) btn.textContent = '🖥️ D' + num;
    if (window.auroraToast) window.auroraToast('Virtual Desktop', 'Switched to Desktop ' + num);
  };

  function toggleQuickTray() {
    let tray = document.getElementById('aurora-quick-tray');
    if (tray) { tray.remove(); return; }
    const clips = JSON.parse(localStorage.getItem('aurora_clip_history') || '[]');
    tray = document.createElement('div');
    tray.id = 'aurora-quick-tray';
    tray.style.cssText = 'position:fixed;bottom:54px;right:12px;width:300px;max-height:380px;overflow-y:auto;background:rgba(20,22,32,0.96);color:#f8fafc;border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:12px;z-index:99998;box-shadow:0 16px 40px rgba(0,0,0,0.6);backdrop-filter:blur(16px);font-size:12px;';
    tray.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:8px;">
        <span>📋 Clipboard & Action Center</span>
        <button id="qt-save-clip" style="padding:3px 8px;border-radius:6px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:11px;cursor:pointer;">+ Save Clipboard</button>
      </div>
      <div id="qt-clips" style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
        ${clips.length ? clips.map((c, i) => `<div data-idx="${i}" style="padding:6px;background:rgba(255,255,255,0.07);border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="Tap to copy">${c}</div>`).join('') : '<div style="opacity:0.65;">No saved clips yet.</div>'}
      </div>
      <div style="font-weight:700;margin-bottom:6px;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;">🔔 Recent Notifications</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${notifs.length ? notifs.map(n => `<div style="padding:5px;background:rgba(255,255,255,0.05);border-radius:6px;"><strong>${n.title}</strong> (${n.time})<br><span style="opacity:0.8;">${n.msg}</span></div>`).join('') : '<div style="opacity:0.65;">All caught up.</div>'}
      </div>
    `;
    document.body.appendChild(tray);
    tray.querySelector('#qt-save-clip').onclick = async () => {
      try {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          clips.unshift(txt);
          localStorage.setItem('aurora_clip_history', JSON.stringify(clips.slice(0, 12)));
          tray.remove(); toggleQuickTray();
        }
      } catch (_) {
        const manual = prompt('Paste text to pin to Clipboard History:');
        if (manual) {
          clips.unshift(manual);
          localStorage.setItem('aurora_clip_history', JSON.stringify(clips.slice(0, 12)));
          tray.remove(); toggleQuickTray();
        }
      }
    };
    tray.querySelectorAll('[data-idx]').forEach(el => {
      el.onclick = () => {
        navigator.clipboard?.writeText(clips[Number(el.dataset.idx)]);
        if (window.auroraToast) window.auroraToast('Copied', 'Snippet copied to clipboard.');
      };
    });
  }

  // Desktop Context Menu (Right-click or Long-Press)
  function showDesktopMenu(x, y) {
    let menu = document.getElementById('aurora-ctx-menu');
    if (menu) menu.remove();
    menu = document.createElement('div');
    menu.id = 'aurora-ctx-menu';
    menu.style.cssText = `position:fixed;left:${Math.min(x, window.innerWidth - 195)}px;top:${Math.min(y, window.innerHeight - 230)}px;width:185px;background:rgba(22,24,34,0.97);color:#f8fafc;border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:6px;z-index:99999;box-shadow:0 12px 32px rgba(0,0,0,0.55);font-size:12px;backdrop-filter:blur(14px);`;
    const items = [
      ['🧠 Open Cortex AI', () => window.launchAuroraV2App('cortex')],
      ['🗒️ New Sticky Note', () => window.launchAuroraV2App('notes')],
      ['📷 Open Camera Studio', () => window.launchAuroraV2App('camera')],
      ['🎬 Media & Recorder', () => window.launchAuroraV2App('media')],
      ['🖥️ Switch Desktop (1/2)', () => window.switchVirtualDesktop(window.__auroraCurrentDesktop === 1 ? 2 : 1)],
      ['⚙️ Windows Settings', () => window.launchAuroraV2App('settings')]
    ];
    items.forEach(([label, fn]) => {
      const row = document.createElement('div');
      row.textContent = label;
      row.style.cssText = 'padding:7px 10px;border-radius:6px;cursor:pointer;';
      row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.12)'; };
      row.onmouseleave = () => { row.style.background = 'transparent'; };
      row.onclick = () => { menu.remove(); fn(); };
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
  }

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.win11-window, .window, input, textarea')) return;
    e.preventDefault();
    showDesktopMenu(e.clientX, e.clientY);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#aurora-ctx-menu')) document.getElementById('aurora-ctx-menu')?.remove();
    if (!e.target.closest('#aurora-quick-tray') && !e.target.closest('#aurora-tray-btn')) document.getElementById('aurora-quick-tray')?.remove();
  });

  // Mount Virtual Desktop & Action Center buttons onto Taskbar
  window.addEventListener('DOMContentLoaded', () => {
    const taskbar = document.querySelector('#taskbar, .taskbar, footer');
    if (taskbar && !document.getElementById('aurora-vdesk-btn')) {
      const bar = document.createElement('div');
      bar.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding-right:6px;';
      bar.innerHTML = `
        <button id="aurora-vdesk-btn" title="Switch Virtual Desktop" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">🖥️ D1</button>
        <button id="aurora-tray-btn" title="Clipboard & Action Center" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">📋🔔</button>
      `;
      taskbar.appendChild(bar);
      bar.querySelector('#aurora-vdesk-btn').onclick = () => window.switchVirtualDesktop(window.__auroraCurrentDesktop === 1 ? 2 : 1);
      bar.querySelector('#aurora-tray-btn').onclick = toggleQuickTray;
    }
  });
})();
