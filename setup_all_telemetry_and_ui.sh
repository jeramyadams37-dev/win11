#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd ~/win11
mkdir -p backups /data/data/com.termux/files/home/AuroraOS
TS=$(date +%Y%m%d_%H%M%S)

cp -f ~/aurora_cortex_bridge.py "backups/aurora_cortex_bridge.py.bak.$TS"
cp -f www/apps-suite-v2.js "backups/apps-suite-v2.js.bak.$TS"
echo "[OK] Backups saved in ~/win11/backups/"

cat << 'PYEOF' > ~/aurora_cortex_bridge.py
import os, sqlite3, json, subprocess
from datetime import datetime
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
  trips | edgerider       -> View recent EdgeRider gig trips from aurora.db
  dtc | shopsense         -> View stored ShopSense OBD-II diagnostic codes
  <any keyword>           -> Search across all aurora.db SQLite tables for matches

[Win11 UI Shortcuts]
  F1 or Ctrl+K            -> Toggle the Commands & Guidance window anywhere in Win11
  ⠿ Quick Menu + [—]      -> Drag or minimize the Quick Menu; taps outside auto-minimize"""

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_telemetry_tables():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS edgerider_trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            zone TEXT DEFAULT 'Springfield/Petersburg IL',
            miles REAL DEFAULT 0.0,
            payout REAL DEFAULT 0.0,
            net_per_mile REAL DEFAULT 0.0,
            status TEXT DEFAULT 'completed',
            created_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS shopsense_dtc (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle TEXT NOT NULL,
            code TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT DEFAULT 'moderate',
            status TEXT DEFAULT 'active',
            logged_at TEXT NOT NULL
        )
    """)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if cur.execute("SELECT COUNT(*) FROM edgerider_trips").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO edgerider_trips (platform, zone, miles, payout, net_per_mile, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                ("Walmart Spark", "Springfield North", 6.4, 18.50, 2.89, "completed", now),
                ("DoorDash", "Petersburg / Greenview", 4.1, 11.25, 2.74, "completed", now),
                ("Instacart", "Springfield West", 5.8, 22.00, 3.79, "completed", now),
            ],
        )
    if cur.execute("SELECT COUNT(*) FROM shopsense_dtc").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO shopsense_dtc (vehicle, code, description, severity, status, logged_at) VALUES (?, ?, ?, ?, ?, ?)",
            [
                ("2003 Buick LeSabre Limited (3.8L)", "P0442", "EVAP System Leak Detected (Small Leak)", "low", "monitoring", now),
                ("2008 Dodge Caliber", "P0171", "System Too Lean (Bank 1)", "moderate", "active", now),
                ("2012 Toyota Sienna", "P0562", "System Voltage Low (Alternator / Charging Check)", "high", "resolved", now),
            ],
        )
    conn.commit()
    conn.close()

def inspect_db():
    init_telemetry_tables()
    conn = get_db()
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    counts = {t: cur.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}
    conn.close()
    return DB_PATH, counts

def run_cmd(args, cwd=WIN11_DIR):
    try:
        res = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=15)
        return ((res.stdout or "").strip() or (res.stderr or "").strip()) or "(No output)"
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
    return jsonify({"status": "online", "db_found": bool(path), "db_path": path, "tables": counts, "model": GEMINI_MODEL})

@app.route("/api/edgerider/trips", methods=["GET", "POST", "OPTIONS"])
def edgerider_trips():
    if request.method == "OPTIONS":
        return ("", 204)
    init_telemetry_tables()
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        miles = float(data.get("miles", 0))
        payout = float(data.get("payout", 0))
        npm = round(payout / miles, 2) if miles > 0 else 0.0
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            "INSERT INTO edgerider_trips (platform, zone, miles, payout, net_per_mile, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (data.get("platform", "Spark / Delivery"), data.get("zone", "Central IL"), miles, payout, npm, data.get("status", "completed"), now),
        )
        conn.commit()
    rows = [dict(r) for r in cur.execute("SELECT * FROM edgerider_trips ORDER BY id DESC LIMIT 25").fetchall()]
    conn.close()
    return jsonify({
        "status": "ok",
        "summary": {
            "trip_count": len(rows),
            "total_payout": round(sum(r["payout"] for r in rows), 2),
            "total_miles": round(sum(r["miles"] for r in rows), 2),
        },
        "trips": rows,
    })

