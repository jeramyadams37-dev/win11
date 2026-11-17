(function () {
  'use strict';

  const KEYS = {
    WORD_DOCS: 'w11_office_word_docs_v1',
    EXCEL_SHEETS: 'w11_office_excel_v1',
    PPT_DECKS: 'w11_office_ppt_v1'
  };

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Storage write warning:', e);
    }
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  // Seed default Office files on first launch
  if (!localStorage.getItem(KEYS.WORD_DOCS)) {
    writeStore(KEYS.WORD_DOCS, [
      {
        id: 'doc-welcome',
        title: 'AuroraOS Project Notes.docx',
        updated: new Date().toLocaleDateString(),
        html: '<h1>AuroraOS v8.5 — Desktop Workspace</h1><p>Welcome to <b>Microsoft Word</b> running natively inside AuroraOS Win11.</p><ul><li>Format headings, bold, italic, lists, and alignment</li><li>Auto-saves offline to local device storage</li><li>Export documents as Word (.doc) or Text (.txt)</li></ul>'
      }
    ]);
  }

  if (!localStorage.getItem(KEYS.EXCEL_SHEETS)) {
    writeStore(KEYS.EXCEL_SHEETS, {
      name: 'Budget_Tracker.xlsx',
      cells: {
        A1: 'Item', B1: 'Cost', C1: 'Qty', D1: 'Total',
        A2: 'Starlink Mini', B2: '599', C2: '1', D2: '=B2*C2',
        A3: 'Mesh Node', B3: '89', C3: '2', D3: '=B3*C3',
        A4: '12V Harness', B4: '34.50', C4: '1', D4: '=B4*C4',
        A5: 'Grand Total', D5: '=SUM(D2:D4)'
      }
    });
  }

  if (!localStorage.getItem(KEYS.PPT_DECKS)) {
    writeStore(KEYS.PPT_DECKS, {
      name: 'AuroraOS_Overview.pptx',
      theme: 'aurora',
      slides: [
        {
          title: 'AuroraOS Win11',
          subtitle: 'Mobile Edge Desktop Environment • Built by Jeramy Adams',
          body: '• Full multi-window desktop simulation on Android\n• Offline Microsoft Office productivity suite\n• Custom wallpaper engine & persistent storage',
          notes: 'Opening title slide.'
        },
        {
          title: 'Built-In Productivity',
          subtitle: 'Word • Excel • PowerPoint • Terminal',
          body: '• Edit formatted documents & export .doc files\n• Run live spreadsheet formulas (=SUM, =AVERAGE)\n• Present full-screen slideshows anywhere',
          notes: 'Highlight offline capabilities.'
        }
      ]
    });
  }

  // Inject Fluent Window Manager & Office Styles
  const style = document.createElement('style');
  style.textContent = `
    #w11-icon-column {
      position: fixed;
      top: calc(max(16px, env(safe-area-inset-top)) + 86px);
      left: 14px;
      z-index: 5;
      display: grid;
      grid-template-columns: repeat(2, 76px);
      gap: 6px 4px;
      pointer-events: none;
    }
    .w11-desk-app {
      pointer-events: auto;
      width: 76px;
      padding: 7px 4px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: #fff;
      text-align: center;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: background 0.14s ease, border-color 0.14s ease;
    }
    .w11-desk-app:hover, .w11-desk-app:active {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(6px);
    }
    .w11-desk-app span {
      display: block;
      margin-top: 3px;
      font: 500 11px/1.18 system-ui, -apple-system, sans-serif;
      text-shadow: 0 1px 3px rgba(0,0,0,0.92), 0 0 6px rgba(0,0,0,0.7);
      word-break: break-word;
    }
    #w11-apps-fab {
      position: fixed;
      top: max(10px, env(safe-area-inset-top));
      right: 10px;
      z-index: 9990;
      background: rgba(24, 24, 27, 0.78);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-radius: 999px;
      padding: 6px 13px;
      font: 600 12px system-ui, -apple-system, sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      touch-action: manipulation;
    }
    #w11-apps-fab:active { transform: scale(0.96); }
    #w11-start-drawer {
      display: none;
      position: fixed;
      top: calc(max(10px, env(safe-area-inset-top)) + 42px);
      right: 10px;
      z-index: 10020;
      width: min(340px, calc(100vw - 20px));
      background: rgba(24, 26, 32, 0.92);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      padding: 14px;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.65);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .w11-drawer-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
      margin: 4px 0 8px;
    }
    .w11-drawer-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .w11-drawer-item {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 10px 6px;
      color: #f8fafc;
      text-align: center;
      cursor: pointer;
      font-size: 11.5px;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    .w11-drawer-item:active, .w11-drawer-item:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.45);
    }
    .w11-app-win {
      position: fixed;
      top: 48px;
      left: 16px;
      width: min(760px, calc(100vw - 32px));
      height: min(540px, calc(100vh - 96px));
      background: #181a20;
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .w11-app-win.maximized {
      top: max(0px, env(safe-area-inset-top)) !important;
      left: 0 !important;
      width: 100vw !important;
      height: calc(100vh - max(0px, env(safe-area-inset-top))) !important;
      border-radius: 0;
    }
    .w11-win-bar {
      height: 38px;
      background: rgba(32, 35, 44, 0.96);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px 0 12px;
      cursor: move;
      user-select: none;
      -webkit-user-select: none;
      flex-shrink: 0;
    }
    .w11-win-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .w11-win-ctrls { display: flex; gap: 4px; }
    .w11-win-ctrls button {
      width: 30px;
      height: 26px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #e2e8f0;
      font-size: 13px;
      cursor: pointer;
    }
    .w11-win-ctrls button:hover { background: rgba(255,255,255,0.12); }
    .w11-win-ctrls button.cls:hover { background: #dc2626; color: #fff; }
    .w11-win-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #111318;
    }
    .w11-ribbon {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding: 7px 10px;
      background: #1e212b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      align-items: center;
      flex-shrink: 0;
    }
    .w11-rbtn {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .w11-rbtn:active, .w11-rbtn:hover { background: rgba(255, 255, 255, 0.18); }
    .w11-rbtn.primary { background: #2563eb; border-color: #3b82f6; }
    .w11-rinput {
      background: #0f1117;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 12px;
    }
    .w11-status-bar {
      height: 24px;
      background: #1a1d26;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  // Fluent App Icons (SVG)
  const ICONS = {
    word: '<svg viewBox="0 0 48 48" width="34" height="34"><rect x="8" y="5" width="32" height="38" rx="4" fill="#185ABD"/><rect x="16" y="5" width="24" height="38" rx="4" fill="#2B7CD3"/><rect x="5" y="13" width="22" height="22" rx="3.5" fill="#103F91"/><text x="16" y="29" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="14">W</text></svg>',
    excel: '<svg viewBox="0 0 48 48" width="34" height="34"><rect x="8" y="5" width="32" height="38" rx="4" fill="#107C41"/><rect x="16" y="5" width="24" height="38" rx="4" fill="#21A366"/><rect x="5" y="13" width="22" height="22" rx="3.5" fill="#0B5A2E"/><text x="16" y="29" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="14">X</text></svg>',
    ppt: '<svg viewBox="0 0 48 48" width="34" height="34"><rect x="8" y="5" width="32" height="38" rx="4" fill="#C43E1C"/><rect x="16" y="5" width="24" height="38" rx="4" fill="#EB6C4D"/><rect x="5" y="13" width="22" height="22" rx="3.5" fill="#A92B11"/><text x="16" y="29" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="14">P</text></svg>',
    explorer: '<svg viewBox="0 0 48 48" width="34" height="34"><path d="M6 13a4 4 0 0 1 4-4h10l4 4h14a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V13z" fill="#F59E0B"/><rect x="6" y="17" width="36" height="22" rx="3" fill="#FBBF24"/><rect x="14" y="27" width="20" height="12" rx="2" fill="#2563EB"/></svg>',
    terminal: '<svg viewBox="0 0 48 48" width="34" height="34"><rect x="5" y="8" width="38" height="32" rx="5" fill="#0F172A" stroke="#475569" stroke-width="2"/><path d="M13 19l7 5-7 5M23 29h11" stroke="#38BDF8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    calc: '<svg viewBox="0 0 48 48" width="34" height="34"><rect x="9" y="5" width="30" height="38" rx="5" fill="#1E293B" stroke="#64748B" stroke-width="1.5"/><rect x="14" y="10" width="20" height="8" rx="2" fill="#38BDF8"/><circle cx="17" cy="24" r="2.2" fill="#cbd5e1"/><circle cx="24" cy="24" r="2.2" fill="#cbd5e1"/><circle cx="31" cy="24" r="2.2" fill="#f59e0b"/><circle cx="17" cy="31" r="2.2" fill="#cbd5e1"/><circle cx="24" cy="31" r="2.2" fill="#cbd5e1"/><circle cx="31" cy="31" r="2.2" fill="#f59e0b"/><rect x="14" y="36" width="20" height="3.5" rx="1.7" fill="#2563EB"/></svg>',
    taskmgr: '<svg viewBox="0 0 48 48" width="34" height="34"><rect x="6" y="8" width="36" height="32" rx="4" fill="#0F172A" stroke="#38BDF8" stroke-width="1.8"/><polyline points="10,27 17,27 21,16 26,33 30,22 38,22" fill="none" stroke="#10B981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // Multi-Window Manager
  let topZ = 200;
  const openWindows = new Map();

  function focusWindow(win) {
    topZ += 1;
    win.style.zIndex = String(topZ);
  }

  function createWindow(appId, title, iconSvg, renderBodyFn, defaultMax) {
    if (openWindows.has(appId)) {
      const existing = openWindows.get(appId);
      existing.style.display = 'flex';
      focusWindow(existing);
      return existing;
    }

    const win = document.createElement('div');
    win.className = 'w11-app-win' + (defaultMax ? ' maximized' : '');
    win.dataset.appId = appId;
    const offset = (openWindows.size % 5) * 18;
    win.style.top = (44 + offset) + 'px';
    win.style.left = (16 + offset) + 'px';
    focusWindow(win);

    win.innerHTML = `
      <div class="w11-win-bar">
        <div class="w11-win-title">${iconSvg}<span>${escHtml(title)}</span></div>
        <div class="w11-win-ctrls">
          <button type="button" data-act="max" title="Maximize/Restore">&#9744;</button>
          <button type="button" class="cls" data-act="close" title="Close">&times;</button>
        </div>
      </div>
      <div class="w11-win-body"></div>
    `;

    win.addEventListener('mousedown', () => focusWindow(win));
    win.addEventListener('touchstart', () => focusWindow(win), { passive: true });

    const bar = win.querySelector('.w11-win-bar');
    bar.querySelector('[data-act="max"]').addEventListener('click', () => {
      win.classList.toggle('maximized');
    });
    bar.querySelector('[data-act="close"]').addEventListener('click', () => {
      win.remove();
      openWindows.delete(appId);
    });

    // Drag support
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || win.classList.contains('maximized')) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      ox = win.offsetLeft;
      oy = win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      win.style.left = Math.max(0, Math.min(window.innerWidth - 120, ox + (e.clientX - sx))) + 'px';
      win.style.top = Math.max(0, Math.min(window.innerHeight - 60, oy + (e.clientY - sy))) + 'px';
    });
    bar.addEventListener('pointerup', () => { dragging = false; });

    const body = win.querySelector('.w11-win-body');
    renderBodyFn(body, win);
    document.body.appendChild(win);
    openWindows.set(appId, win);
    return win;
  }

  // 1. MICROSOFT WORD
  function openWord(docIdToLoad) {
    createWindow('word', 'Microsoft Word', ICONS.word, (body) => {
      let docs = readStore(KEYS.WORD_DOCS, []);
      let current = docs.find((d) => d.id === docIdToLoad) || docs[0] || {
        id: 'doc-' + Date.now(),
        title: 'Document1.docx',
        updated: new Date().toLocaleDateString(),
        html: '<p>Start typing your document...</p>'
      };

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#16386e;">
          <select class="w11-rinput" id="wd-doc-select" style="max-width:150px;"></select>
          <button type="button" class="w11-rbtn" id="wd-new">+ New</button>
          <button type="button" class="w11-rbtn" data-cmd="bold"><b>B</b></button>
          <button type="button" class="w11-rbtn" data-cmd="italic"><i>I</i></button>
          <button type="button" class="w11-rbtn" data-cmd="underline"><u>U</u></button>
          <button type="button" class="w11-rbtn" data-block="H1">H1</button>
          <button type="button" class="w11-rbtn" data-block="H2">H2</button>
          <button type="button" class="w11-rbtn" data-block="P">Body</button>
          <button type="button" class="w11-rbtn" data-cmd="insertUnorderedList">&bull; List</button>
          <button type="button" class="w11-rbtn" data-cmd="justifyLeft">Left</button>
          <button type="button" class="w11-rbtn" data-cmd="justifyCenter">Center</button>
          <button type="button" class="w11-rbtn primary" id="wd-export">Save .doc</button>
        </div>
        <div style="flex:1;overflow-y:auto;background:#262934;padding:14px;display:flex;justify-content:center;">
          <div id="wd-page" contenteditable="true" style="width:100%;max-width:680px;min-height:100%;background:#ffffff;color:#0f172a;padding:24px 22px;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,0.45);outline:none;font:15px/1.6 'Segoe UI',system-ui,sans-serif;"></div>
        </div>
        <div class="w11-status-bar">
          <span id="wd-status">Saved locally</span>
          <span id="wd-counts">0 words</span>
        </div>
      `;

      const sel = body.querySelector('#wd-doc-select');
      const page = body.querySelector('#wd-page');
      const counts = body.querySelector('#wd-counts');
      const status = body.querySelector('#wd-status');

      function refreshSelect() {
        docs = readStore(KEYS.WORD_DOCS, []);
        if (!docs.length) {
          docs = [current];
          writeStore(KEYS.WORD_DOCS, docs);
        }
        sel.innerHTML = docs.map((d) => `<option value="${escHtml(d.id)}" ${d.id === current.id ? 'selected' : ''}>${escHtml(d.title)}</option>`).join('');
      }

      function updateStats() {
        const txt = (page.innerText || '').trim();
        const words = txt ? txt.split(/\s+/).length : 0;
        counts.textContent = `${words} words • ${txt.length} chars`;
      }

      function persist() {
        current.html = page.innerHTML;
        current.updated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const idx = docs.findIndex((d) => d.id === current.id);
        if (idx >= 0) docs[idx] = current;
        else docs.unshift(current);
        writeStore(KEYS.WORD_DOCS, docs);
        status.textContent = `Auto-saved at ${current.updated}`;
        updateStats();
      }

      refreshSelect();
      page.innerHTML = current.html;
      updateStats();

      page.addEventListener('input', persist);
      sel.addEventListener('change', () => {
        const found = docs.find((d) => d.id === sel.value);
        if (found) {
          current = found;
          page.innerHTML = current.html;
          updateStats();
        }
      });

      body.querySelector('#wd-new').addEventListener('click', () => {
        const name = prompt('Document name:', `Document_${docs.length + 1}.docx`);
        if (!name) return;
        current = { id: 'doc-' + Date.now(), title: name.trim(), updated: 'Just now', html: `<h1>${escHtml(name.trim())}</h1><p></p>` };
        docs.unshift(current);
        writeStore(KEYS.WORD_DOCS, docs);
        refreshSelect();
        page.innerHTML = current.html;
        updateStats();
      });

      body.querySelectorAll('[data-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => {
          page.focus();
          document.execCommand(btn.dataset.cmd, false, null);
          persist();
        });
      });

      body.querySelectorAll('[data-block]').forEach((btn) => {
        btn.addEventListener('click', () => {
          page.focus();
          document.execCommand('formatBlock', false, btn.dataset.block);
          persist();
        });
      });

      body.querySelector('#wd-export').addEventListener('click', () => {
        const docHtml = `<html><head><meta charset="utf-8"><title>${escHtml(current.title)}</title></head><body>${page.innerHTML}</body></html>`;
        const outName = current.title.replace(/\.docx?$/i, '') + '.doc';
        downloadFile(outName, docHtml, 'application/msword');
        status.textContent = `Exported ${outName}`;
      });
    }, true);
  }

  // 2. MICROSOFT EXCEL
  function openExcel() {
    createWindow('excel', 'Microsoft Excel', ICONS.excel, (body) => {
      const ROWS = 24, COLS = 8;
      const COL_NAMES = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));
      let sheet = readStore(KEYS.EXCEL_SHEETS, { name: 'Sheet1.xlsx', cells: {} });
      let activeCell = 'A1';

      function colToIdx(col) { return col.charCodeAt(0) - 65; }

      function evalCell(ref, visited = new Set()) {
        if (visited.has(ref)) return '#REF!';
        visited.add(ref);
        const raw = (sheet.cells[ref] ?? '').toString().trim();
        if (!raw.startsWith('=')) {
          const n = Number(raw);
          return raw !== '' && !Number.isNaN(n) ? n : raw;
        }
        let expr = raw.slice(1).toUpperCase();

        // Expand range functions SUM(A1:A5), AVERAGE(A1:A5), MIN, MAX, COUNT
        expr = expr.replace(/\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([A-H]\d+):([A-H]\d+)\)/g, (_, fn, start, end) => {
          const c1 = colToIdx(start[0]), r1 = parseInt(start.slice(1), 10);
          const c2 = colToIdx(end[0]), r2 = parseInt(end.slice(1), 10);
          const vals = [];
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
              const v = Number(evalCell(COL_NAMES[c] + r, new Set(visited)));
              if (!Number.isNaN(v)) vals.push(v);
            }
          }
          if (!vals.length) return '0';
          if (fn === 'SUM') return String(vals.reduce((a, b) => a + b, 0));
          if (fn === 'AVERAGE' || fn === 'AVG') return String(vals.reduce((a, b) => a + b, 0) / vals.length);
          if (fn === 'MIN') return String(Math.min(...vals));
          if (fn === 'MAX') return String(Math.max(...vals));
          if (fn === 'COUNT') return String(vals.length);
          return '0';
        });

        // Replace individual cell references like B2
        expr = expr.replace(/\b([A-H])(\d+)\b/g, (_, col, row) => {
          const v = Number(evalCell(col + row, new Set(visited)));
          return Number.isNaN(v) ? '0' : String(v);
        });

        try {
          if (!/^[0-9+\-*/().\s]+$/.test(expr)) return '#ERR';
          const res = Function('"use strict";return (' + expr + ')')();
          return typeof res === 'number' && Number.isFinite(res) ? Math.round(res * 10000) / 10000 : '#ERR';
        } catch (_) {
          return '#ERR';
        }
      }

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#0f5132;">
          <span id="xl-ref" style="background:#093621;padding:5px 9px;border-radius:6px;font-weight:700;font-size:12px;min-width:38px;text-align:center;">A1</span>
          <span style="font-weight:700;color:#86efac;">fx</span>
          <input type="text" class="w11-rinput" id="xl-fx" style="flex:1;min-width:140px;" placeholder="Enter value or formula (=SUM(D2:D4))">
          <button type="button" class="w11-rbtn" id="xl-clear">Clear</button>
          <button type="button" class="w11-rbtn primary" id="xl-csv">Export .csv</button>
        </div>
        <div style="flex:1;overflow:auto;background:#ffffff;color:#0f172a;">
          <table id="xl-grid" style="border-collapse:collapse;width:100%;font:13px/1.3 system-ui,sans-serif;"></table>
        </div>
        <div class="w11-status-bar">
          <span>Supports =SUM(A1:A5), =AVERAGE(...), =MIN, =MAX, =A2*B2</span>
          <span id="xl-sum-bar">Ready</span>
        </div>
      `;

      const grid = body.querySelector('#xl-grid');
      const fx = body.querySelector('#xl-fx');
      const refBadge = body.querySelector('#xl-ref');
      const sumBar = body.querySelector('#xl-sum-bar');

      function renderGrid() {
        let html = '<thead><tr><th style="background:#e2e8f0;border:1px solid #cbd5e1;width:36px;padding:5px;"></th>';
        for (const c of COL_NAMES) {
          html += `<th style="background:#e2e8f0;border:1px solid #cbd5e1;padding:5px 8px;min-width:86px;font-weight:700;color:#334155;">${c}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let r = 1; r <= ROWS; r++) {
          html += `<tr><td style="background:#f1f5f9;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#475569;padding:4px;">${r}</td>`;
          for (const c of COL_NAMES) {
            const ref = c + r;
            const val = evalCell(ref);
            const isSel = ref === activeCell;
            const isNum = typeof val === 'number';
            html += `<td data-ref="${ref}" style="border:${isSel ? '2px solid #107C41' : '1px solid #cbd5e1'};background:${isSel ? '#ecfdf5' : '#fff'};padding:5px 7px;text-align:${isNum ? 'right' : 'left'};white-space:nowrap;cursor:cell;">${escHtml(val)}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody>';
        grid.innerHTML = html;

        grid.querySelectorAll('td[data-ref]').forEach((td) => {
          td.addEventListener('click', () => {
            activeCell = td.dataset.ref;
            refBadge.textContent = activeCell;
            fx.value = sheet.cells[activeCell] ?? '';
            const evaluated = evalCell(activeCell);
            sumBar.textContent = `${activeCell}: ${evaluated}`;
            renderGrid();
            fx.focus();
          });
        });
      }

      fx.value = sheet.cells[activeCell] ?? '';
      fx.addEventListener('input', () => {
        if (fx.value === '') delete sheet.cells[activeCell];
        else sheet.cells[activeCell] = fx.value;
        writeStore(KEYS.EXCEL_SHEETS, sheet);
        renderGrid();
      });

      body.querySelector('#xl-clear').addEventListener('click', () => {
        if (!confirm('Clear all cells in spreadsheet?')) return;
        sheet.cells = {};
        writeStore(KEYS.EXCEL_SHEETS, sheet);
        fx.value = '';
        renderGrid();
      });

      body.querySelector('#xl-csv').addEventListener('click', () => {
        const lines = [];
        for (let r = 1; r <= ROWS; r++) {
          const rowVals = COL_NAMES.map((c) => {
            const v = String(evalCell(c + r)).replace(/"/g, '""');
            return `"${v}"`;
          });
          lines.push(rowVals.join(','));
        }
        downloadFile('AuroraOS_Sheet.csv', lines.join('\n'), 'text/csv');
        sumBar.textContent = 'Exported AuroraOS_Sheet.csv';
      });

      renderGrid();
    }, true);
  }

  // 3. MICROSOFT POWERPOINT
  function openPowerPoint() {
    createWindow('ppt', 'Microsoft PowerPoint', ICONS.ppt, (body) => {
      let deck = readStore(KEYS.PPT_DECKS, { name: 'Deck.pptx', theme: 'aurora', slides: [{ title: 'New Slide', subtitle: '', body: '', notes: '' }] });
      let idx = 0;

      const THEMES = {
        aurora: 'linear-gradient(135deg, #040b1a 0%, #0b254b 55%, #065f46 100%)',
        fluent: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
        crimson: 'linear-gradient(135deg, #1f1016 0%, #7f1d1d 100%)',
        light: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      };

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#7c2d12;">
          <button type="button" class="w11-rbtn" id="pp-add">+ Slide</button>
          <button type="button" class="w11-rbtn" id="pp-del">Delete</button>
          <select class="w11-rinput" id="pp-theme">
            <option value="aurora">Theme: Aurora</option>
            <option value="fluent">Theme: Fluent Blue</option>
            <option value="crimson">Theme: Executive Red</option>
            <option value="light">Theme: Clean Light</option>
          </select>
          <button type="button" class="w11-rbtn primary" id="pp-present">&#9654; Slideshow</button>
        </div>
        <div style="flex:1;display:flex;overflow:hidden;">
          <div id="pp-thumbs" style="width:110px;background:#181a22;border-right:1px solid rgba(255,255,255,0.1);overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;"></div>
          <div style="flex:1;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:#111318;">
            <div id="pp-stage" style="border-radius:10px;padding:22px;min-height:240px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 12px 32px rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.16);">
              <input id="pp-title" style="background:transparent;border:1px dashed rgba(255,255,255,0.28);border-radius:6px;padding:6px 8px;font:700 22px system-ui,sans-serif;color:inherit;margin-bottom:8px;" placeholder="Slide Title">
              <input id="pp-sub" style="background:transparent;border:1px dashed rgba(255,255,255,0.22);border-radius:6px;padding:5px 8px;font:500 13px system-ui,sans-serif;color:inherit;opacity:0.88;margin-bottom:12px;" placeholder="Subtitle">
              <textarea id="pp-body" rows="5" style="background:transparent;border:1px dashed rgba(255,255,255,0.22);border-radius:6px;padding:8px;font:14px/1.55 system-ui,sans-serif;color:inherit;resize:vertical;" placeholder="Slide bullet points..."></textarea>
            </div>
          </div>
        </div>
        <div class="w11-status-bar">
          <span id="pp-count">Slide 1 of 1</span>
          <span>Auto-saved offline</span>
        </div>
      `;

      const thumbs = body.querySelector('#pp-thumbs');
      const stage = body.querySelector('#pp-stage');
      const tIn = body.querySelector('#pp-title');
      const sIn = body.querySelector('#pp-sub');
      const bIn = body.querySelector('#pp-body');
      const themeSel = body.querySelector('#pp-theme');
      const countEl = body.querySelector('#pp-count');

      themeSel.value = deck.theme || 'aurora';

      function render() {
        if (idx >= deck.slides.length) idx = Math.max(0, deck.slides.length - 1);
        const s = deck.slides[idx];
        const th = deck.theme || 'aurora';
        stage.style.background = THEMES[th] || THEMES.aurora;
        stage.style.color = th === 'light' ? '#0f172a' : '#f8fafc';
        tIn.value = s.title || '';
        sIn.value = s.subtitle || '';
        bIn.value = s.body || '';
        countEl.textContent = `Slide ${idx + 1} of ${deck.slides.length}`;

        thumbs.innerHTML = deck.slides.map((sl, i) => `
          <div data-i="${i}" style="padding:8px;border-radius:6px;border:2px solid ${i === idx ? '#fb923c' : 'rgba(255,255,255,0.14)'};background:${i === idx ? 'rgba(234,88,12,0.2)' : 'rgba(255,255,255,0.05)'};cursor:pointer;font-size:11px;">
            <div style="font-weight:700;margin-bottom:2px;">${i + 1}. ${escHtml((sl.title || 'Untitled').slice(0, 14))}</div>
          </div>
        `).join('');

        thumbs.querySelectorAll('[data-i]').forEach((el) => {
          el.addEventListener('click', () => {
            idx = Number(el.dataset.i);
            render();
          });
        });
      }

      function save() {
        deck.slides[idx].title = tIn.value;
        deck.slides[idx].subtitle = sIn.value;
        deck.slides[idx].body = bIn.value;
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      }

      [tIn, sIn, bIn].forEach((inp) => inp.addEventListener('change', save));
      themeSel.addEventListener('change', () => {
        deck.theme = themeSel.value;
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      });

      body.querySelector('#pp-add').addEventListener('click', () => {
        deck.slides.push({ title: `Slide ${deck.slides.length + 1}`, subtitle: 'Section subtitle', body: '• Point one\n• Point two', notes: '' });
        idx = deck.slides.length - 1;
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      });

      body.querySelector('#pp-del').addEventListener('click', () => {
        if (deck.slides.length <= 1) return;
        deck.slides.splice(idx, 1);
        idx = Math.max(0, idx - 1);
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      });

      body.querySelector('#pp-present').addEventListener('click', () => {
        let pIdx = idx;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;display:flex;flex-direction:column;justify-content:center;padding:28px;cursor:pointer;';
        function paintShow() {
          const sl = deck.slides[pIdx];
          const th = deck.theme || 'aurora';
          overlay.style.background = THEMES[th] || THEMES.aurora;
          overlay.style.color = th === 'light' ? '#0f172a' : '#f8fafc';
          overlay.innerHTML = `
            <div style="max-width:860px;margin:0 auto;width:100%;">
              <div style="font-size:clamp(26px,5vw,44px);font-weight:800;margin-bottom:10px;">${escHtml(sl.title)}</div>
              <div style="font-size:clamp(15px,2.5vw,22px);opacity:0.85;margin-bottom:24px;">${escHtml(sl.subtitle)}</div>
              <pre style="white-space:pre-wrap;font:clamp(16px,2.5vw,22px)/1.6 system-ui,sans-serif;margin:0;">${escHtml(sl.body)}</pre>
            </div>
            <div style="position:fixed;bottom:16px;right:20px;font-size:12px;opacity:0.75;">Slide ${pIdx + 1}/${deck.slides.length} • Tap to advance • Double-tap to exit</div>
          `;
        }
        overlay.addEventListener('click', () => {
          if (pIdx + 1 < deck.slides.length) { pIdx += 1; paintShow(); }
          else overlay.remove();
        });
        overlay.addEventListener('dblclick', () => overlay.remove());
        paintShow();
        document.body.appendChild(overlay);
      });

      render();
    }, true);
  }

  // 4. FILE EXPLORER
  function openExplorer() {
    createWindow('explorer', 'File Explorer', ICONS.explorer, (body) => {
      const docs = readStore(KEYS.WORD_DOCS, []);
      const sheet = readStore(KEYS.EXCEL_SHEETS, { name: 'Budget_Tracker.xlsx' });
      const deck = readStore(KEYS.PPT_DECKS, { name: 'AuroraOS_Overview.pptx' });

      const items = [
        ...docs.map((d) => ({ name: d.title, kind: 'Word Document', icon: ICONS.word, open: () => openWord(d.id) })),
        { name: sheet.name || 'Budget_Tracker.xlsx', kind: 'Excel Workbook', icon: ICONS.excel, open: openExcel },
        { name: deck.name || 'AuroraOS_Overview.pptx', kind: 'PowerPoint Presentation', icon: ICONS.ppt, open: openPowerPoint }
      ];

      body.innerHTML = `
        <div class="w11-ribbon">
          <span style="font-size:12px;color:#cbd5e1;">C:\\Users\\Jeramy\\Documents</span>
        </div>
        <div style="flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;align-content:start;">
          ${items.map((it, i) => `
            <div data-fidx="${i}" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px 10px;text-align:center;cursor:pointer;">
              ${it.icon}
              <div style="font-size:12px;font-weight:600;margin-top:6px;word-break:break-word;">${escHtml(it.name)}</div>
              <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${escHtml(it.kind)}</div>
            </div>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-fidx]').forEach((el) => {
        el.addEventListener('click', () => items[Number(el.dataset.fidx)].open());
      });
    }, false);
  }

  // 5. WINDOWS TERMINAL / POWERSHELL
  function openTerminal() {
    createWindow('terminal', 'Windows Terminal (PowerShell)', ICONS.terminal, (body) => {
      body.innerHTML = `
        <div id="tm-out" style="flex:1;overflow-y:auto;padding:12px;font:13px/1.5 monospace;color:#e2e8f0;white-space:pre-wrap;">AuroraOS PowerShell [Version 8.5.2026]
(c) Jeramy Adams. All rights reserved.
Type 'help' for available commands.

</div>
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#090d16;border-top:1px solid rgba(255,255,255,0.12);">
          <span style="color:#38bdf8;font:700 13px monospace;">PS C:\\AuroraOS&gt;</span>
          <input id="tm-in" type="text" autocomplete="off" style="flex:1;background:transparent;border:0;outline:none;color:#f8fafc;font:13px monospace;" placeholder="help">
        </div>
      `;
      const out = body.querySelector('#tm-out');
      const inp = body.querySelector('#tm-in');

      function print(line) {
        out.textContent += line + '\n';
        out.scrollTop = out.scrollHeight;
      }

      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const raw = inp.value.trim();
        inp.value = '';
        print(`PS C:\\AuroraOS> ${raw}`);
        const [cmd, ...rest] = raw.split(/\s+/);
        const arg = rest.join(' ');
        switch ((cmd || '').toLowerCase()) {
          case '': break;
          case 'help':
            print('Commands: help, ver, systeminfo, ls, word, excel, ppt, calc, wallpaper, clear');
            break;
          case 'ver':
            print('AuroraOS v8.5 (Win11 Android Capacitor Build)');
            break;
          case 'systeminfo':
            print('Host Name:   MOTO-G-5G\nOS Name:     AuroraOS v8.5\nDeveloper:   Jeramy Adams\nStorage:     Offline LocalStorage Enabled');
            break;
          case 'ls':
          case 'dir':
            print('Documents/\n  AuroraOS Project Notes.docx\n  Budget_Tracker.xlsx\n  AuroraOS_Overview.pptx');
            break;
          case 'word': openWord(); print('Launching Microsoft Word...'); break;
          case 'excel': openExcel(); print('Launching Microsoft Excel...'); break;
          case 'ppt': case 'powerpoint': openPowerPoint(); print('Launching Microsoft PowerPoint...'); break;
          case 'calc': openCalculator(); print('Launching Calculator...'); break;
          case 'wallpaper':
            document.querySelector('[data-win-action="personalize"]')?.click();
            print('Opening Wallpaper Personalizer...');
            break;
          case 'echo': print(arg); break;
          case 'clear': case 'cls': out.textContent = ''; break;
          default: print(`Command not recognized: ${cmd}. Type 'help'.`);
        }
      });
      setTimeout(() => inp.focus(), 50);
    }, false);
  }

  // 6. CALCULATOR
  function openCalculator() {
    createWindow('calc', 'Calculator', ICONS.calc, (body) => {
      let expr = '';
      body.innerHTML = `
        <div style="padding:14px;background:#0f172a;text-align:right;border-bottom:1px solid rgba(255,255,255,0.1);">
          <div id="cl-disp" style="font:700 28px/1.2 monospace;color:#f8fafc;overflow-x:auto;">0</div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;background:#111318;">
          ${['C','(',')','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','DEL','='].map((k) => `
            <button type="button" data-k="${k}" style="border:0;border-radius:8px;font:600 17px system-ui,sans-serif;cursor:pointer;background:${k === '=' ? '#2563eb' : 'rgba(255,255,255,0.09)'};color:#fff;">${k}</button>
          `).join('')}
        </div>
      `;
      const disp = body.querySelector('#cl-disp');
      body.querySelectorAll('[data-k]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const k = btn.dataset.k;
          if (k === 'C') expr = '';
          else if (k === 'DEL') expr = expr.slice(0, -1);
          else if (k === '=') {
            try {
              if (/^[0-9+\-*/().]+$/.test(expr)) {
                expr = String(Function('"use strict";return (' + expr + ')')());
              }
            } catch (_) { expr = 'Error'; }
          } else {
            if (expr === 'Error') expr = '';
            expr += k;
          }
          disp.textContent = expr || '0';
        });
      });
    }, false);
  }

  // 7. TASK MANAGER
  function openTaskManager() {
    createWindow('taskmgr', 'Task Manager', ICONS.taskmgr, (body) => {
      const rows = Array.from(openWindows.entries());
      let usedBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        usedBytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
      body.innerHTML = `
        <div style="padding:12px;overflow-y:auto;flex:1;">
          <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.06);border-radius:8px;font-size:12px;">
            <b>Offline Storage Used:</b> ${(usedBytes / 1024).toFixed(1)} KB &bull; <b>Active Windows:</b> ${rows.length}
          </div>
          ${rows.map(([id, win]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;">
              <span>${escHtml(win.querySelector('.w11-win-title span').textContent)}</span>
              <button type="button" data-kill="${escHtml(id)}" class="w11-rbtn" style="background:#b91c1c;">End Task</button>
            </div>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-kill]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const w = openWindows.get(btn.dataset.kill);
          if (w) { w.remove(); openWindows.delete(btn.dataset.kill); }
          openTaskManager();
        });
      });
    }, false);
  }

  // Desktop Shortcut Grid (Positioned cleanly below the Personalize icon)
  const deskGrid = document.createElement('div');
  deskGrid.id = 'w11-icon-column';
  const DESK_APPS = [
    { id: 'word', label: 'Word', icon: ICONS.word, fn: () => openWord() },
    { id: 'excel', label: 'Excel', icon: ICONS.excel, fn: openExcel },
    { id: 'ppt', label: 'PowerPoint', icon: ICONS.ppt, fn: openPowerPoint },
    { id: 'explorer', label: 'Explorer', icon: ICONS.explorer, fn: openExplorer },
    { id: 'terminal', label: 'Terminal', icon: ICONS.terminal, fn: openTerminal },
    { id: 'calc', label: 'Calculator', icon: ICONS.calc, fn: openCalculator }
  ];
  deskGrid.innerHTML = DESK_APPS.map((a) => `
    <div class="w11-desk-app" data-launch="${a.id}" role="button" tabindex="0">
      ${a.icon}
      <span>${a.label}</span>
    </div>
  `).join('');
  document.body.appendChild(deskGrid);

  deskGrid.querySelectorAll('[data-launch]').forEach((el) => {
    el.addEventListener('click', () => {
      const app = DESK_APPS.find((a) => a.id === el.dataset.launch);
      if (app) app.fn();
    });
  });

  // Top-Right Apps & Office Start Drawer
  const fab = document.createElement('button');
  fab.id = 'w11-apps-fab';
  fab.type = 'button';
  fab.innerHTML = '<span>&#8862;</span><span>Office &amp; Apps</span>';
  document.body.appendChild(fab);

  const drawer = document.createElement('div');
  drawer.id = 'w11-start-drawer';
  drawer.innerHTML = `
    <div class="w11-drawer-title">Microsoft Office</div>
    <div class="w11-drawer-grid">
      <button type="button" class="w11-drawer-item" data-app="word">${ICONS.word}<span>Word</span></button>
      <button type="button" class="w11-drawer-item" data-app="excel">${ICONS.excel}<span>Excel</span></button>
      <button type="button" class="w11-drawer-item" data-app="ppt">${ICONS.ppt}<span>PowerPoint</span></button>
    </div>
    <div class="w11-drawer-title">Windows 11 Apps</div>
    <div class="w11-drawer-grid">
      <button type="button" class="w11-drawer-item" data-app="explorer">${ICONS.explorer}<span>Explorer</span></button>
      <button type="button" class="w11-drawer-item" data-app="terminal">${ICONS.terminal}<span>Terminal</span></button>
      <button type="button" class="w11-drawer-item" data-app="calc">${ICONS.calc}<span>Calculator</span></button>
      <button type="button" class="w11-drawer-item" data-app="taskmgr">${ICONS.taskmgr}<span>Task Mgr</span></button>
      <button type="button" class="w11-drawer-item" data-app="wallpaper"><span style="font-size:24px;line-height:34px;">&#128444;</span><span>Personalize</span></button>
    </div>
  `;
  document.body.appendChild(drawer);

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    drawer.style.display = drawer.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#w11-start-drawer, #w11-apps-fab')) {
      drawer.style.display = 'none';
    }
  });

  drawer.querySelectorAll('[data-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      drawer.style.display = 'none';
      const id = btn.dataset.app;
      if (id === 'word') openWord();
      else if (id === 'excel') openExcel();
      else if (id === 'ppt') openPowerPoint();
      else if (id === 'explorer') openExplorer();
      else if (id === 'terminal') openTerminal();
      else if (id === 'calc') openCalculator();
      else if (id === 'taskmgr') openTaskManager();
      else if (id === 'wallpaper') {
        document.querySelector('[data-win-action="personalize"]')?.click();
      }
    });
  });

  // Expose global launcher hooks for Start Menu / external scripts
  window.AuroraOffice = {
    openWord,
    openExcel,
    openPowerPoint,
    openExplorer,
    openTerminal,
    openCalculator,
    openTaskManager
  };
})();
