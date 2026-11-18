(function () {
  if (window.__aqFix2) return;
  window.__aqFix2 = true;
  var BR = 'http://127.0.0.1:8420';
  var css = document.createElement('style');
  css.textContent =
    '.aq-ico{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;font-size:26px;line-height:1}' +
    '#aurora-v2-dock.aq-dock-mini>*:not(.aq-dockbar){display:none!important}' +
    '.aq-dockbar{flex:0 0 100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 6px 4px;font-size:11px;color:#cbd5e1;cursor:grab;touch-action:none;user-select:none}' +
    '.aq-dockbar button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:4px;padding:2px 10px;font-size:12px}' +
    '.aq-win{position:fixed;top:60px;left:50%;transform:translateX(-50%);width:min(560px,94vw);max-height:70vh;overflow:auto;background:rgba(20,24,34,.97);color:#f8fafc;border:1px solid rgba(56,189,248,.45);border-radius:12px;padding:14px;z-index:2147483645;font-family:system-ui,sans-serif}' +
    '.aq-win pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:rgba(0,0,0,.5);padding:8px;border-radius:8px}' +
    '.aq-win button{padding:6px 12px;margin-right:6px;border:0;border-radius:6px;background:#0078d4;color:#fff}';
  document.head.appendChild(css);

  function panel(id, title, path) {
    var old = document.getElementById('aq-w-' + id);
    if (old) { old.remove(); return; }
    var w = document.createElement('div');
    w.className = 'aq-win';
    w.id = 'aq-w-' + id;
    w.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>' + title +
      '</strong><span><button class="aq-r">Refresh</button><button class="aq-x" style="background:#c42b1c">Close</button></span></div><pre></pre>';
    document.body.appendChild(w);
    var out = w.querySelector('pre');
    function load() {
      out.textContent = 'Loading...';
      fetch(BR + path).then(function (r) { return r.json(); })
        .then(function (j) { out.textContent = JSON.stringify(j, null, 2); })
        .catch(function (e) { out.textContent = 'Bridge not reachable on :8420. Start it, then tap Refresh.\n' + e; });
    }
    w.querySelector('.aq-r').onclick = load;
    w.querySelector('.aq-x').onclick = function () { w.remove(); };
    load();
  }
  window.__aqPanel = function (id) {
    if (id === 'edge') panel('edge', 'EdgeRider Trips', '/api/edgerider/trips');
    else if (id === 'shop') panel('shop', 'ShopSense DTC Codes', '/api/shopsense/dtc');
  };

  var ITEMS = [
    { id: 'cortex', label: 'Cortex AI', icon: '\uD83E\uDDE0', run: function () { if (window.launchAuroraV2App) window.launchAuroraV2App('cortex'); } },
    { id: 'edge', label: 'EdgeRider', icon: '\uD83D\uDE97', run: function () { window.__aqPanel('edge'); } },
    { id: 'shop', label: 'ShopSense', icon: '\uD83D\uDD27', run: function () { window.__aqPanel('shop'); } }
  ];

  function addDesk() {
    var col = document.getElementById('w11-icon-column');
    if (!col) return;
    ITEMS.forEach(function (it) {
      if (col.querySelector('[data-aq="' + it.id + '"]')) return;
      var d = document.createElement('div');
      d.className = 'w11-desk-app';
      d.setAttribute('data-aq', it.id);
      d.setAttribute('role', 'button');
      d.tabIndex = 0;
      d.innerHTML = '<span class="aq-ico">' + it.icon + '</span><span>' + it.label + '</span>';
      d.addEventListener('click', it.run);
      col.appendChild(d);
    });
  }

  function addBar() {
    var d = document.getElementById('aurora-v2-dock');
    if (!d || d.querySelector('.aq-dockbar')) return;
    var bar = document.createElement('div');
    bar.className = 'aq-dockbar';
    bar.innerHTML = '<span>\u283F Quick Menu</span><button type="button">\u2014</button>';
    d.insertBefore(bar, d.firstChild);
    var hb = document.createElement('button');
    hb.type = 'button';
    hb.className = 'aq-help';
    hb.title = 'Cortex commands and help';
    hb.style.cssText = 'border:none;background:rgba(255,255,255,0.08);color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:600;';
    hb.innerHTML = '<span>\u2753</span><span>Help</span>';
    hb.onclick = function () {
      if (typeof window.toggleAuroraGuide === 'function') window.toggleAuroraGuide();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
    };
    d.appendChild(hb);
    var b = bar.querySelector('button');
    function setMini(m) {
      d.classList.toggle('aq-dock-mini', m);
      b.textContent = m ? '\u25B2' : '\u2014';
      try { localStorage.setItem('aq_dock_mini', m ? '1' : '0'); } catch (e) {}
    }
    var saved = '0';
    try { saved = localStorage.getItem('aq_dock_mini') || '0'; } catch (e) {}
    setMini(saved === '1');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      setMini(!d.classList.contains('aq-dock-mini'));
    });
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      var r = d.getBoundingClientRect();
      d.style.transform = 'none';
      d.style.left = r.left + 'px';
      d.style.top = r.top + 'px';
      d.style.bottom = 'auto';
      var dx = e.clientX - r.left, dy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
      function mv(ev) {
        d.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px';
        d.style.top = Math.max(0, Math.min(innerHeight - 50, ev.clientY - dy)) + 'px';
      }
      function up() {
        bar.removeEventListener('pointermove', mv);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
      }
      bar.addEventListener('pointermove', mv);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
  }

  function tick() { addDesk(); addBar(); }
  tick();
  setInterval(tick, 1000);
})();
