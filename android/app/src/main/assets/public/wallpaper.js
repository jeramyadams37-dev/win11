(function () {
  'use strict';

  const STORAGE_KEY = 'w11_wallpaper_cfg_v1';

  const PRESETS = [
    {
      name: 'Bloom Dark',
      type: 'image',
      value: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><defs><radialGradient id='bg' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='%230d2b52'/><stop offset='100%25' stop-color='%23050b18'/></radialGradient><linearGradient id='p1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%2338bdf8' stop-opacity='0.85'/><stop offset='100%25' stop-color='%231d4ed8' stop-opacity='0.9'/></linearGradient><linearGradient id='p2' x1='1' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%2360a5fa' stop-opacity='0.75'/><stop offset='100%25' stop-color='%231e3a8a' stop-opacity='0.95'/></linearGradient></defs><rect width='1600' height='900' fill='url(%23bg)'/><path d='M800 180 C1050 180 1220 350 1120 560 C1020 770 720 760 640 560 C560 360 620 180 800 180 Z' fill='url(%23p1)'/><path d='M740 260 C960 210 1180 390 1060 610 C940 830 620 780 560 570 C500 360 560 300 740 260 Z' fill='url(%23p2)'/><ellipse cx='820' cy='480' rx='220' ry='140' fill='%230ea5e9' opacity='0.35'/></svg>\")"
    },
    {
      name: 'Bloom Light',
      type: 'image',
      value: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%23e0f2fe'/><stop offset='50%25' stop-color='%23bae6fd'/><stop offset='100%25' stop-color='%2393c5fd'/></linearGradient><linearGradient id='p1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%230284c7' stop-opacity='0.8'/><stop offset='100%25' stop-color='%232563eb' stop-opacity='0.85'/></linearGradient><linearGradient id='p2' x1='1' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%2338bdf8' stop-opacity='0.7'/><stop offset='100%25' stop-color='%231d4ed8' stop-opacity='0.8'/></linearGradient></defs><rect width='1600' height='900' fill='url(%23bg)'/><path d='M800 170 C1080 170 1240 360 1130 580 C1020 800 700 770 620 560 C540 350 610 170 800 170 Z' fill='url(%23p1)'/><path d='M730 250 C960 200 1190 400 1050 620 C910 840 600 780 540 560 C480 340 550 290 730 250 Z' fill='url(%23p2)'/></svg>\")"
    },
    {
      name: 'Aurora Wave',
      type: 'gradient',
      value: 'radial-gradient(circle at 20% 20%, #0f766e 0%, transparent 45%), radial-gradient(circle at 80% 30%, #1d4ed8 0%, transparent 50%), radial-gradient(circle at 50% 85%, #4338ca 0%, #030712 75%)'
    },
    {
      name: 'Captured Motion',
      type: 'gradient',
      value: 'radial-gradient(circle at 75% 25%, #f59e0b 0%, transparent 42%), radial-gradient(circle at 30% 65%, #e11d48 0%, transparent 52%), linear-gradient(135deg, #1e1b4b 0%, #31102f 55%, #090d16 100%)'
    },
    {
      name: 'Emerald Peak',
      type: 'gradient',
      value: 'linear-gradient(160deg, #022c22 0%, #065f46 42%, #0f172a 100%)'
    },
    {
      name: 'Carbon Grid',
      type: 'gradient',
      value: 'radial-gradient(#334155 1px, transparent 1px), linear-gradient(180deg, #0f172a 0%, #020617 100%)'
    }
  ];

  const DEFAULT_CFG = {
    mode: 'preset',
    presetIndex: 0,
    customImage: '',
    color: '#0f172a',
    size: 'cover',
    brightness: 100,
    blur: 0
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign({}, DEFAULT_CFG, JSON.parse(raw)) : Object.assign({}, DEFAULT_CFG);
    } catch (_) {
      return Object.assign({}, DEFAULT_CFG);
    }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (err) {
      console.warn('Wallpaper save warning:', err);
    }
  }

  let cfg = loadConfig();

  // Inject Styles
  const style = document.createElement('style');
  style.textContent = `
    #w11-wp-layer {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-position: center center;
      background-repeat: no-repeat;
      transition: background 0.25s ease, filter 0.15s ease;
    }
    #w11-wp-fab {
      position: fixed;
      top: max(10px, env(safe-area-inset-top));
      right: 10px;
      z-index: 9990;
      background: rgba(24, 24, 27, 0.72);
      color: #f4f4f5;
      border: 1px solid rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 999px;
      padding: 6px 12px;
      font: 600 12px system-ui, -apple-system, sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      opacity: 0.85;
    }
    #w11-wp-fab:active { transform: scale(0.96); opacity: 1; }
    #w11-ctx-menu {
      display: none;
      position: fixed;
      z-index: 10000;
      min-width: 195px;
      background: rgba(30, 32, 38, 0.88);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
      padding: 5px;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
      font: 500 13px system-ui, -apple-system, sans-serif;
    }
    #w11-ctx-menu button {
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      color: #f4f4f5;
      padding: 9px 12px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    #w11-ctx-menu button:hover, #w11-ctx-menu button:active {
      background: rgba(255, 255, 255, 0.12);
    }
    #w11-wp-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(0, 0, 0, 0.45);
      align-items: center;
      justify-content: center;
      padding: 14px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #w11-wp-card {
      width: 100%;
      max-width: 460px;
      max-height: 88vh;
      overflow-y: auto;
      background: rgba(28, 30, 36, 0.92);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      padding: 16px;
    }
    .w11-wp-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    .w11-wp-hdr h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .w11-wp-close {
      background: rgba(255,255,255,0.1);
      border: 0;
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
    }
    .w11-wp-sec { margin-bottom: 14px; }
    .w11-wp-lbl {
      display: block;
      font-size: 12px;
      color: #cbd5e1;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .w11-wp-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .w11-wp-swatch {
      height: 54px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      background-size: cover;
      background-position: center;
    }
    .w11-wp-swatch.active {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.45);
    }
    .w11-wp-swatch span {
      position: absolute;
      bottom: 0;
      inset-x: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.58);
      color: #fff;
      font-size: 10px;
      padding: 2px 4px;
      text-align: center;
    }
    .w11-wp-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .w11-wp-btn {
      background: #2563eb;
      color: #fff;
      border: 0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .w11-wp-btn.sec {
      background: rgba(255, 255, 255, 0.12);
    }
    .w11-wp-input, .w11-wp-select {
      flex: 1;
      min-width: 120px;
      background: rgba(15, 23, 42, 0.85);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
    }
    .w11-wp-slider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .w11-wp-slider-row input[type="range"] { flex: 1; accent-color: #38bdf8; }
  `;
  document.head.appendChild(style);

  // Create Wallpaper Layer
  const wpLayer = document.createElement('div');
  wpLayer.id = 'w11-wp-layer';
  document.body.insertBefore(wpLayer, document.body.firstChild);

  function clearContainerBackgrounds() {
    const selectors = ['body', '#desktop', '.desktop', '#wallpaper', '.wallpaper', '#screen', '.screen'];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.id !== 'w11-wp-layer') {
          el.style.backgroundColor = 'transparent';
          el.style.backgroundImage = 'none';
        }
      });
    });
  }

  function applyWallpaper() {
    clearContainerBackgrounds();
    wpLayer.style.backgroundColor = cfg.color || '#0f172a';
    wpLayer.style.backgroundImage = 'none';
    wpLayer.style.backgroundSize = cfg.size === 'tile' ? '32px 32px' : (cfg.size || 'cover');
    wpLayer.style.backgroundRepeat = cfg.size === 'tile' ? 'repeat' : 'no-repeat';

    if (cfg.mode === 'preset') {
      const p = PRESETS[cfg.presetIndex] || PRESETS[0];
      wpLayer.style.backgroundImage = p.value;
      if (p.name === 'Carbon Grid') {
        wpLayer.style.backgroundSize = '24px 24px, cover';
        wpLayer.style.backgroundRepeat = 'repeat, no-repeat';
      }
    } else if (cfg.mode === 'custom' && cfg.customImage) {
      const urlVal = cfg.customImage.startsWith('url(') ? cfg.customImage : `url("${cfg.customImage}")`;
      wpLayer.style.backgroundImage = urlVal;
    } else if (cfg.mode === 'color') {
      wpLayer.style.backgroundColor = cfg.color;
    }

    const b = Number(cfg.brightness ?? 100);
    const bl = Number(cfg.blur ?? 0);
    wpLayer.style.filter = `brightness(${b}%) blur(${bl}px)`;
    wpLayer.style.transform = bl > 0 ? 'scale(1.03)' : 'scale(1)';
  }

  // Desktop shortcut replaces floating pill

  // Build Desktop Context Menu
  const ctxMenu = document.createElement('div');
  ctxMenu.id = 'w11-ctx-menu';
  ctxMenu.innerHTML = `
    <button type="button" id="w11-ctx-open">🖼️ Personalize Wallpaper</button>
    <button type="button" id="w11-ctx-next">🔄 Next Preset Wallpaper</button>
  `;
  document.body.appendChild(ctxMenu);

  // Build Personalization Modal
  const modal = document.createElement('div');
  modal.id = 'w11-wp-modal';
  modal.innerHTML = `
    <div id="w11-wp-card">
      <div class="w11-wp-hdr">
        <h3>Personalize &bull; Desktop Background</h3>
        <button type="button" class="w11-wp-close" id="w11-wp-close">&times;</button>
      </div>

      <div class="w11-wp-sec">
        <span class="w11-wp-lbl">Built-in Themes</span>
        <div class="w11-wp-grid" id="w11-wp-presets"></div>
      </div>

      <div class="w11-wp-sec">
        <span class="w11-wp-lbl">Upload Photo from Phone</span>
        <div class="w11-wp-row">
          <input type="file" id="w11-wp-file" accept="image/*" style="display:none">
          <button type="button" class="w11-wp-btn" id="w11-wp-pick-btn">Choose Image...</button>
          <input type="color" id="w11-wp-color" value="#0f172a" title="Solid Color" style="width:40px;height:34px;border:0;background:none;cursor:pointer;">
          <button type="button" class="w11-wp-btn sec" id="w11-wp-color-btn">Solid Color</button>
        </div>
      </div>

      <div class="w11-wp-sec">
        <span class="w11-wp-lbl">Image URL</span>
        <div class="w11-wp-row">
          <input type="text" class="w11-wp-input" id="w11-wp-url" placeholder="https://example.com/wallpaper.jpg">
          <button type="button" class="w11-wp-btn sec" id="w11-wp-url-btn">Apply</button>
        </div>
      </div>

      <div class="w11-wp-sec">
        <span class="w11-wp-lbl">Fit &amp; Visual Adjustments</span>
        <div class="w11-wp-slider-row">
          <span style="min-width:74px;">Fit Mode</span>
          <select class="w11-wp-select" id="w11-wp-fit">
            <option value="cover">Fill (Cover)</option>
            <option value="contain">Fit (Contain)</option>
            <option value="100% 100%">Stretch</option>
            <option value="auto">Center</option>
          </select>
        </div>
        <div class="w11-wp-slider-row">
          <span style="min-width:74px;">Brightness</span>
          <input type="range" id="w11-wp-bright" min="30" max="130" value="100">
          <span id="w11-wp-bright-val" style="min-width:36px;text-align:right;">100%</span>
        </div>
        <div class="w11-wp-slider-row">
          <span style="min-width:74px;">Blur</span>
          <input type="range" id="w11-wp-blur" min="0" max="12" value="0">
          <span id="w11-wp-blur-val" style="min-width:36px;text-align:right;">0px</span>
        </div>
      </div>

      <div class="w11-wp-row" style="justify-content:space-between;margin-top:8px;">
        <button type="button" class="w11-wp-btn sec" id="w11-wp-reset">Reset Default</button>
        <button type="button" class="w11-wp-btn" id="w11-wp-done">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Populate Preset Swatches
  const presetsGrid = document.getElementById('w11-wp-presets');
  function renderPresets() {
    presetsGrid.innerHTML = '';
    PRESETS.forEach((p, idx) => {
      const btn = document.createElement('div');
      btn.className = 'w11-wp-swatch' + (cfg.mode === 'preset' && cfg.presetIndex === idx ? ' active' : '');
      btn.style.backgroundImage = p.value;
      btn.innerHTML = `<span>${p.name}</span>`;
      btn.addEventListener('click', () => {
        cfg.mode = 'preset';
        cfg.presetIndex = idx;
        saveConfig(cfg);
        applyWallpaper();
        renderPresets();
      });
      presetsGrid.appendChild(btn);
    });
  }

  function syncControlsFromCfg() {
    document.getElementById('w11-wp-color').value = cfg.color || '#0f172a';
    document.getElementById('w11-wp-fit').value = cfg.size || 'cover';
    document.getElementById('w11-wp-bright').value = cfg.brightness ?? 100;
    document.getElementById('w11-wp-bright-val').textContent = (cfg.brightness ?? 100) + '%';
    document.getElementById('w11-wp-blur').value = cfg.blur ?? 0;
    document.getElementById('w11-wp-blur-val').textContent = (cfg.blur ?? 0) + 'px';
    renderPresets();
  }

  function openModal() {
    ctxMenu.style.display = 'none';
    syncControlsFromCfg();
    modal.style.display = 'flex';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  
  document.getElementById('w11-wp-close').addEventListener('click', closeModal);
  document.getElementById('w11-wp-done').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Image File Upload + Canvas Compression (avoids localStorage quota issues on high-MP phone photos)
  const fileInput = document.getElementById('w11-wp-file');
  document.getElementById('w11-wp-pick-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      const img = new Image();
      img.onload = function () {
        const MAX = 1920;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * (MAX / w)); w = MAX; }
          else { w = Math.round(w * (MAX / h)); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        cfg.mode = 'custom';
        cfg.customImage = compressed;
        saveConfig(cfg);
        applyWallpaper();
        renderPresets();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Solid Color
  const colorPicker = document.getElementById('w11-wp-color');
  document.getElementById('w11-wp-color-btn').addEventListener('click', () => {
    cfg.mode = 'color';
    cfg.color = colorPicker.value;
    saveConfig(cfg);
    applyWallpaper();
    renderPresets();
  });
  colorPicker.addEventListener('input', () => {
    cfg.mode = 'color';
    cfg.color = colorPicker.value;
    saveConfig(cfg);
    applyWallpaper();
    renderPresets();
  });

  // Image URL
  document.getElementById('w11-wp-url-btn').addEventListener('click', () => {
    const url = document.getElementById('w11-wp-url').value.trim();
    if (!url) return;
    cfg.mode = 'custom';
    cfg.customImage = url;
    saveConfig(cfg);
    applyWallpaper();
    renderPresets();
  });

  // Fit, Brightness, Blur
  document.getElementById('w11-wp-fit').addEventListener('change', (e) => {
    cfg.size = e.target.value;
    saveConfig(cfg);
    applyWallpaper();
  });

  document.getElementById('w11-wp-bright').addEventListener('input', (e) => {
    cfg.brightness = Number(e.target.value);
    document.getElementById('w11-wp-bright-val').textContent = cfg.brightness + '%';
    saveConfig(cfg);
    applyWallpaper();
  });

  document.getElementById('w11-wp-blur').addEventListener('input', (e) => {
    cfg.blur = Number(e.target.value);
    document.getElementById('w11-wp-blur-val').textContent = cfg.blur + 'px';
    saveConfig(cfg);
    applyWallpaper();
  });

  document.getElementById('w11-wp-reset').addEventListener('click', () => {
    cfg = Object.assign({}, DEFAULT_CFG);
    saveConfig(cfg);
    syncControlsFromCfg();
    applyWallpaper();
  });

  // Desktop Right-Click & Mobile 500ms Long-Press Context Menu
  function showContextMenu(x, y) {
    ctxMenu.style.display = 'block';
    const maxX = window.innerWidth - 205;
    const maxY = window.innerHeight - 95;
    ctxMenu.style.left = Math.max(8, Math.min(x, maxX)) + 'px';
    ctxMenu.style.top = Math.max(8, Math.min(y, maxY)) + 'px';
  }

  function isDesktopSurface(target) {
    if (!target) return false;
    if (target.closest('#w11-wp-modal, #w11-ctx-menu, .window, .win, .taskbar, #taskbar, .start-menu, #start-menu, button, input, select, textarea')) {
      return false;
    }
    return true;
  }

  document.addEventListener('contextmenu', (e) => {
    if (isDesktopSurface(e.target)) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    }
  });

  let pressTimer = null;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && isDesktopSurface(e.target)) {
      const t = e.touches[0];
      pressTimer = setTimeout(() => {
        showContextMenu(t.clientX, t.clientY);
      }, 500);
    }
  }, { passive: true });

  ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => {
    document.addEventListener(ev, () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }, { passive: true });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#w11-ctx-menu')) {
      ctxMenu.style.display = 'none';
    }
    if (e.target.closest('[data-win-action="personalize"], [data-action="wallpaper"]')) {
      openModal();
    }
  });

  document.getElementById('w11-ctx-open').addEventListener('click', openModal);
  document.getElementById('w11-ctx-next').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    cfg.mode = 'preset';
    cfg.presetIndex = ((cfg.presetIndex ?? 0) + 1) % PRESETS.length;
    saveConfig(cfg);
    applyWallpaper();
  });

  // Keyboard shortcut: Alt + W
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      openModal();
    }
  });

  
  // Mount Windows 11 Personalize Desktop Shortcut Icon (fallback if not already in HTML grid)
  if (!document.querySelector('[data-win-action="personalize"]')) {
    const scStyle = document.createElement('style');
    scStyle.textContent = `
      #w11-desktop-shortcut {
        position: fixed;
        top: max(16px, env(safe-area-inset-top));
        left: 14px;
        z-index: 5;
        width: 76px;
        padding: 8px 4px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: #ffffff;
        text-align: center;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      #w11-desktop-shortcut:hover, #w11-desktop-shortcut:active {
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(6px);
      }
      #w11-desktop-shortcut .w11-sc-lbl {
        display: block;
        font: 500 11.5px/1.2 system-ui, -apple-system, sans-serif;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.65);
        word-break: break-word;
      }
    `;
    document.head.appendChild(scStyle);

    const sc = document.createElement('div');
    sc.id = 'w11-desktop-shortcut';
    sc.setAttribute('role', 'button');
    sc.setAttribute('tabindex', '0');
    sc.setAttribute('data-win-action', 'personalize');
    sc.setAttribute('data-action', 'wallpaper');
    sc.title = 'Personalize Desktop Wallpaper';
    sc.innerHTML = `<svg viewBox="0 0 48 48" width="38" height="38" style="display:block;margin:0 auto 4px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45))">
  <defs>
    <linearGradient id="w11p_scr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="w11p_br" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect x="5" y="7" width="38" height="26" rx="3.5" fill="url(#w11p_scr)" stroke="#e2e8f0" stroke-width="1.6"/>
  <path d="M18 37h12M24 33v4" stroke="#cbd5e1" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M35 13l4 4-13 13-5 1 1-5z" fill="url(#w11p_br)" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
</svg><span class="w11-sc-lbl">Personalize</span>`;
    document.body.appendChild(sc);
  }

  // Initial render
  applyWallpaper();
})();
