(function () {
  if (window.__auroraMsAuthLoaded) return;
  window.__auroraMsAuthLoaded = true;

  const STORAGE_USER = 'aurora_ms_account';
  const STORAGE_CFG  = 'aurora_ms_oauth_cfg';
  const STORAGE_PKCE = 'aurora_ms_pkce_state';

  function getSavedUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null'); } catch (_) { return null; }
  }
  function getOAuthCfg() {
    try {
      return Object.assign({
        clientId: '',
        tenant: 'common',
        redirectUri: window.location.origin + '/'
      }, JSON.parse(localStorage.getItem(STORAGE_CFG) || '{}'));
    } catch (_) {
      return { clientId: '', tenant: 'common', redirectUri: window.location.origin + '/' };
    }
  }

  // PKCE Helpers (Web Crypto SHA-256)
  function base64UrlEncode(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function generatePkcePair() {
    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    const verifier = base64UrlEncode(rand);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: base64UrlEncode(digest) };
  }

  // Handle OAuth 2.0 Authorization Code return (?code=...&state=...)
  async function handleOAuthRedirectIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const err = params.get('error_description') || params.get('error');

    if (err) {
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.setItem('aurora_ms_auth_err', decodeURIComponent(err));
      return;
    }
    if (!code) return;

    let pkce = null;
    try { pkce = JSON.parse(sessionStorage.getItem(STORAGE_PKCE) || 'null'); } catch (_) {}
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!pkce || (state && pkce.state !== state)) return;

    const cfg = getOAuthCfg();
    try {
      const body = new URLSearchParams({
        client_id: cfg.clientId,
        scope: 'openid profile email User.Read',
        code,
        redirect_uri: cfg.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: pkce.verifier
      });
      const tokRes = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant || 'common')}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      const tok = await tokRes.json();
      if (!tok.access_token) throw new Error(tok.error_description || 'Token exchange failed');

      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: 'Bearer ' + tok.access_token }
      });
      const me = await meRes.json();
      const userObj = {
        mode: 'microsoft-oauth',
        name: me.displayName || 'Microsoft User',
        email: me.mail || me.userPrincipalName || '',
        id: me.id || '',
        accessToken: tok.access_token,
        signedInAt: new Date().toISOString(),
        locked: false
      };
      localStorage.setItem(STORAGE_USER, JSON.stringify(userObj));
      sessionStorage.removeItem(STORAGE_PKCE);
    } catch (e) {
      sessionStorage.setItem('aurora_ms_auth_err', String(e.message || e));
    }
  }

  async function startMicrosoftOAuth(clientIdInput, tenantInput) {
    const cfg = getOAuthCfg();
    const clientId = (clientIdInput || cfg.clientId || '').trim();
    const tenant = (tenantInput || cfg.tenant || 'common').trim() || 'common';
    const redirectUri = window.location.origin + '/';
    if (!clientId) {
      throw new Error('Enter your Microsoft Entra / Azure Application (client) ID first, or use Quick Sign-In below.');
    }
    localStorage.setItem(STORAGE_CFG, JSON.stringify({ clientId, tenant, redirectUri }));

    const { verifier, challenge } = await generatePkcePair();
    const stateArr = new Uint8Array(16);
    crypto.getRandomValues(stateArr);
    const state = base64UrlEncode(stateArr);
    sessionStorage.setItem(STORAGE_PKCE, JSON.stringify({ verifier, state }));

    const authUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', 'openid profile email User.Read');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('prompt', 'select_account');

    window.location.assign(authUrl.toString());
  }

  function renderLockScreen() {
    const existing = document.getElementById('aurora-ms-lockscreen');
    if (existing) existing.remove();

    const saved = getSavedUser();
    const cfg = getOAuthCfg();
    const authErr = sessionStorage.getItem('aurora_ms_auth_err') || '';
    sessionStorage.removeItem('aurora_ms_auth_err');

    const overlay = document.createElement('div');
    overlay.id = 'aurora-ms-lockscreen';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:2147483647;',
      'background:radial-gradient(circle at 20% 20%, rgba(37,99,235,0.45), rgba(15,23,42,0.96) 65%), #090d16;',
      'backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);',
      'color:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'padding:20px;overflow-y:auto;font-family:system-ui,-apple-system,sans-serif;'
    ].join('');

    const initials = saved && saved.name
      ? saved.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
      : 'MS';

    overlay.innerHTML = `
      <div style="text-align:center;margin-bottom:18px;">
        <div id="ms-lock-clock" style="font-size:48px;font-weight:700;letter-spacing:-1px;line-height:1.05;"></div>
        <div id="ms-lock-date" style="font-size:14px;opacity:0.8;margin-top:4px;"></div>
      </div>

      <div style="width:100%;max-width:380px;background:rgba(24,28,44,0.86);border:1px solid rgba(255,255,255,0.18);border-radius:18px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,0.65);display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;">
          <div style="width:64px;height:64px;border-radius:999px;background:linear-gradient(135deg,#2563eb,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;box-shadow:0 8px 20px rgba(37,99,235,0.45);">
            ${initials}
          </div>
          <div style="font-size:17px;font-weight:700;">${saved ? saved.name : 'Windows 11 Sign-In'}</div>
          <div style="font-size:12px;opacity:0.75;">${saved && saved.email ? saved.email : 'Sign in with your Microsoft Account to unlock'}</div>
        </div>

        ${authErr ? `<div style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.45);color:#fecaca;border-radius:10px;padding:8px 10px;font-size:12px;">${authErr}</div>` : ''}

        <button id="ms-oauth-btn" type="button" style="width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.22);background:#0078d4;color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;">
          <span style="display:inline-grid;grid-template-columns:repeat(2,7px);gap:2px;">
            <span style="width:7px;height:7px;background:#f25022;"></span>
            <span style="width:7px;height:7px;background:#7fba00;"></span>
            <span style="width:7px;height:7px;background:#00a4ef;"></span>
            <span style="width:7px;height:7px;background:#ffb900;"></span>
          </span>
          <span>Sign in with Microsoft</span>
        </button>

        <details ${cfg.clientId ? '' : 'open'} style="background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 10px;font-size:12px;">
          <summary style="cursor:pointer;font-weight:600;opacity:0.9;">⚙️ Microsoft OAuth Client ID (Entra / Azure)</summary>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
            <input id="ms-client-id" value="${cfg.clientId}" placeholder="Paste Azure Application (client) ID..." style="padding:7px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.2);background:rgba(15,23,42,0.85);color:#fff;font-size:12px;" />
            <input id="ms-tenant-id" value="${cfg.tenant || 'common'}" placeholder="Tenant (common, consumers, or tenant-id)" style="padding:7px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.2);background:rgba(15,23,42,0.85);color:#fff;font-size:12px;" />
            <div style="font-size:11px;opacity:0.75;word-break:break-all;">Redirect URI for Azure SPA/Mobile: <code>${window.location.origin}/</code></div>
          </div>
        </details>

        <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:10px;display:flex;flex-direction:column;gap:7px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.7;">Quick Microsoft Email / Offline PIN</div>
          <input id="ms-quick-email" type="email" value="${saved && saved.email ? saved.email : ''}" placeholder="name@outlook.com" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.35);color:#fff;font-size:13px;" />
          <input id="ms-quick-pin" type="password" inputmode="numeric" maxlength="8" placeholder="Windows Hello PIN (optional)" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.35);color:#fff;font-size:13px;" />
          <button id="ms-quick-unlock" type="button" style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.12);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
            Unlock Windows 11 →
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const updateClock = () => {
      const clk = document.getElementById('ms-lock-clock');
      const dt = document.getElementById('ms-lock-date');
      if (!clk || !dt) return;
      const now = new Date();
      clk.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dt.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };
    updateClock();
    const clkTimer = setInterval(() => {
      if (!document.getElementById('aurora-ms-lockscreen')) return clearInterval(clkTimer);
      updateClock();
    }, 1000);

    overlay.querySelector('#ms-oauth-btn').onclick = async () => {
      const cid = overlay.querySelector('#ms-client-id').value;
      const tid = overlay.querySelector('#ms-tenant-id').value;
      try {
        await startMicrosoftOAuth(cid, tid);
      } catch (e) {
        alert(e.message || e);
      }
    };

    overlay.querySelector('#ms-quick-unlock').onclick = () => {
      const email = overlay.querySelector('#ms-quick-email').value.trim() || 'jeramy@outlook.com';
      const pin = overlay.querySelector('#ms-quick-pin').value.trim();
      const prev = getSavedUser();
      if (prev && prev.pin && pin !== prev.pin) {
        alert('Incorrect Windows Hello PIN.');
        return;
      }
      const displayName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const profile = {
        mode: 'microsoft-local',
        name: prev && prev.name && prev.email === email ? prev.name : displayName,
        email,
        pin: pin || (prev && prev.pin) || '',
        signedInAt: new Date().toISOString(),
        locked: false
      };
      localStorage.setItem(STORAGE_USER, JSON.stringify(profile));
      overlay.remove();
      if (window.auroraToast) window.auroraToast('Signed In', `Welcome back, ${profile.name} (${profile.email})`);
    };
  }

  window.lockAuroraWindows = function () {
    const u = getSavedUser();
    if (u) {
      u.locked = true;
      localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    }
    renderLockScreen();
  };

  window.signOutMicrosoftAccount = function () {
    localStorage.removeItem(STORAGE_USER);
    renderLockScreen();
  };

  function mountLockButtonOnDock() {
    const dock = document.getElementById('aurora-v2-dock');
    if (!dock || document.getElementById('aurora-lock-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'aurora-lock-btn';
    btn.title = 'Lock Windows / Microsoft Account';
    btn.textContent = '🔒 Lock';
    btn.style.cssText = 'border:1px solid rgba(255,255,255,0.22);background:rgba(239,68,68,0.25);color:#fff;border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;';
    btn.onclick = window.lockAuroraWindows;
    dock.appendChild(btn);
  }

  (async function init() {
    await handleOAuthRedirectIfPresent();
    const u = getSavedUser();
    if (!u || u.locked !== false) {
      renderLockScreen();
    }
    setInterval(mountLockButtonOnDock, 1200);
  })();
})();
