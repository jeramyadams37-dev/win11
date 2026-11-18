#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/win11
mkdir -p backups
TS=$(date +%Y%m%d_%H%M%S)

# 1. Pre-flight safety backups
cp ~/aurora_cortex_bridge.py "backups/aurora_cortex_bridge.py.bak.$TS"
cp ~/win11/deploy_aurora.sh "backups/deploy_aurora.sh.bak.$TS"
echo "[OK] Backups created in ~/win11/backups/ (*_$TS)"

# 2. Update ~/aurora_cortex_bridge.py with live command router & help guide
cat << 'PYEOF' > ~/aurora_cortex_bridge.py
import os, sqlite3, json, subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)
DB_PATH = "/data/data/com.termux/files/home/AuroraOS/aurora.db"
WIN11_DIR = "/data/data/com.termux/files/home/win11"
GEMINI_MODEL = "gemini-2.0-flash"

HELP_GUIDE = """=== AURORAOS CORTEX COMMAND & CAPABILITY GUIDE ===
[System & Guidance]
  commands | help | ?     -> Show this interactive command & feature guide
  status | health         -> Check Flask (:8420), SQLite DB tables & row counts
  modules                 -> List active Win11 modules (EdgeRider, ShopSense, Cortex)

[GitHub & APK Build Pipeline]
  latest gh builds        -> List the 5 most recent GitHub Actions APK builds
  gh status               -> Show active/latest workflow run details
  build apk               -> Trigger remote build-apk.yml workflow on GitHub

[Database & Telemetry]
  db tables               -> List all tables and row counts in aurora.db
  <any keyword>           -> Search across all aurora.db SQLite tables for matches

[Win11 UI Shortcuts]
  F1 or Ctrl+K            -> Toggle the Commands & Guidance window anywhere in Win11
  Taskbar [❓] Button     -> Open the Commands & Guidance window
  Taskbar [💻] Button     -> Open the Cortex AI & CLI Console"""

def inspect_db():
    if not os.path.exists(DB_PATH):
        return None, {}
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    counts = {}
    for t in tables:
        try:
            counts[t] = cur.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        except Exception:
            counts[t] = -1
    conn.close()
    return DB_PATH, counts

def run_cmd(args, cwd=WIN11_DIR):
    try:
        res = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=15)
        out = (res.stdout or "").strip() or (res.stderr or "").strip()
        return out if out else "(No output)"
    except Exception as e:
        return f"Command error: {e}"

@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp

@app.route("/api/status", methods=["GET", "OPTIONS"])
def status():
    if request.method == "OPTIONS":
        return ("", 204)
    path, counts = inspect_db()
    return jsonify({
        "status": "online",
        "db_found": bool(path),
        "db_path": DB_PATH,
        "tables": counts,
        "model": GEMINI_MODEL,
        "commands": ["commands", "help", "?", "latest gh builds", "gh status", "build apk", "status", "db tables", "modules"]
    })

