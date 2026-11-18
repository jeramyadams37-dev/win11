(function () {
  if (window.__auroraSuiteV2Loaded) return;
  window.__auroraSuiteV2Loaded = true;

  const NEW_APPS = [
    { id: 'cortex',   name: 'Cortex AI',     icon: '🧠', color: '#8b5cf6' },
    { id: 'media',    name: 'Media & Rec',   icon: '🎬', color: '#ec4899' },
    { id: 'camera',   name: 'Camera Studio', icon: '📷', color: '#06b6d4' },
    { id: 'notes',    name: 'Sticky Notes',  icon: '🗒️', color: '#eab308' },
    { id: 'settings', name: 'Settings',      icon: '⚙️', color: '#3b82f6' }
  ];

  window.auroraToast = function (title, msg) {
    let host = document.getElementById('aurora-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aurora-toast-host';
      host.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483646;display:flex;flex-direction:column;gap:8px;max-width:300px;pointer-events:none;';
      document.body.appendChild(host);
    }
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(20,22,32,0.96);color:#f8fafc;border:1px solid rgba(255,255,255,0.18);border-left:4px solid var(--win-accent,#3b82f6);border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,0.5);font-size:12px;backdrop-filter:blur(12px);pointer-events:auto;';
    card.innerHTML = `<div style="font-weight:700;margin-bottom:2px;">${title}</div><div style="opacity:0.85;">${msg}</div>`;
    host.appendChild(card);
    if (window.__auroraAddNotif) window.__auroraAddNotif(title, msg);
    setTimeout(() => { card.style.opacity = '0'; card.style.transition = 'opacity .3s'; setTimeout(() => card.remove(), 320); }, 3500);
  };

  function createSuiteWindow(appId, title, icon, width, height, bodyHTML) {
    const existing = document.getElementById('win-' + appId);
    if (existing) {
      existing.style.display = 'flex';
      window.__auroraTopZ = Math.max(window.__auroraTopZ || 9000, 9000) + 1;
      existing.style.zIndex = String(window.__auroraTopZ);
      return existing;
    }
    window.__auroraTopZ = Math.max(window.__auroraTopZ || 9000, 9000) + 1;
    const win = document.createElement('div');
    win.id = 'win-' + appId;
    win.className = 'win11-window window aurora-v2-win';
    win.dataset.appId = appId;
    win.dataset.desktop = String(window.__auroraCurrentDesktop || 1);
    const w = Math.min(width, window.innerWidth - 16);
    const h = Math.min(height, window.innerHeight - 96);
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, 16 + Math.round(Math.random() * 24)));
    const top = Math.max(12, Math.min(window.innerHeight - h - 84, 24 + Math.round(Math.random() * 24)));

    win.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${w}px;height:${h}px;background:var(--win-bg,#181824);color:var(--win-fg,#f1f5f9);border:1px solid rgba(255,255,255,0.2);border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.65);display:flex;flex-direction:column;overflow:hidden;z-index:${window.__auroraTopZ};backdrop-filter:blur(16px);`;
    win.innerHTML = `
      <div class="win-titlebar window-header" style="height:38px;padding:0 10px;background:rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none;touch-action:none;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;">
          <span>${icon}</span><span>${title}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button data-act="min" style="width:28px;height:26px;border:none;border-radius:6px;background:rgba(255,255,255,0.08);color:inherit;cursor:pointer;">—</button>
          <button data-act="max" style="width:28px;height:26px;border:none;border-radius:6px;background:rgba(255,255,255,0.08);color:inherit;cursor:pointer;">□</button>
          <button data-act="close" style="width:28px;height:26px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-weight:700;">✕</button>
        </div>
      </div>
      <div class="win-body" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;">
        ${bodyHTML}
      </div>
    `;

    win.addEventListener('pointerdown', () => {
      window.__auroraTopZ = (window.__auroraTopZ || 9000) + 1;
      win.style.zIndex = String(window.__auroraTopZ);
    });

    let prevRect = null;
    win.querySelector('[data-act="min"]').onclick = () => { win.style.display = 'none'; };
    win.querySelector('[data-act="max"]').onclick = () => {
      if (!prevRect) {
        prevRect = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        win.style.left = '0px'; win.style.top = '0px';
        win.style.width = '100vw'; win.style.height = 'calc(100vh - 82px)';
      } else {
        Object.assign(win.style, prevRect);
        prevRect = null;
      }
    };
    win.querySelector('[data-act="close"]').onclick = () => { win.remove(); };

    const bar = win.querySelector('.win-titlebar');
    let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      sl = win.offsetLeft; st = win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      win.style.left = Math.max(0, Math.min(window.innerWidth - 80, sl + (e.clientX - sx))) + 'px';
      win.style.top = Math.max(0, Math.min(window.innerHeight - 90, st + (e.clientY - sy))) + 'px';
    });
    bar.addEventListener('pointerup', () => { dragging = false; });

    document.body.appendChild(win);
    return win;
  }

  // 1. Cortex AI Hub
  function openCortexApp() {
    const savedUrl = localStorage.getItem('aurora_cortex_url') || 'http://127.0.0.1:8420';
    const win = createSuiteWindow('cortex', 'AuroraOS Cortex AI Hub', '🧠', 520, 440, `
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="cx-url" value="${savedUrl}" style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.35);color:inherit;font-size:12px;" />
        <button id="cx-ping" style="padding:6px 10px;border-radius:6px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:12px;cursor:pointer;">Ping</button>
        <span id="cx-status" style="font-size:11px;padding:3px 8px;border-radius:99px;background:rgba(234,179,8,0.2);color:#fde047;">Standby</span>
      </div>
      <div id="cx-log" style="flex:1;min-height:160px;overflow-y:auto;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
        <div style="opacity:0.85;"><strong>Cortex:</strong> Ready. Connect to Termux AuroraOS Flask API (<code>:8420</code>) or run local workspace queries.</div>
      </div>
      <div style="display:flex;gap:6px;">
        <input id="cx-prompt" placeholder="Ask Cortex or query aurora.db..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.35);color:inherit;font-size:13px;" />
        <button id="cx-send" style="padding:8px 14px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-weight:600;cursor:pointer;">Send</button>
      </div>
    `);
    const log = win.querySelector('#cx-log');
    const status = win.querySelector('#cx-status');
    const urlInput = win.querySelector('#cx-url');
    const appendMsg = (who, text) => {
      const d = document.createElement('div');
      d.innerHTML = `<strong>${who}:</strong> <span>${text}</span>`;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    };
    win.querySelector('#cx-ping').onclick = async () => {
      const base = urlInput.value.trim().replace(/\/$/, '');
      localStorage.setItem('aurora_cortex_url', base);
      try {
        const res = await fetch(base + '/api/status', { signal: AbortSignal.timeout(2500) });
        status.textContent = res.ok ? 'Online (' + res.status + ')' : 'HTTP ' + res.status;
        status.style.background = 'rgba(34,197,94,0.25)'; status.style.color = '#86efac';
        appendMsg('System', 'Connected to AuroraOS backend at ' + base);
      } catch (_) {
        status.textContent = 'Offline Mode';
        status.style.background = 'rgba(239,68,68,0.25)'; status.style.color = '#fca5a5';
        appendMsg('System', 'Flask :8420 unreachable (start AuroraOS in Termux). Offline helper active.');
      }
    };
    const sendPrompt = async () => {
      const inp = win.querySelector('#cx-prompt');
      const q = inp.value.trim();
      if (!q) return;
      inp.value = '';
      appendMsg('You', q);
      const base = urlInput.value.trim().replace(/\/$/, '');
      try {
        const res = await fetch(base + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: q, prompt: q }),
          signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        appendMsg('Cortex', data.response || data.reply || JSON.stringify(data));
      } catch (_) {
        const notes = JSON.parse(localStorage.getItem('aurora_sticky_notes') || '[]');
        appendMsg('Cortex (Offline)', `Backend :8420 offline. Local state: ${notes.length} sticky notes, ${Object.keys(localStorage).length} cached keys.`);
      }
    };
    win.querySelector('#cx-send').onclick = sendPrompt;
    win.querySelector('#cx-prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPrompt(); });
  }

  // 2. Media Player & Voice Recorder
  function openMediaApp() {
    const win = createSuiteWindow('media', 'Media Player & Voice Recorder', '🎬', 500, 430, `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label style="padding:6px 12px;border-radius:8px;background:var(--win-accent,#3b82f6);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
          📂 Open Audio/Video
          <input id="md-file" type="file" accept="audio/*,video/*" multiple style="display:none;" />
        </label>
        <select id="md-speed" style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.35);color:inherit;border:1px solid rgba(255,255,255,0.2);font-size:12px;">
          <option value="0.75">0.75x</option>
          <option value="1" selected>1.0x Normal</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2.0x</option>
        </select>
      </div>
      <video id="md-player" controls style="width:100%;max-height:180px;background:#000;border-radius:8px;"></video>
      <div id="md-playlist" style="font-size:12px;max-height:65px;overflow:auto;opacity:0.85;">Select local MP3/WAV/MP4 files above.</div>
      <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="font-size:12px;font-weight:600;">🎙️ Voice Memo: <span id="md-rec-time">00:00</span></div>
        <div style="display:flex;gap:6px;">
          <button id="md-rec-start" style="padding:6px 10px;border-radius:6px;border:none;background:#ef4444;color:#fff;font-size:12px;cursor:pointer;">● Record</button>
          <button id="md-rec-stop" disabled style="padding:6px 10px;border-radius:6px;border:none;background:#475569;color:#fff;font-size:12px;cursor:pointer;">■ Stop</button>
        </div>
      </div>
    `);
    const player = win.querySelector('#md-player');
    const plist = win.querySelector('#md-playlist');
    win.querySelector('#md-speed').onchange = (e) => { player.playbackRate = parseFloat(e.target.value); };
    win.querySelector('#md-file').onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      plist.innerHTML = '';
      files.forEach((f, idx) => {
        const url = URL.createObjectURL(f);
        const row = document.createElement('div');
        row.style.cssText = 'padding:4px 6px;cursor:pointer;border-radius:4px;';
        row.textContent = (idx + 1) + '. ' + f.name;
        row.onclick = () => { player.src = url; player.play(); };
        plist.appendChild(row);
        if (idx === 0) { player.src = url; player.play(); }
      });
    };
    let recorder = null, chunks = [], timer = null, secs = 0;
    const btnStart = win.querySelector('#md-rec-start');
    const btnStop = win.querySelector('#md-rec-stop');
    const timeEl = win.querySelector('#md-rec-time');
    btnStart.onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          player.src = url;
          const a = document.createElement('a'); a.href = url; a.download = 'AuroraMemo_' + Date.now() + '.webm'; a.click();
          stream.getTracks().forEach(t => t.stop());
          window.auroraToast('Voice Memo Saved', 'Downloaded AuroraMemo WebM recording.');
        };
        recorder.start();
        secs = 0;
        timer = setInterval(() => {
          secs++;
          timeEl.textContent = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
        }, 1000);
        btnStart.disabled = true; btnStop.disabled = false;
      } catch (_) {
        window.auroraToast('Mic Permission Needed', 'Allow Microphone access for AuroraOS Win11 in Android Settings.');
      }
    };
    btnStop.onclick = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      clearInterval(timer);
      btnStart.disabled = false; btnStop.disabled = true;
    };
  }

  // 3. Camera Studio
  function openCameraApp() {
    const win = createSuiteWindow('camera', 'Camera & Snapshot Studio', '📷', 480, 440, `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="cam-start" style="padding:6px 12px;border-radius:8px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">▶ Live Camera</button>
        <button id="cam-snap" style="padding:6px 12px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">📸 Snap Photo</button>
        <label style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.14);color:inherit;font-size:12px;cursor:pointer;">
          📱 Native Camera
          <input id="cam-native" type="file" accept="image/*" capture="environment" style="display:none;" />
        </label>
      </div>
      <video id="cam-video" autoplay playsinline style="width:100%;max-height:190px;background:#090d16;border-radius:8px;object-fit:cover;"></video>
      <canvas id="cam-canvas" style="display:none;"></canvas>
      <div id="cam-preview-wrap" style="display:none;align-items:center;gap:10px;">
        <img id="cam-img" style="height:80px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);" />
        <div style="display:flex;flex-direction:column;gap:6px;">
          <a id="cam-dl" download="AuroraPhoto.png" style="padding:5px 10px;border-radius:6px;background:#3b82f6;color:#fff;text-decoration:none;font-size:12px;text-align:center;">⬇ Save PNG</a>
          <button id="cam-paint" style="padding:5px 10px;border-radius:6px;border:none;background:#8b5cf6;color:#fff;font-size:12px;cursor:pointer;">🎨 Open in Paint</button>
        </div>
      </div>
    `);
    const video = win.querySelector('#cam-video');
    const canvas = win.querySelector('#cam-canvas');
    const img = win.querySelector('#cam-img');
    const wrap = win.querySelector('#cam-preview-wrap');
    const dl = win.querySelector('#cam-dl');
    let activeStream = null;
    const showCaptured = (dataUrl) => { img.src = dataUrl; dl.href = dataUrl; wrap.style.display = 'flex'; };

    win.querySelector('#cam-start').onclick = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = activeStream;
      } catch (_) {
        window.auroraToast('Using Native Fallback', 'Tap Native Camera button to capture via Android Camera.');
      }
    };
    win.querySelector('#cam-snap').onclick = () => {
      if (!video.videoWidth) return window.auroraToast('No Video Frame', 'Start Live Camera or use Native Camera first.');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      showCaptured(canvas.toDataURL('image/png'));
    };
    win.querySelector('#cam-native').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => showCaptured(r.result);
      r.readAsDataURL(f);
    };
    win.querySelector('#cam-paint').onclick = () => {
      window.__auroraPendingPaintImage = img.src;
      const paintBtn = document.querySelector('[data-app="paint"], [data-win-action="paint"]');
      if (paintBtn) paintBtn.click();
      setTimeout(() => {
        const pCanvas = document.querySelector('#win-paint canvas, .paint-canvas');
        if (pCanvas && window.__auroraPendingPaintImage) {
          const im = new Image();
          im.onload = () => { pCanvas.getContext('2d').drawImage(im, 0, 0, pCanvas.width, pCanvas.height); };
          im.src = window.__auroraPendingPaintImage;
        }
      }, 350);
    };
    win.querySelector('[data-act="close"]').addEventListener('click', () => {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    });
  }

  // 4. Sticky Notes
  function openNotesApp() {
    const win = createSuiteWindow('notes', 'Sticky Notes', '🗒️', 380, 400, `
      <div style="display:flex;gap:6px;">
        <button id="sn-add" style="padding:6px 12px;border-radius:8px;border:none;background:#eab308;color:#111;font-weight:700;font-size:12px;cursor:pointer;">+ New Note</button>
        <button id="sn-export" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:inherit;font-size:12px;cursor:pointer;">⬇ Export .txt</button>
      </div>
      <div id="sn-list" style="display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto;"></div>
    `);
    const list = win.querySelector('#sn-list');
    const colors = ['#fef08a', '#bae6fd', '#fbcfe8', '#bbf7d0'];
    let notes = JSON.parse(localStorage.getItem('aurora_sticky_notes') || '[{"text":"AuroraOS Win11 v2 active!","color":"#fef08a"}]');
    const save = () => localStorage.setItem('aurora_sticky_notes', JSON.stringify(notes));
    const render = () => {
      list.innerHTML = '';
      notes.forEach((n, i) => {
        const box = document.createElement('div');
        box.style.cssText = `background:${n.color};color:#111827;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;`;
        box.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;">
            <span>Note #${i + 1}</span>
            <button data-del="${i}" style="border:none;background:rgba(0,0,0,0.15);border-radius:4px;padding:1px 6px;cursor:pointer;">✕</button>
          </div>
          <textarea style="width:100%;min-height:64px;border:none;background:transparent;color:#111827;font-size:13px;resize:vertical;outline:none;">${n.text}</textarea>
        `;
        box.querySelector('textarea').oninput = (e) => { notes[i].text = e.target.value; save(); };
        box.querySelector('[data-del]').onclick = () => { notes.splice(i, 1); save(); render(); };
        list.appendChild(box);
      });
    };
    win.querySelector('#sn-add').onclick = () => { notes.unshift({ text: '', color: colors[notes.length % colors.length] }); save(); render(); };
    win.querySelector('#sn-export').onclick = () => {
      const blob = new Blob([notes.map((n, i) => `--- Note ${i + 1} ---\n${n.text}`).join('\n\n')], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'AuroraNotes.txt'; a.click();
    };
    render();
  }

  // 5. Windows Settings
  function openSettingsApp() {
    const win = createSuiteWindow('settings', 'Windows 11 Settings', '⚙️', 460, 420, `
      <div style="font-size:13px;font-weight:700;">🎨 Accent Color</div>
      <div id="st-accents" style="display:flex;gap:8px;flex-wrap:wrap;">
        ${[['#3b82f6','Windows Blue'],['#10b981','Emerald'],['#8b5cf6','Royal Purple'],['#f59e0b','Amber'],['#ef4444','Crimson']].map(([hex, label]) =>
          `<button data-hex="${hex}" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:${hex};color:#fff;font-size:12px;cursor:pointer;">${label}</button>`
        ).join('')}
      </div>
      <div style="font-size:13px;font-weight:700;margin-top:6px;">🌗 Window Theme</div>
      <div style="display:flex;gap:8px;">
        <button id="st-dark" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#0f172a;color:#fff;font-size:12px;cursor:pointer;">Mica Dark</button>
        <button id="st-light" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.2);background:#f8fafc;color:#0f172a;font-size:12px;cursor:pointer;">Mica Light</button>
      </div>
      <div style="font-size:13px;font-weight:700;margin-top:6px;">💾 Backup & Restore</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="st-backup" style="padding:6px 12px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">⬇ Export Backup (.json)</button>
        <label style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.14);font-size:12px;cursor:pointer;">
          ⬆ Restore Backup
          <input id="st-restore" type="file" accept=".json" style="display:none;" />
        </label>
      </div>
      <div style="margin-top:auto;font-size:11px;opacity:0.75;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;">
        AuroraOS Win11 Edge Shell • Suite v2.1 • Screen: ${window.innerWidth}x${window.innerHeight}
      </div>
    `);
    win.querySelectorAll('#st-accents button').forEach(btn => {
      btn.onclick = () => {
        document.documentElement.style.setProperty('--win-accent', btn.dataset.hex);
        localStorage.setItem('aurora_accent', btn.dataset.hex);
        window.auroraToast('Accent Updated', 'Applied ' + btn.textContent + ' accent color.');
      };
    });
    win.querySelector('#st-dark').onclick = () => {
      document.documentElement.style.setProperty('--win-bg', '#181824');
      document.documentElement.style.setProperty('--win-fg', '#f1f5f9');
      localStorage.setItem('aurora_theme', 'dark');
    };
    win.querySelector('#st-light').onclick = () => {
      document.documentElement.style.setProperty('--win-bg', 'rgba(248,250,252,0.96)');
      document.documentElement.style.setProperty('--win-fg', '#0f172a');
      localStorage.setItem('aurora_theme', 'light');
    };
    win.querySelector('#st-backup').onclick = () => {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); dump[k] = localStorage.getItem(k); }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
      a.download = 'AuroraOS_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
    };
    win.querySelector('#st-restore').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        Object.entries(JSON.parse(r.result)).forEach(([k, v]) => localStorage.setItem(k, v));
        window.auroraToast('Backup Restored', 'Reloading workspace...');
        setTimeout(() => location.reload(), 800);
      };
      r.readAsText(f);
    };
  }

  window.launchAuroraV2App = function (id) {
    if (id === 'cortex') return openCortexApp();
    if (id === 'media') return openMediaApp();
    if (id === 'camera') return openCameraApp();
    if (id === 'notes') return openNotesApp();
    if (id === 'settings') return openSettingsApp();
  };

  // Self-healing mount: attaches to desktop grid if found AND always mounts a compact floating Win11 Suite Dock above taskbar
  function mountSuiteUI() {
    if (!document.body) return;
    const savedAccent = localStorage.getItem('aurora_accent');
    if (savedAccent) document.documentElement.style.setProperty('--win-accent', savedAccent);
    if (localStorage.getItem('aurora_theme') === 'light') {
      document.documentElement.style.setProperty('--win-bg', 'rgba(248,250,252,0.96)');
      document.documentElement.style.setProperty('--win-fg', '#0f172a');
    }

    const desktopGrid = document.querySelector('#desktop, .desktop-icons, .desktop-grid, [class*="desktop"], main');
    if (desktopGrid) {
      NEW_APPS.forEach(app => {
        if (document.querySelector(`[data-aurora-v2="${app.id}"]`)) return;
        const tile = document.createElement('div');
        tile.className = 'desktop-icon app-icon';
        tile.dataset.auroraV2 = app.id;
        tile.style.cssText = 'width:76px;padding:8px 4px;border-radius:8px;display:inline-flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;text-align:center;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.9);user-select:none;z-index:50;';
        tile.innerHTML = `<div style="font-size:28px;line-height:1;">${app.icon}</div><div style="font-size:11px;font-weight:600;">${app.name}</div>`;
        tile.onclick = () => window.launchAuroraV2App(app.id);
        desktopGrid.appendChild(tile);
      });
    }

    if (!document.getElementById('aurora-v2-dock')) {
      const dock = document.createElement('div');
      dock.id = 'aurora-v2-dock';
      dock.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);z-index:2147483640;display:flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(15,18,28,0.88);border:1px solid rgba(255,255,255,0.22);border-radius:16px;box-shadow:0 10px 28px rgba(0,0,0,0.55);backdrop-filter:blur(14px);max-width:96vw;flex-wrap:wrap;justify-content:center;';
      NEW_APPS.forEach(app => {
        const btn = document.createElement('button');
        btn.title = app.name;
        btn.style.cssText = 'border:none;background:rgba(255,255,255,0.08);color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;';
        btn.innerHTML = `<span>${app.icon}</span><span>${app.name}</span>`;
        btn.onclick = () => window.launchAuroraV2App(app.id);
        dock.appendChild(btn);
      });
      document.body.appendChild(dock);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSuiteUI);
  } else {
    mountSuiteUI();
  }
  setInterval(mountSuiteUI, 2000);
})();


/* === AURORAOS MOVABLE/MINIMIZABLE QUICK MENU, AUTO-MIN & F1 KEY === */
(function() {
  if (window.__auroraQuickFixV2) return;
  window.__auroraQuickFixV2 = true;

  const style = document.createElement('style');
  style.textContent = `
    .aurora-drag-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 10px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.18);
      cursor: grab; touch-action: none; user-select: none; font-size: 11px; color: #cbd5e1;
      width: 100%; box-sizing: border-box;
    }
    .aurora-drag-bar:active { cursor: grabbing; }
    .aurora-min-btn {
      background: rgba(255,255,255,0.18); border: none; color: #fff;
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
      el => el.children.length === 0 && el.textContent && el.textContent.includes('Camera Studio')
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
        <span class="aurora-f1-chip" data-cmd="trips">trips</span>
        <span class="aurora-f1-chip" data-cmd="dtc">dtc</span>
        <span class="aurora-f1-chip" data-cmd="latest gh builds">latest gh builds</span>
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
        out.textContent = 'Bridge offline on :8420.';
      }
    };

    modal.querySelectorAll('.aurora-f1-chip').forEach(c => c.addEventListener('click', () => run(c.dataset.cmd)));
    document.getElementById('aurora-f1-close').addEventListener('click', () => modal.classList.remove('open'));
    window.toggleAuroraGuide = () => { modal.classList.toggle('open'); if (modal.classList.contains('open')) run('commands'); };
  }

  // Auto-minimize when tapping anywhere outside the Quick Menu
  document.addEventListener('pointerdown', (e) => {
    const menu = document.querySelector('[data-movable-ready="1"]');
    if (!menu || menu.classList.contains('aurora-menu-minimized')) return;
    if (menu.contains(e.target)) return;
    if (e.target.closest('#start-btn, .start-btn, [data-start-toggle]')) return;
    menu.classList.add('aurora-menu-minimized');
    const minBtn = menu.querySelector('.aurora-min-btn');
    if (minBtn) minBtn.textContent = '▲';
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      if (window.toggleAuroraGuide) window.toggleAuroraGuide();
    }
  });

  function boot() {
    attachMenuControls();
    setupGuidanceModal();
    new MutationObserver(attachMenuControls).observe(document.body, { childList: true, subtree: true });
    setInterval(attachMenuControls, 1200);
  }
  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot);
})();
