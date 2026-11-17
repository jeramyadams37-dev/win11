(function () {
  if (window.__auroraOSFuncsV2Loaded) return;
  window.__auroraOSFuncsV2Loaded = true;
  window.__auroraCurrentDesktop = 1;

  const notifs = [];
  window.__auroraAddNotif = function (title, msg) {
    notifs.unshift({ title, msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (notifs.length > 20) notifs.pop();
  };

  // Unlock native Android press-and-hold selection on inputs, logs, and window bodies
  function injectSelectableStyles() {
    if (document.getElementById('aurora-selectable-css')) return;
    const style = document.createElement('style');
    style.id = 'aurora-selectable-css';
    style.textContent = `
      input, textarea, [contenteditable="true"],
      #cx-log, #cx-log *, .win-body, .win-body p, .win-body pre, .win-body code, .win-body span, .win-body div {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
      .win-titlebar, .desktop-icon, #aurora-v2-dock button, #aurora-hold-menu button {
        -webkit-user-select: none !important;
        user-select: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // Reliable dual-layer clipboard write (Android system clipboard + in-app history)
  async function auroraCopyText(text) {
    const clean = (text || '').trim();
    if (!clean) return false;
    localStorage.setItem('aurora_last_clip', clean);
    const clips = JSON.parse(localStorage.getItem('aurora_clip_history') || '[]');
    if (clips[0] !== clean) {
      clips.unshift(clean);
      localStorage.setItem('aurora_clip_history', JSON.stringify(clips.slice(0, 15)));
    }
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clean);
        copied = true;
      }
    } catch (_) {}
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = clean;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { copied = document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    if (window.auroraToast) {
      window.auroraToast('Copied to Clipboard', clean.length > 48 ? clean.slice(0, 48) + '...' : clean);
    }
    return true;
  }

  // Reliable dual-layer clipboard read (Android system clipboard -> in-app fallback)
  async function auroraReadText() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const sysTxt = await navigator.clipboard.readText();
        if (sysTxt) {
          localStorage.setItem('aurora_last_clip', sysTxt);
          return sysTxt;
        }
      }
    } catch (_) {}
    const last = localStorage.getItem('aurora_last_clip');
    if (last) return last;
    const clips = JSON.parse(localStorage.getItem('aurora_clip_history') || '[]');
    return clips[0] || '';
  }

  function insertIntoEditable(el, text) {
    if (!el || !text) return;
    el.focus();
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
      const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
      const val = el.value || '';
      el.value = val.slice(0, start) + text + val.slice(end);
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable) {
      document.execCommand('insertText', false, text);
    }
  }

  function closeHoldMenu() {
    const m = document.getElementById('aurora-hold-menu');
    if (m) m.remove();
  }

  function showHoldMenu(x, y, target) {
    closeHoldMenu();
    const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const selObj = window.getSelection();
    const highlighted = selObj ? selObj.toString().trim() : '';

    let blockText = '';
    let textEl = null;
    if (!isEditable && target) {
      textEl = target.closest('pre, code, p, span, li, div');
      if (textEl && (textEl.id === 'desktop' || textEl === document.body || (textEl.innerText || '').length > 4000)) {
        textEl = target;
      }
      blockText = (textEl && textEl.innerText ? textEl.innerText : '').trim();
    }

    const menu = document.createElement('div');
    menu.id = 'aurora-hold-menu';
    const left = Math.max(10, Math.min(window.innerWidth - 260, x - 110));
    const top = Math.max(12, Math.min(window.innerHeight - 64, y - 54));
    menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:2147483647;display:flex;align-items:center;gap:4px;padding:5px 7px;background:rgba(15,18,28,0.97);color:#f8fafc;border:1px solid rgba(255,255,255,0.26);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,0.7);backdrop-filter:blur(14px);font-size:12px;`;

    const addBtn = (label, bg, handler) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `border:none;border-radius:8px;padding:6px 10px;background:${bg};color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;`;
      b.onpointerdown = (ev) => { ev.stopPropagation(); };
      b.onclick = async (ev) => {
        ev.stopPropagation();
        await handler();
        closeHoldMenu();
      };
      menu.appendChild(b);
    };

    if (isEditable) {
      addBtn('📋 Paste', 'var(--win-accent,#3b82f6)', async () => {
        const txt = await auroraReadText();
        if (txt) {
          insertIntoEditable(target, txt);
          if (window.auroraToast) window.auroraToast('Pasted', txt.length > 40 ? txt.slice(0, 40) + '...' : txt);
        } else if (window.auroraToast) {
          window.auroraToast('Clipboard Empty', 'Copy text first or pin a snippet in Clipboard Center.');
        }
      });
      addBtn('📄 Copy', 'rgba(255,255,255,0.14)', async () => {
        const s = typeof target.selectionStart === 'number' ? target.value.slice(target.selectionStart, target.selectionEnd) : '';
        await auroraCopyText(s || target.value || target.innerText || '');
      });
      addBtn('🔤 All', 'rgba(255,255,255,0.14)', async () => {
        target.focus();
        if (target.select) target.select();
      });
    } else {
      const copyPayload = highlighted || blockText;
      if (copyPayload) {
        addBtn(highlighted ? '📄 Copy Selection' : '📄 Copy', 'var(--win-accent,#3b82f6)', async () => {
          await auroraCopyText(copyPayload);
        });
      }
      if (textEl && blockText) {
        addBtn('🔤 Select', 'rgba(255,255,255,0.14)', async () => {
          try {
            const range = document.createRange();
            range.selectNodeContents(textEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (_) {}
        });
      }
      addBtn('📋 Paste', 'rgba(255,255,255,0.14)', async () => {
        const txt = await auroraReadText();
        const activeInp = document.querySelector('#cx-prompt, textarea:focus, input:focus');
        if (txt && activeInp) {
          insertIntoEditable(activeInp, txt);
        } else if (txt) {
          await auroraCopyText(txt);
        }
      });
    }

    addBtn('✕', 'rgba(239,68,68,0.75)', async () => {});
    document.body.appendChild(menu);
  }

  // 450ms Touch-and-Hold detector (cancels cleanly if user scrolls or drags)
  let holdTimer = null;
  let startX = 0, startY = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.target.closest('#aurora-hold-menu')) return;
    closeHoldMenu();
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    const target = e.target;
    if (target.closest('.win-titlebar, #aurora-v2-dock')) return;

    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (navigator.vibrate) try { navigator.vibrate(25); } catch (_) {}
      showHoldMenu(startX, startY, target);
    }, 450);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', (e) => {
    if (!holdTimer || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - startX, t.clientY - startY) > 12) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchend', () => {
    clearTimeout(holdTimer);
    holdTimer = null;
  }, { passive: true, capture: true });

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.win-titlebar, #aurora-v2-dock')) return;
    e.preventDefault();
    showHoldMenu(e.clientX || 120, e.clientY || 180, e.target);
  }, { capture: true });

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
    tray.style.cssText = 'position:fixed;bottom:106px;right:12px;width:300px;max-height:360px;overflow-y:auto;background:rgba(18,20,30,0.97);color:#f8fafc;border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:12px;z-index:2147483645;box-shadow:0 16px 40px rgba(0,0,0,0.65);backdrop-filter:blur(16px);font-size:12px;';
    tray.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:8px;">
        <span>📋 Clipboard & Action Center</span>
        <button id="qt-save-clip" style="padding:3px 8px;border-radius:6px;border:none;background:var(--win-accent,#3b82f6);color:#fff;font-size:11px;cursor:pointer;">+ Pin Clip</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
        ${clips.length ? clips.map((c, i) => `<div data-idx="${i}" style="padding:6px;background:rgba(255,255,255,0.08);border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c}</div>`).join('') : '<div style="opacity:0.65;">No saved clips yet. Hold any text to Copy.</div>'}
      </div>
      <div style="font-weight:700;margin-bottom:6px;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;">🔔 Notifications</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${notifs.length ? notifs.map(n => `<div style="padding:5px;background:rgba(255,255,255,0.06);border-radius:6px;"><strong>${n.title}</strong> (${n.time})<br><span style="opacity:0.8;">${n.msg}</span></div>`).join('') : '<div style="opacity:0.65;">All caught up.</div>'}
      </div>
    `;
    document.body.appendChild(tray);
    tray.querySelector('#qt-save-clip').onclick = async () => {
      let txt = await auroraReadText();
      if (!txt) txt = prompt('Enter text to save to Clipboard History:') || '';
      if (txt) {
        await auroraCopyText(txt);
        tray.remove();
        window.toggleAuroraQuickTray();
      }
    };
    tray.querySelectorAll('[data-idx]').forEach(el => {
      el.onclick = async () => {
        await auroraCopyText(clips[Number(el.dataset.idx)]);
      };
    });
  };

  function mountOSControls() {
    injectSelectableStyles();
    const dock = document.getElementById('aurora-v2-dock');
    if (dock) {
      dock.style.borderRadius = '16px';
      if (!document.getElementById('aurora-vdesk-btn')) {
        const dBtn = document.createElement('button');
        dBtn.id = 'aurora-vdesk-btn';
        dBtn.className = 'aurora-vdesk-label';
        dBtn.textContent = '🖥️ D' + window.__auroraCurrentDesktop;
        dBtn.style.cssText = 'border:1px solid rgba(255,255,255,0.22);background:rgba(59,130,246,0.28);color:#fff;border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;';
        dBtn.onclick = () => window.switchVirtualDesktop(window.__auroraCurrentDesktop === 1 ? 2 : 1);

        const tBtn = document.createElement('button');
        tBtn.id = 'aurora-tray-btn';
        tBtn.textContent = '📋🔔';
        tBtn.style.cssText = 'border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.12);color:#fff;border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;';
        tBtn.onclick = window.toggleAuroraQuickTray;

        dock.appendChild(dBtn);
        dock.appendChild(tBtn);
      }
    }
  }

  injectSelectableStyles();
  setInterval(mountOSControls, 1200);
})();