@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(silent=True) or {}
    prompt = (data.get("message") or data.get("prompt") or "").strip()
    q = prompt.lower()

    if q in {"commands", "help", "?", "/help", "/commands", "guide"}:
        return jsonify({"response": HELP_GUIDE})

    if q in {"latest gh builds", "gh builds", "builds"}:
        out = run_cmd(["gh", "run", "list", "--limit", "5"])
        return jsonify({"response": f"Latest GitHub Actions Builds:\n{out}"})

    if q in {"gh status", "run status"}:
        out = run_cmd(["gh", "run", "list", "--workflow=build-apk.yml", "--limit", "3"])
        return jsonify({"response": f"APK Workflow Status:\n{out}"})

    if q in {"build apk", "trigger build"}:
        out = run_cmd(["gh", "workflow", "run", "build-apk.yml", "--ref", "main"])
        return jsonify({"response": f"Triggered APK Build:\n{out}"})

    if q in {"status", "health", "db tables", "db"}:
        path, counts = inspect_db()
        if not path:
            return jsonify({"response": f"Cortex Online (:8420) | SQLite DB not found at {DB_PATH}"})
        lines = [f"  - {k}: {v} rows" for k, v in counts.items()] or ["  (no tables)"]
        return jsonify({"response": f"Cortex Online (:8420)\nDB: {path}\nTables:\n" + "\n".join(lines)})

    if q == "modules":
        return jsonify({"response": "Active Win11 Modules:\n  1. EdgeRider Telemetry (Gig trip & earnings monitor)\n  2. ShopSense OBD-II (Diagnostic trouble code & vehicle lookup)\n  3. Cortex Console (:8420 Flask + SQLite + GitHub CLI bridge)\n  4. Guidance & Command Key (F1 / Ctrl+K)"})

    path, counts = inspect_db()
    db_context = ""
    if path:
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            terms = [w for w in q.split() if len(w) > 2 and w not in {"the", "and", "for", "with"}]
            hits = []
            for t in counts:
                if counts[t] <= 0:
                    continue
                cols = [c[1] for c in cur.execute(f'PRAGMA table_info("{t}")').fetchall()]
                if not cols or not terms:
                    continue
                where = " OR ".join([f'LOWER(CAST("{c}" AS TEXT)) LIKE ?' for c in cols])
                rows = cur.execute(f'SELECT * FROM "{t}" WHERE {where} LIMIT 2', [f"%{terms[0]}%"] * len(cols)).fetchall()
                for r in rows:
                    hits.append(f"[{t}] " + " | ".join(str(x)[:60] for x in r if x is not None))
            conn.close()
            if hits:
                db_context = "\nRelevant DB matches:\n" + "\n".join(hits[:4])
        except Exception:
            pass

    reply = f"Cortex [{GEMINI_MODEL}]: No exact CLI macro for '{prompt}'. Type 'commands' or press F1 for available actions.{db_context}"
    return jsonify({"response": reply.strip()})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8420)
PYEOF

# 3. Restart ~/aurora_cortex_bridge.py cleanly on port 8420
pkill -f "aurora_cortex_bridge.py" 2>/dev/null || true
sleep 1
nohup python3 ~/aurora_cortex_bridge.py > ~/aurora_cortex_bridge.log 2>&1 &
sleep 1
echo "[OK] Restarted ~/aurora_cortex_bridge.py on port 8420"

# 4. Update ~/win11/deploy_aurora.sh with Guidance Key (F1 / Ctrl+K), Taskbar [❓] button, and Cortex Console
cat << 'DEPEOF' > ~/win11/deploy_aurora.sh
#!/data/data/com.termux/files/usr/bin/bash
# AuroraOS v8.6 | Master Deployment Script with Guidance Key (F1), Cortex Console, EdgeRider & ShopSense
FILE="index.html"
PORT=8000

echo "[*] Creating backup directory..."
mkdir -p backups
if [ -f "$FILE" ]; then
    cp "$FILE" "backups/index_$(date +%Y%m%d_%H%M%S).bak.html"
    echo "📦 Backup created in /backups"
fi

echo "[*] Clearing port $PORT..."
fuser -k $PORT/tcp 2>/dev/null || lsof -i :$PORT -t | xargs kill -9 2>/dev/null || true

