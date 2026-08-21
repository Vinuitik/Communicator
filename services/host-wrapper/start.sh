#!/usr/bin/env bash
# Linux equivalent of OO's start.bat. Runs on the HOST, not in Docker — see
# PROTO.md Technology Notes for why (rate-limit ownership, optional claude-cli).
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
python3 main.py
