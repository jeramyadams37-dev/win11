(function () {
  if (window.__aqFix) return;
  window.__aqFix = true;
  var BR = 'http://127.0.0.1:8420';
  var css = document.createElement('style');
  css.textContent =
    '.aq-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.18);cursor:grab;touch-action:none;user-select:none;font-size:11px;color:#cbd5e1}' +
    '.aq-min{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px}' +
    '#start-menu.aq-mini>*:not(.aq-bar){display:none!important}' +
    '#aq-tray{position:fixed;right:8px;bottom:72px;display:flex;flex-direction:column;gap:8px;z-index:999998}' +
    '#aq-tray button{width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.25);background:rgba(20,24,34,.9);font-size:20px}' +
    '.aq-win{position:fixed;top:60px;left:50%;transform:translateX(-50%);width:min(560px,94vw);max-height:70vh;overflow:auto;background:rgba(20,24,34,.97);color:#f8fafc;border:1px solid rgba(56,189,248,.45);border-radius:12px;padding:14px;z-index:999999;font-family:system-ui,sans-serif}' +
    '.aq-win pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:rgba(0,0,0,.5);padding:8px;border-radius:8px}' +
    '.aq-win button{padding:6px 12px;margin-right:6px;border:0;border-radius:6px;background:#0078d4;color:#fff}';
  document.head.appendChild(css);

  function attachBar() {
    var m = document.getElementById('start-menu');
    if (!m) return false;
    if (m.querySelector('.aq-bar') || m.querySelector('.aurora-drag-bar')) return true;
    m.dataset.movableReady = '1';
    var bar = document.createElement('div');
    bar.className = 'aq-bar';
    bar.innerHTML = '<span>\u283F Quick Menu</span><button class="aq-min">\u2014</button>';
    m.insertBefore(bar, m.firstChild);
    var mb = bar.querySelector('.aq-min');
    mb.addEventListener('click', function () {
      mb.textContent = m.classList.toggle('aq-mini') ? '\u25B2' : '\u2014';
    });
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.aq-min')) return;
      var r = m.getBoundingClientRect();
      m.style.transform = 'none';
      m.style.left = r.left + 'px';
      m.style.top = r.top + 'px';
      m.style.bottom = 'auto';
      m.style.right = 'auto';
      var dx = e.clientX - r.left, dy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
      function mv(ev) {
        m.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx)) + 'px';
        m.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px';
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
    return true;
  }

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

  function tray() {
    if (document.getElementById('aq-tray')) return;
    var t = document.createElement('div');
    t.id = 'aq-tray';
    t.innerHTML = '<button id="aq-c" title="Cortex AI">\uD83E\uDDE0</button><button id="aq-e" title="EdgeRider">\uD83D\uDE97</button><button id="aq-s" title="ShopSense">\uD83D\uDD27</button>';
    document.body.appendChild(t);
    document.getElementById('aq-c').onclick = function () {
      if (typeof window.toggleAuroraGuide === 'function') window.toggleAuroraGuide();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
    };
    document.getElementById('aq-e').onclick = function () { panel('edge', 'EdgeRider Trips', '/api/edgerider/trips'); };
    document.getElementById('aq-s').onclick = function () { panel('shop', 'ShopSense DTC Codes', '/api/shopsense/dtc'); };
  }

  function init() {
    tray();
    var n = 0;
    var iv = setInterval(function () { if (attachBar() || ++n > 40) clearInterval(iv); }, 500);
  }
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