echo "[*] Generating updated index.html with Guidance Key, Cortex, EdgeRider & ShopSense..."
cat << "WEBOS" > "$FILE"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuroraOS - Windows 11 Web Edition</title>
  <style>
    :root { --accent: #0078d4; --glass-bg: rgba(28, 28, 30, 0.85); --glass-border: rgba(255, 255, 255, 0.12); --text-main: #ffffff; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; height: 100vh; overflow: hidden; font-family: system-ui, sans-serif; background: radial-gradient(circle at top, #182848 0%, #0d1117 100%); color: var(--text-main); }
    #desktop { width: 100%; height: calc(100vh - 48px); position: relative; padding: 16px; display: flex; flex-direction: column; gap: 16px; flex-wrap: wrap; align-content: flex-start; }
    .desk-icon { width: 76px; text-align: center; cursor: pointer; padding: 8px 4px; border-radius: 6px; user-select: none; }
    .desk-icon:hover { background: rgba(255,255,255,0.1); }
    #taskbar { position: fixed; bottom: 0; width: 100%; height: 48px; background: rgba(18, 18, 20, 0.88); backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; z-index: 10000; border-top: 1px solid var(--glass-border); }
    .taskbar-center { display: flex; gap: 6px; position: absolute; left: 50%; transform: translateX(-50%); }
    .tb-btn { height: 38px; min-width: 38px; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 6px; cursor: pointer; font-size: 18px; background: rgba(255,255,255,0.03); border: 1px solid transparent; }
    .tb-btn:hover { background: rgba(255, 255, 255, 0.12); border-color: var(--glass-border); }
    .tb-label { font-size: 12px; font-weight: 500; }
    #start-menu { position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%) translateY(20px); width: min(640px, 94vw); max-height: 75vh; overflow-y: auto; background: var(--glass-bg); backdrop-filter: blur(60px); border: 1px solid var(--glass-border); border-radius: 12px; z-index: 9500; display: none; padding: 24px; box-shadow: 0 24px 64px rgba(0,0,0,0.8); }
    #start-menu.visible { display: block; transform: translateX(-50%) translateY(0); }
    .window { position: absolute; background: var(--glass-bg); backdrop-filter: blur(40px); border: 1px solid var(--glass-border); border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.65); display: flex; flex-direction: column; overflow: hidden; max-width: 96vw; max-height: calc(100vh - 64px); }
    .titlebar { padding: 10px 14px; display: flex; align-items: center; gap: 8px; cursor: move; background: rgba(255,255,255,0.05); border-bottom: 1px solid var(--glass-border); }
    .title-text { flex: 1; font-size: 13px; font-weight: 600; }
    .win-btn { padding: 4px 10px; cursor: pointer; font-size: 14px; border-radius: 4px; }
    .win-btn:hover { background: rgba(255,255,255,0.12); }
    .close-btn:hover { background: #c42b1c; }
    .content { flex: 1; padding: 16px; overflow: auto; }
    .cmd-chip { display: inline-block; padding: 5px 10px; margin: 4px 4px 4px 0; background: rgba(0,120,212,0.25); border: 1px solid rgba(0,120,212,0.6); border-radius: 6px; font-size: 12px; cursor: pointer; font-family: monospace; color: #fff; }
    .cmd-chip:hover { background: #0078d4; }
    pre.term-out { background: rgba(0,0,0,0.55); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
  </style>
</head>
<body>
<div id="desktop">
  <div class="desk-icon" onclick="openApp('guide')"><div style="font-size:32px;">❓</div><div style="font-size:11px; margin-top:4px;">Guide (F1)</div></div>
  <div class="desk-icon" onclick="openApp('cortex')"><div style="font-size:32px;">💻</div><div style="font-size:11px; margin-top:4px;">Cortex CLI</div></div>
  <div class="desk-icon" onclick="openApp('edgerider')"><div style="font-size:32px;">🚗</div><div style="font-size:11px; margin-top:4px;">EdgeRider</div></div>
  <div class="desk-icon" onclick="openApp('shopsense')"><div style="font-size:32px;">🔧</div><div style="font-size:11px; margin-top:4px;">ShopSense</div></div>
</div>

<div id="start-menu">
  <div style="margin-bottom:16px; font-weight: 600; display:flex; justify-content:space-between;">
    <span>AuroraOS Modules</span>
    <span style="font-size:11px; opacity:0.7;">Press F1 or Ctrl+K for Commands</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
    <div onclick="openApp('guide')" style="text-align:center; cursor:pointer;"><div style="font-size:32px;">❓</div><div style="font-size:11px;">Guide (F1)</div></div>
    <div onclick="openApp('cortex')" style="text-align:center; cursor:pointer;"><div style="font-size:32px;">💻</div><div style="font-size:11px;">Cortex CLI</div></div>
    <div onclick="openApp('edgerider')" style="text-align:center; cursor:pointer;"><div style="font-size:32px;">🚗</div><div style="font-size:11px;">EdgeRider</div></div>
    <div onclick="openApp('shopsense')" style="text-align:center; cursor:pointer;"><div style="font-size:32px;">🔧</div><div style="font-size:11px;">ShopSense</div></div>
  </div>
</div>

<div id="taskbar">
  <div class="tb-btn" onclick="openApp('guide')" title="Open Command & Guidance Key (F1)">❓ <span class="tb-label">Commands (F1)</span></div>
  <div class="taskbar-center">
    <div class="tb-btn" onclick="toggleStart()" title="Start Menu">💠</div>
    <div class="tb-btn" onclick="openApp('cortex')" title="Cortex Terminal">💻</div>
    <div class="tb-btn" onclick="openApp('edgerider')" title="EdgeRider">🚗</div>
    <div class="tb-btn" onclick="openApp('shopsense')" title="ShopSense">🔧</div>
  </div>
  <div style="font-size:11px; opacity:0.8;" id="clock"></div>
</div>

<script>
  const APPS = {
    guide: {
      title: "AuroraOS Command & Guidance Key (F1)",
      icon: "❓",
      w: 640,
      h: 480,
      content: () => `
        <div>
          <p style="margin-top:0; font-size:13px; opacity:0.9;">Click any command chip below to run it immediately in Cortex (:8420), or press <b>F1</b> / <b>Ctrl+K</b> anytime to toggle this guide.</p>
          <div style="margin-bottom:10px;">
            <span class="cmd-chip" onclick="runGuideCmd('commands')">commands</span>
            <span class="cmd-chip" onclick="runGuideCmd('latest gh builds')">latest gh builds</span>
            <span class="cmd-chip" onclick="runGuideCmd('gh status')">gh status</span>
            <span class="cmd-chip" onclick="runGuideCmd('build apk')">build apk</span>
            <span class="cmd-chip" onclick="runGuideCmd('status')">status</span>
            <span class="cmd-chip" onclick="runGuideCmd('modules')">modules</span>
          </div>
          <pre id="guide-output" class="term-out">Loading live capability guide from http://127.0.0.1:8420...</pre>
        </div>`
    },
    cortex: {
      title: "Cortex AI & CLI Bridge (:8420)",
      icon: "💻",
      w: 660,
      h: 460,
      content: () => `
        <div style="display:flex; flex-direction:column; height:100%; gap:10px;">
          <div style="display:flex; gap:6px;">
            <input id="cortex-in" type="text" placeholder="Type 'commands', 'latest gh builds', 'status', or search aurora.db..." style="flex:1; padding:8px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.45); color:#fff; font-family:monospace;" onkeydown="if(event.key==='Enter') sendCortex()">
            <button onclick="sendCortex()" style="padding:8px 14px; background:#0078d4; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">Run</button>
          </div>
          <pre id="cortex-log" class="term-out" style="flex:1; margin:0;">Cortex Ready (:8420). Type 'commands' or press F1 for full guidance.</pre>
        </div>`
    },
    edgerider: {
      title: "EdgeRider Telemetry",
      icon: "🚗",
      w: 620,
      h: 420,
      content: () => `<div><h3 style="margin-top:0;">EdgeRider Gig Telemetry</h3><button onclick="fetchEdgeTrips()" style="padding:6px 14px; background:#0078d4; color:white; border:none; border-radius:4px; cursor:pointer;">Fetch Trips</button><pre id="er-output" class="term-out" style="margin-top:10px;">Click fetch to load data.</pre></div>`
    },
    shopsense: {
      title: "ShopSense OBD-II",
      icon: "🔧",
      w: 620,
      h: 420,
      content: () => `<div><h3 style="margin-top:0;">ShopSense DTC Codes</h3><button onclick="fetchShopCodes()" style="padding:6px 14px; background:#0078d4; color:white; border:none; border-radius:4px; cursor:pointer;">Load Codes</button><pre id="ss-output" class="term-out" style="margin-top:10px;">Click load to inspect DTCs.</pre></div>`
    }
  };

  let windows = {}, zIdx = 1000;
  function toggleStart() { document.getElementById('start-menu').classList.toggle('visible'); }

  function openApp(id) {
    document.getElementById('start-menu').classList.remove('visible');
    if (windows[id]) {
      const existing = document.getElementById('win-' + id);
      if (existing) existing.style.zIndex = ++zIdx;
      return;
    }
    const app = APPS[id], win = document.createElement('div');
    win.className = 'window focused'; win.id = 'win-' + id;
    win.style.width = app.w + 'px'; win.style.height = app.h + 'px';
    win.style.left = Math.max(12, (window.innerWidth - app.w) / 2) + 'px';
    win.style.top = '28px'; win.style.zIndex = ++zIdx;
    win.innerHTML = '<div class="titlebar"><span>' + app.icon + '</span><span class="title-text">' + app.title + '</span><div class="win-btn close-btn" onclick="closeApp(\'' + id + '\')">✕</div></div><div class="content">' + app.content() + '</div>';
    document.getElementById('desktop').appendChild(win);
    windows[id] = true;
    if (id === 'guide') runGuideCmd('commands');
  }

  function closeApp(id) {
    const el = document.getElementById('win-' + id);
    if (el) el.remove();
    delete windows[id];
  }

  async function queryCortexAPI(msg) {
    const res = await fetch('http://127.0.0.1:8420/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    return data.response || JSON.stringify(data, null, 2);
  }

  async function runGuideCmd(cmd) {
    const out = document.getElementById('guide-output');
    if (!out) return;
    out.textContent = '> Running: ' + cmd + '...';
    try {
      out.textContent = await queryCortexAPI(cmd);
    } catch (e) {
      out.textContent = 'Bridge offline on http://127.0.0.1:8420.\nStart in Termux with: python3 ~/aurora_cortex_bridge.py &';
    }
  }

  async function sendCortex() {
    const inp = document.getElementById('cortex-in');
    const log = document.getElementById('cortex-log');
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    log.textContent += '\n\nYou: ' + msg + '\nCortex: ...';
    try {
      const reply = await queryCortexAPI(msg);
      log.textContent = log.textContent.replace(/\nCortex: \.\.\.$/, '\n' + reply);
    } catch (e) {
      log.textContent = log.textContent.replace(/\nCortex: \.\.\.$/, '\nError: Cortex bridge offline (:8420).');
    }
    log.scrollTop = log.scrollHeight;
  }

  function fetchEdgeTrips() {
    fetch('http://127.0.0.1:8420/api/edgerider/trips').then(r => r.json()).then(d => {
      document.getElementById('er-output').textContent = JSON.stringify(d.trips, null, 2);
    }).catch(() => { document.getElementById('er-output').textContent = 'Bridge offline on port 8420'; });
  }

  function fetchShopCodes() {
    fetch('http://127.0.0.1:8420/api/shopsense/dtc').then(r => r.json()).then(d => {
      document.getElementById('ss-output').textContent = JSON.stringify(d.dtc_codes, null, 2);
    }).catch(() => { document.getElementById('ss-output').textContent = 'Bridge offline on port 8420'; });
  }

  // Global Guidance Key Listener: F1 or Ctrl+K toggles Command & Guidance window
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      if (windows['guide']) closeApp('guide');
      else openApp('guide');
    }
  });

  setInterval(() => {
    const c = document.getElementById('clock');
    if (c) c.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 1000);
</script>
</body>
</html>
WEBOS

mkdir -p www
cp -f "$FILE" www/index.html
echo "[OK] deploy_aurora.sh updated and synced to index.html + www/index.html!"
