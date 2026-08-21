"""Host Wrapper — the LLM gateway (ported from ObsidianOptimizer, 2026-07-23).

Right-sized for Communicator: OO's version also browsed/mounted an Obsidian
vault and extracted text from note images (`/fs/list`, `/vault-path`,
`/process-image[s]`). Communicator has no vault and no image-extraction
caller today, so only the generic LLM-routing surface was ported:
GET /health, GET /providers, POST /complete. The full `Router` (incl. vision)
still lives in llm_router.py if a vision use case shows up later.

Containerized 2026-07-23 (was host-only before — see PROTO.md history) so
ai_agent can reach it over the normal docker network. That also meant
dropping the claude-cli provider (needed the host's `claude` CLI auth
context, which a container doesn't have) — see llm_router.py.

Provider keys come from Postgres (llm_provider_keys, encrypted — same table
the ai_agent settings UI writes to) with host-wrapper/.env as a fallback for
any provider not configured via the UI. Loaded once at startup; a settings
save calls POST /admin/reload here to pick up the change without waiting for
a restart (loses in-flight cooldown/rate-limit state on reload — acceptable,
key changes are rare).
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from flask import Flask, request, jsonify  # noqa: E402

import llm_router  # noqa: E402  (reads env at import — keep after load_dotenv)
from encryption_service import EncryptionService  # noqa: E402
from pg_keys import load_db_keys  # noqa: E402

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("host-wrapper")

app = Flask(__name__)
_encryption = EncryptionService()
router = llm_router.Router(db_keys=load_db_keys(_encryption))


@app.route("/health")
def health():
    return {"status": "ok"}


@app.route("/providers")
def providers():
    """Router introspection: configured providers, cooldowns, ok/fail counts."""
    return jsonify(router.status())


@app.route("/complete", methods=["POST"])
def complete():
    """Text completion through the router (free providers first, most-limited last).

    Request:  {"prompt": str, "system"?: str, "priority"?: str}
    Response: {"text": str, "provider": str} or {"error": str}
    """
    data = request.json or {}
    prompt = data.get("prompt", "")
    if not prompt:
        return jsonify({"error": "prompt required"}), 422

    try:
        text, provider = router.complete_text(
            prompt, system=data.get("system"),
            priority=data.get("priority", "medium"))
    except llm_router.RouterError as e:
        return jsonify({"error": str(e)}), 503

    return jsonify({"text": text, "provider": provider})


@app.route("/admin/reload", methods=["POST"])
def admin_reload():
    """Rebuild the router from Postgres + env. Called by ai_agent's settings
    endpoints after a provider key changes; safe to call anytime otherwise."""
    global router
    router = llm_router.Router(db_keys=load_db_keys(_encryption))
    log.info("Router reloaded")
    return jsonify({"status": "reloaded", "providers": router.status()})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5011)), threaded=True)
