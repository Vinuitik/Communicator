"""Host Wrapper — the LLM gateway (ported from ObsidianOptimizer, 2026-07-23).

Right-sized for Communicator: OO's version also browsed/mounted an Obsidian
vault and extracted text from note images (`/fs/list`, `/vault-path`,
`/process-image[s]`). Communicator has no vault and no image-extraction
caller today, so only the generic LLM-routing surface was ported:
GET /health, GET /providers, POST /complete. The full `Router` (incl. vision)
still lives in llm_router.py if a vision use case shows up later.

NOT wired into ai_agent yet — ai_agent still calls Gemini directly. This
service exists standalone pending the chat-LLM privacy decision (self-hosted
vs. cloud fanout for confidential friend data). See host-wrapper/PROTO.md.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from flask import Flask, request, jsonify  # noqa: E402

import llm_router  # noqa: E402  (reads env at import — keep after load_dotenv)

app = Flask(__name__)
router = llm_router.Router()


@app.route("/health")
def health():
    return {"status": "ok"}


@app.route("/providers")
def providers():
    """Router introspection: configured providers, cooldowns, ok/fail counts."""
    return jsonify(router.status())


@app.route("/complete", methods=["POST"])
def complete():
    """Text completion through the router (free providers first, Claude CLI last).

    Request:  {"prompt": str, "system"?: str, "model"?: str, "priority"?: str}
    Response: {"text": str, "provider": str} or {"error": str}
    The "model" field only applies when the claude-cli provider is reached.
    """
    data = request.json or {}
    prompt = data.get("prompt", "")
    if not prompt:
        return jsonify({"error": "prompt required"}), 422

    try:
        text, provider = router.complete_text(
            prompt, system=data.get("system"), cli_model=data.get("model"),
            priority=data.get("priority", "medium"))
    except llm_router.RouterError as e:
        return jsonify({"error": str(e)}), 503

    return jsonify({"text": text, "provider": provider})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5011)), threaded=True)
