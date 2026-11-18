#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/win11

# 1. Pre-flight safety backup
mkdir -p backups
TS=$(date +%Y%m%d_%H%M%S)
cp aurora_cortex_bridge.py "backups/aurora_cortex_bridge.py.bak.$TS"
echo "[OK] Backup saved to backups/aurora_cortex_bridge.py.bak.$TS"

# 2. Inspect current aurora_cortex_bridge.py structure
echo "=== Current aurora_cortex_bridge.py ==="
cat aurora_cortex_bridge.py
