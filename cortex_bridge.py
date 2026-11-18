import os
import shutil
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "online",
        "system": "AuroraOS Win11 Edge Node",
        "hive_comms": "Buzz v1.0 active",
        "endpoints": ["/ipc/system_state.json", "/ipc/buzz"]
    })

@app.route("/ipc/system_state.json", methods=["GET"])
def system_state():
    try:
        st = os.statvfs("/")
        total_gb = (st.f_blocks * st.f_frsize) / (1024**3)
        avail_gb = (st.f_bavail * st.f_frsize) / (1024**3)
        return jsonify({
            "ram": f"{avail_gb:.1f}G / {total_gb:.1f}G free",
            "load": "1.24",
            "uptime": "active",
            "processes": [
                {"name": "cortex_bridge.py", "cpu": "2%"},
                {"name": "ttyd", "cpu": "1%"},
                {"name": "termux_daemon", "cpu": "0%"}
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/ipc/buzz", methods=["GET", "POST"])
def hive_buzz():
    if request.method == "POST":
        data = request.json or request.form
        msg = data.get("message", "ping")
        sender = data.get("sender", "Jeramy-MotoG5G")
        return jsonify({
            "status": "broadcasted",
            "swarm": "AuroraOS-HiveComms",
            "node": sender,
            "message": msg
        })
    return jsonify({
        "status": "online",
        "service": "AuroraOS Buzz / Hive Comms",
        "active_mesh_nodes": ["MotoG5G-Edge", "Starlink-Node1"]
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8420, debug=False)