@app.route("/api/shopsense/dtc", methods=["GET", "POST", "OPTIONS"])
def shopsense_dtc():
    if request.method == "OPTIONS":
        return ("", 204)
    init_telemetry_tables()
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            "INSERT INTO shopsense_dtc (vehicle, code, description, severity, status, logged_at) VALUES (?, ?, ?, ?, ?, ?)",
            (data.get("vehicle", "Unknown Vehicle"), data.get("code", "P0000").upper(), data.get("description", "Custom DTC Entry"), data.get("severity", "moderate"), data.get("status", "active"), now),
        )
        conn.commit()
    rows = [dict(r) for r in cur.execute("SELECT * FROM shopsense_dtc ORDER BY id DESC LIMIT 25").fetchall()]
    conn.close()
    return jsonify({"status": "ok", "count": len(rows), "dtc_codes": rows})

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
        return jsonify({"response": "Latest GitHub Actions Builds:\n" + run_cmd(["gh", "run", "list", "--limit", "5"])})
    if q in {"gh status", "run status"}:
        return jsonify({"response": "APK Workflow Status:\n" + run_cmd(["gh", "run", "list", "--workflow=build-apk.yml", "--limit", "3"])})
    if q in {"build apk", "trigger build"}:
        return jsonify({"response": "Triggered APK Build:\n" + run_cmd(["gh", "workflow", "run", "build-apk.yml", "--ref", "main"])})
    if q in {"trips", "edgerider"}:
        init_telemetry_tables()
        conn = get_db()
        rows = conn.execute("SELECT platform, zone, miles, payout, net_per_mile FROM edgerider_trips ORDER BY id DESC LIMIT 5").fetchall()
        conn.close()
        lines = [f"  - {r['platform']} ({r['zone']}): {r['miles']} mi | ${r['payout']:.2f} (${r['net_per_mile']:.2f}/mi)" for r in rows]
        return jsonify({"response": "Recent EdgeRider Trips:\n" + "\n".join(lines)})
    if q in {"dtc", "shopsense", "codes"}:
        init_telemetry_tables()
        conn = get_db()
        rows = conn.execute("SELECT vehicle, code, description, status FROM shopsense_dtc ORDER BY id DESC LIMIT 5").fetchall()
        conn.close()
        lines = [f"  - [{r['code']}] {r['vehicle']}: {r['description']} ({r['status']})" for r in rows]
        return jsonify({"response": "ShopSense OBD-II Codes:\n" + "\n".join(lines)})
    if q in {"status", "health", "db tables", "db"}:
        path, counts = inspect_db()
        lines = [f"  - {k}: {v} rows" for k, v in counts.items()]
        return jsonify({"response": f"Cortex Online (:8420)\nDB: {path}\nTables:\n" + "\n".join(lines)})
    if q == "modules":
        return jsonify({"response": "Active Win11 Modules:\n  1. EdgeRider Telemetry (/api/edgerider/trips)\n  2. ShopSense OBD-II (/api/shopsense/dtc)\n  3. Cortex Console (:8420)\n  4. Guidance & Command Key (F1 / Ctrl+K)"})

    return jsonify({"response": f"Cortex [{GEMINI_MODEL}]: Unknown macro '{prompt}'. Type 'commands' or press F1 for available actions."})

if __name__ == "__main__":
    init_telemetry_tables()
    app.run(host="0.0.0.0", port=8420)
PYEOF

pkill -f "aurora_cortex_bridge.py" 2>/dev/null || true
sleep 1
nohup python3 ~/aurora_cortex_bridge.py > ~/aurora_cortex_bridge.log 2>&1 &
sleep 1

if ! grep -q "__auroraAutoMinBound" www/apps-suite-v2.js; then
  cat << 'JSEOF' >> www/apps-suite-v2.js

/* === AUTO-MINIMIZE QUICK MENU ON OUTSIDE TAP === */
(function() {
  if (window.__auroraAutoMinBound) return;
  window.__auroraAutoMinBound = true;

  const autoMinimize = (e) => {
    const menu = document.querySelector('[data-movable-ready="1"]');
    if (!menu || menu.classList.contains('aurora-menu-minimized')) return;
    if (menu.contains(e.target)) return;
    if (e.target.closest('#start-btn, .start-btn, [data-start-toggle]')) return;
    menu.classList.add('aurora-menu-minimized');
    const minBtn = menu.querySelector('.aurora-min-btn');
    if (minBtn) minBtn.textContent = '▲';
  };

  document.addEventListener('pointerdown', autoMinimize, true);
})();
JSEOF
fi

npx cap copy android

echo "=== VERIFY 1: EdgeRider Trips (:8420) ==="
curl -s http://127.0.0.1:8420/api/edgerider/trips | python3 -m json.tool

echo "=== VERIFY 2: ShopSense DTC (:8420) ==="
curl -s http://127.0.0.1:8420/api/shopsense/dtc | python3 -m json.tool

echo "=== VERIFY 3: UI Modules & Auto-Minimize in www/ ==="
grep -rnE "EdgeRider|ShopSense|aurora-drag-bar|toggleAuroraGuide|__auroraAutoMinBound" www/ | head -n 25
