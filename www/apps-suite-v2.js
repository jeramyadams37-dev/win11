(function () {
  if (window.__auroraSuiteV2Loaded) return;
  window.__auroraSuiteV2Loaded = true;

  const NEW_APPS = [
    { id: 'cortex',   name: 'Cortex AI',      icon: '🧠', color: '#8b5cf6' },
    { id: 'media',    name: 'Media & Rec',    icon: '🎬', color: '#ec4899' },
    { id: 'camera',   name: 'Camera Studio',  icon: '📷', color: '#06b6d4' },
    { id: 'notes',    name: 'Sticky Notes',   icon: '🗒️', color: '#eab308' },
    { id: 'settings', name: 'Settings',       icon: '⚙️', color: '#3b82f6' }
  ];

  // Helper: Toast Notification
  window.auroraToast = function (title, msg) {
    let host = document.getElementById('aurora-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aurora-toast-host';
      host.style.cssText = 'position:fixed;bottom:56px;right:14px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:300px;pointer-events:none;';
      document.body.appendChild(host);
    }
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(24,24,32,0.95);color:#f8fafc;border:1px solid rgba(255,255,255,0.16);border-left:4px solid var(--win-accent,#3b82f6);border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,0.45);font-size:12px;backdrop-filter:blur(12px);pointer-events:auto;';
    card.innerHTML = `<div style="font-weight:700;margin-bottom:2px;">${title}</div><div style="opacity:0.85;">${msg}</div>`;
    host.appendChild(card);
    if (window.__auroraAddNotif) window.__auroraAddNotif(title, msg);
    setTimeout(() => { card.style.opacity = '0'; card.style.transition = 'opacity .3s'; setTimeout(() => card.remove(), 320); }, 3600);
  };

  // Helper: Create Win11 Window compatible with existing drag/resize/snap
  function createSuiteWindow(appId, title, icon, width, height, bodyHTML) {
    const existing = document.getElementById('win-' + appId);
    if (existing) {
      existing.style.display = 'flex';
      existing.style.zIndex = String(++window.__auroraTopZ || 500);
      return existing;
    }
    window.__auroraTopZ = Math.max(window.__auroraTopZ || 400, 400) + 1;
    const win = document.createElement('div');
    win.id = 'win-' + appId;
    win.className = 'win11-window window aurora-v2-win';
    win.dataset.appId = appId;
    win.dataset.desktop = String(window.__auroraCurrentDesktop || 1);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, 24 + (Math.random() * 40)));
    const top = Math.max(12, Math.min(window.innerHeight - height - 60, 24 + (Math.random() * 35)));
    win.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${Math.min(width, window.innerWidth - 20)}px;height:${Math.min(height, window.innerHeight - 68)}px;background:var(--win-bg,#181822);color:var(--win-fg,#f1f5f9);border:1px solid rgba(255,255,255,0.16);border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,0.55);display:flex;flex-direction:column;overflow:hidden;z-index:${window.__auroraTopZ};backdrop-filter:blur(16px);`;

    win.innerHTML = `
      <div class="win-titlebar window-header" style="height:36px;padding:0 10px;background:rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none;touch-action:none;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
          <span>${icon}</span><span>${title}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button data-act="min" title="Minimize" style="width:26px;height:24px;border:none;border-radius:6px;background:transparent;color:inherit;cursor:pointer;">—</button>
          <button data-act="max" title="Maximize" style="width:26px;height:24px;border:none;border-radius:6px;background:transparent;color:inherit;cursor:pointer;">□</button>
          <button data-act="close" title="Close" style="width:26px;height:24px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-weight:700;">✕</button>
        </div>
      </div>
      <div class="win-body" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;">
        ${bodyHTML}
      </div>
    `;

    // Focus on click
    win.addEventListener('pointerdown', () => {
      window.__auroraTopZ = (window.__auroraTopZ || 400) + 1;
      win.style.zIndex = String(window.__auroraTopZ);
    });

    // Titlebar controls
    let prevRect = null;
    win.querySelector('[data-act="min"]').onclick = () => { win.style.display = 'none'; };
    win.querySelector('[data-act="max"]').onclick = () => {
      if (!prevRect) {
        prevRect = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        win.style.left = '0px'; win.style.top = '0px';
        win.style.width = '100vw'; win.style.height = 'calc(100vh - 48px)';
      } else {
        Object.assign(win.style, prevRect);
        prevRect = null;
      }
    };
    win.querySelector('[data-act="close"]').onclick = () => { win.remove(); };

    // Smooth pointer drag
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
      win.style.top = Math.max(0, Math.min(window.innerHeight - 80, st + (e.clientY - sy))) + 'px';
    });
    bar.addEventListener('pointerup', () => { dragging = false; });

    document.body.appendChild(win);
    return win;
  }

  // APP 1: Cortex AI Hub (Local AuroraOS Flask port 8420 bridge + offline fallback)
  function openCortexApp() {
    const savedUrl = localStorage.getItem('aurora_cortex_url') || 'http://127.0.0.1:8420';
    const win = createSuiteWindow('cortex', 'AuroraOS Cortex AI Hub', '🧠', 520, 440, `
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="cx-url" value="${savedUrl}" style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:inherit;font-size:12px;" />
        <button id="cx-ping" style="padding:6px 10px;border-radius:6px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:12px;cursor:pointer;">Ping</button>
        <span id="cx-status" style="font-size:11px;padding:3px 8px;border-radius:99px;background:rgba(234,179,8,0.2);color:#fde047;">Standby</span>
      </div>
      <div id="cx-log" style="flex:1;min-height:180px;overflow-y:auto;background:rgba(0,0,0,0.32);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
        <div style="opacity:0.8;"><strong>Cortex:</strong> Ready. Connect to local Termux AuroraOS Flask API (<code>:8420</code>) or run local workspace commands.</div>
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
      } catch (e) {
        status.textContent = 'Offline Mode';
        status.style.background = 'rgba(239,68,68,0.25)'; status.style.color = '#fca5a5';
        appendMsg('System', 'Local Flask server unreachable (start AuroraOS in Termux on port 8420). Offline helper active.');
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
        appendMsg('Cortex (Offline)', `Backend :8420 offline. Local state: ${notes.length} sticky notes, ${Object.keys(localStorage).length} storage keys cached.`);
      }
    };
    win.querySelector('#cx-send').onclick = sendPrompt;
    win.querySelector('#cx-prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPrompt(); });
  }

  // APP 2: Media Player & Voice Recorder
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
      <video id="md-player" controls style="width:100%;max-height:190px;background:#000;border-radius:8px;"></video>
      <div id="md-playlist" style="font-size:12px;max-height:70px;overflow:auto;opacity:0.85;">No media loaded. Select local MP3/WAV/MP4 files above.</div>
      <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="font-size:12px;font-weight:600;">🎙️ Voice Memo Recorder: <span id="md-rec-time">00:00</span></div>
        <div style="display:flex;gap:6px;">
          <button id="md-rec-start" style="padding:6px 10px;border-radius:6px;border:none;background:#ef4444;color:#fff;font-size:12px;cursor:pointer;">● Record</button>
          <button id="md-rec-stop" disabled style="padding:6px 10px;border-radius:6px;border:none;background:#475569;color:#fff;font-size:12px;cursor:pointer;">■ Stop & Save</button>
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
          const a = document.createElement('a');
          a.href = url; a.download = 'AuroraMemo_' + Date.now() + '.webm'; a.click();
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
      } catch (err) {
        window.auroraToast('Mic Permission Needed', 'Grant Microphone permission in Android App Settings for AuroraOS Win11.');
      }
    };
    btnStop.onclick = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      clearInterval(timer);
      btnStart.disabled = false; btnStop.disabled = true;
    };
  }

  // APP 3: Camera & Snapshot Studio
  function openCameraApp() {
    const win = createSuiteWindow('camera', 'Camera & Snapshot Studio', '📷', 480, 440, `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="cam-start" style="padding:6px 12px;border-radius:8px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">▶ Start Live Camera</button>
        <button id="cam-snap" style="padding:6px 12px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">📸 Snap Photo</button>
        <label style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.12);color:inherit;font-size:12px;cursor:pointer;">
          📱 Native Camera Fallback
          <input id="cam-native" type="file" accept="image/*" capture="environment" style="display:none;" />
        </label>
      </div>
      <video id="cam-video" autoplay playsinline style="width:100%;max-height:200px;background:#090d16;border-radius:8px;object-fit:cover;"></video>
      <canvas id="cam-canvas" style="display:none;"></canvas>
      <div id="cam-preview-wrap" style="display:none;align-items:center;gap:10px;">
        <img id="cam-img" style="height:84px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);" />
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

    const showCaptured = (dataUrl) => {
      img.src = dataUrl; dl.href = dataUrl;
      wrap.style.display = 'flex';
    };

    win.querySelector('#cam-start').onclick = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = activeStream;
      } catch (_) {
        window.auroraToast('Using Native Fallback', 'Live WebView camera blocked; tap Native Camera Fallback button.');
      }
    };
    win.querySelector('#cam-snap').onclick = () => {
      if (!video.videoWidth) return window.auroraToast('No Video Frame', 'Start Live Camera or use Native Camera Fallback first.');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      showCaptured(canvas.toDataURL('image/png'));
    };
    win.querySelector('#cam-native').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => showCaptured(reader.result);
      reader.readAsDataURL(f);
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

  // APP 4: Sticky Notes
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
    let notes = JSON.parse(localStorage.getItem('aurora_sticky_notes') || '[{"text":"AuroraOS Win11 v2 ready!","color":"#fef08a"}]');
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
    win.querySelector('#sn-add').onclick = () => {
      notes.unshift({ text: '', color: colors[notes.length % colors.length] });
      save(); render();
    };
    win.querySelector('#sn-export').onclick = () => {
      const blob = new Blob([notes.map((n, i) => `--- Note ${i + 1} ---\n${n.text}`).join('\n\n')], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'AuroraNotes.txt'; a.click();
    };
    render();
  }

  // APP 5: Windows Settings & Backup Manager
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
      <div style="font-size:13px;font-weight:700;margin-top:6px;">💾 AuroraOS State Backup & Restore</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="st-backup" style="padding:6px 12px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">⬇ Export Full Backup (.json)</button>
        <label style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.14);font-size:12px;cursor:pointer;">
          ⬆ Restore Backup
          <input id="st-restore" type="file" accept=".json" style="display:none;" />
        </label>
      </div>
      <div style="margin-top:auto;font-size:11px;opacity:0.75;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;">
        AuroraOS Win11 Edge Shell • Build v2.0 • Resolution: ${window.innerWidth}x${window.innerHeight}
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
      document.documentElement.style.setProperty('--win-bg', '#181822');
      document.documentElement.style.setProperty('--win-fg', '#f1f5f9');
      localStorage.setItem('aurora_theme', 'dark');
    };
    win.querySelector('#st-light').onclick = () => {
      document.documentElement.style.setProperty('--win-bg', 'rgba(248,250,252,0.95)');
      document.documentElement.style.setProperty('--win-fg', '#0f172a');
      localStorage.setItem('aurora_theme', 'light');
    };
    win.querySelector('#st-backup').onclick = () => {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        dump[k] = localStorage.getItem(k);
      }
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
        const data = JSON.parse(r.result);
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        window.auroraToast('Backup Restored', 'Reloading workspace settings...');
        setTimeout(() => location.reload(), 900);
      };
      r.readAsText(f);
    };
  }

  // Unified Launcher Router
  window.launchAuroraV2App = function (id) {
    if (id === 'cortex') return openCortexApp();
    if (id === 'media') return openMediaApp();
    if (id === 'camera') return openCameraApp();
    if (id === 'notes') return openNotesApp();
    if (id === 'settings') return openSettingsApp();
  };

  // Restore saved theme on boot & mount Desktop + Start Menu icons
  window.addEventListener('DOMContentLoaded', () => {
    const savedAccent = localStorage.getItem('aurora_accent');
    if (savedAccent) document.documentElement.style.setProperty('--win-accent', savedAccent);
    if (localStorage.getItem('aurora_theme') === 'light') {
      document.documentElement.style.setProperty('--win-bg', 'rgba(248,250,252,0.95)');
      document.documentElement.style.setProperty('--win-fg', '#0f172a');
    }

    const desktopGrid = document.querySelector('#desktop, .desktop-icons, .desktop-grid, main');
    if (desktopGrid) {
      NEW_APPS.forEach(app => {
        if (document.querySelector(`[data-aurora-v2="${app.id}"]`)) return;
        const tile = document.createElement('div');
        tile.className = 'desktop-icon app-icon';
        tile.dataset.auroraV2 = app.id;
        tile.style.cssText = 'width:76px;padding:8px 4px;border-radius:8px;display:inline-flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;text-align:center;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.85);user-select:none;';
        tile.innerHTML = `<div style="font-size:28px;line-height:1;">${app.icon}</div><div style="font-size:11px;font-weight:500;">${app.name}</div>`;
        tile.onclick = () => window.launchAuroraV2App(app.id);
        desktopGrid.appendChild(tile);
      });
    }
  });
})();
