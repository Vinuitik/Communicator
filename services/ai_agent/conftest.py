"""Makes ai_agent's own bare top-level imports (`from config.settings import
settings`, `from services.chunking_service import ChunkingService`, etc.)
resolve under pytest the same way they already do under `python main.py` /
uvicorn (both of which put ai_agent/ itself, not the repo root, at the front
of sys.path).

Without this, pytest's default import-mode rootpath walk stops at the repo
root (ai_agent/ has an __init__.py, so pytest treats it as a package and
inserts the repo root instead of ai_agent/ onto sys.path) and every
production module's bare imports fail with ModuleNotFoundError. This is the
first test suite added under ai_agent/, so nothing pre-existing depended on
the old (broken) behavior.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
