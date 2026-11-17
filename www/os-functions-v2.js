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
    document.querySelectorAll('.aurora-vdesk-label').forEach(el => { el.textContent = '🖥️ D' + num; });
    if (window.auroraToast) window.auroraToast('Virtual Desktop', 'Switched to Desktop ' + num);
  };

  window.toggleAuroraQuickTray = function () {
    let tray = document.getElementById('aurora-quick-tray');
    if (tray) { tray.remove(); return; }
    const clips = JSON.parse(localStorage.getItem('aurora_clip_history') || '[]');
    tray = document.createElement('div');
    tray.id = 'aurora-quick-tray';
    tray.style.cssText = 'position:fixed;bottom:96px;right:12px;width:300px;max-height:360px;overflow-y:auto;background:rgba(18,20,30,0.97);color:#f8fafc;border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:12px;z-index:2147483645;box-shadow:0 16px 40px rgba(0,0,0,0.65);backdrop-filter:blur(16px);font-size:12px;';
    tray.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:8px;">
        <span>📋 Clipboard & Action Center</span>
        <button id="qt-save-clip" style="padding:3px 8px;border-radius:6px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:11px;cursor:pointer;">+ Pin Clip</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
        ${clips.length ? clips.map((c, i) => `<div data-idx="${i}" style="padding:6px;background:rgba(255,255,255,0.08);border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c}</div>`).join('') : '<div style="opacity:0.65;">No saved clips yet.</div>'}
      </div>
      <div style="font-weight:700;margin-bottom:6px;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;">🔔 Notifications</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${notifs.length ? notifs.map(n => `<div style="padding:5px;background:rgba(255,255,255,0.06);border-radius:6px;"><strong>${n.title}</strong> (${n.time})<br><span style="opacity:0.8;">${n.msg}</span></div>`).join('') : '<div style="opacity:0.65;">All caught up.</div>'}
      </div>
    `;
    document.body.appendChild(tray);
    tray.querySelector('#qt-save-clip').onclick = async () => {
      let txt = '';
      try { txt = await navigator.clipboard.readText(); } catch (_) {}
      if (!txt) txt = prompt('Enter text to save to Clipboard History:') || '';
      if (txt) {
        clips.unshift(txt);
        localStorage.setItem('aurora_clip_history', JSON.stringify(clips.slice(0, 12)));
        tray.remove(); window.toggleAuroraQuickTray();
      }
    };
    tray.querySelectorAll('[data-idx]').forEach(el => {
      el.onclick = () => {
        navigator.clipboard?.writeText(clips[Number(el.dataset.idx)]);
        if (window.auroraToast) window.auroraToast('Copied', 'Snippet copied to clipboard.');
      };
    });
  };

  function mountOSControls() {
    const dock = document.getElementById('aurora-v2-dock');
    if (dock && !document.getElementById('aurora-vdesk-btn')) {
      const dBtn = document.createElement('button');
      dBtn.id = 'aurora-vdesk-btn';
      dBtn.className = 'aurora-vdesk-label';
      dBtn.textContent = '🖥️ D' + window.__auroraCurrentDesktop;
      dBtn.style.cssText = 'border:1px solid rgba(255,255,255,0.22);background:rgba(59,130,246,0.28);color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;';
      dBtn.onclick = () => window.switchVirtualDesktop(window.__auroraCurrentDesktop === 1 ? 2 : 1);

      const tBtn = document.createElement('button');
      tBtn.id = 'aurora-tray-btn';
      tBtn.textContent = '📋🔔';
      tBtn.style.cssText = 'border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.12);color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;';
      tBtn.onclick = window.toggleAuroraQuickTray;

      dock.appendChild(dBtn);
      dock.appendChild(tBtn);
    }
  }

  setInterval(mountOSControls, 1500);
})();
