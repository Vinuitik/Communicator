# Host Wrapper — LLM Gateway (standalone, NOT wired in)

Files: main.py, llm_router.py, requirements.txt, .env.example, start.sh

> **Status: ported and verified working, but NOT called by anything yet.**
> `ai_agent` still talks to Gemini directly (`ai_agent/services/agent_service.py`).
> Wiring ai_agent's chat/summarize/validate calls through this gateway is
> deliberately deferred until the chat-LLM privacy decision is made (self-hosted
> vs. cloud fanout, for confidential friend data — see root `FLOWS.md` / STATE).
> `[NOT INTEGRATED]`

Ported from ObsidianOptimizer's `host-wrapper/` (2026-07-23), right-sized: OO's
version also browsed/mounted an Obsidian vault and extracted text from note
images (`/fs/list`, `/vault-path`, `/process-image[s]`). Communicator has no
vault and no image-extraction caller today, so only the generic LLM-routing
surface was ported. `llm_router.py` is copied verbatim (it was already
domain-agnostic — no vault coupling) and still has vision support
(`complete_vision`/`complete_vision_batch`) if a use case shows up later; only
`main.py`'s HTTP surface was trimmed.

## Role

One process that owns every outbound call to a third-party LLM: free-tier
providers tried in priority order, paid/subscription providers last, so no
single caller can burn quota unfairly. **Runs on the host, not in Docker** —
same as OO — so it can (a) own rate-limiting centrally regardless of how many
containers might call it, and (b) optionally reach a host-installed `claude`
CLI for the `claude-cli` fallback provider (subscription credits, no API key).

## Startup

`./start.sh` → venv + `pip install -r requirements.txt` → `python3 main.py` →
Flask (threaded) on `0.0.0.0:${PORT:-5011}`.

Config: **`host-wrapper/.env`** (own SSOT — unlike OO, Communicator has no
repo-root `.env`; every service keeps its own, same convention as
`ai_agent/.env`). Copy `.env.example` → `.env` and fill in whichever provider
keys you have; a provider with no key is silently skipped by the router.

**Port is 5011, not 5001 on purpose.** OO's own host-wrapper (a sister project
that may run on the same machine, under its own bash restart-loop supervisor)
defaults to port 5001. Reusing it caused a real collision during porting —
confirmed 2026-07-23: starting Communicator's wrapper on 5001 silently won the
bind and OO's service dropped off `/health` until the port was freed. If you
ever need both running at once, keep them on different ports.

## Keys copied (scoped, 2026-07-23)

From OO's root `.env`, **only** the LLM provider keys were copied:
`GEMINI_API_KEY`, `GITHUB_MODELS_TOKEN`, `MISTRAL_API_KEY`, `GROQ_API_KEY`.
Everything else in OO's `.env` (OAuth client secrets, Cloudflare tunnel token,
Google Drive service-account JSON, sync passphrase, MCP tokens) was
deliberately **not** copied — unrelated to this service, no reason for
Communicator to hold those secrets. `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`
were not present in OO's `.env` either, so those providers show
`configured: false` here (harmless — just skipped).

## Provider chains

```
Text (LLM_TEXT_PRIORITY):     groq → github → mistral → deepseek → gemini → claude-cli
Vision (LLM_VISION_PRIORITY): gemini → github → mistral → anthropic
```

Gemini is deliberately late in the text chain (reserve its quota); Claude is
last resort. See `llm_router.py` module docstring for the full concurrency
model (sharding via `in_flight ≤ 1` per provider, priority-weighted waiters,
exponential-backoff cooldown honoring `Retry-After`).

## GET /health

`{"status": "ok"}`.

## GET /providers

Router introspection: `{"gemini": {"configured": true, "in_flight": 0, "cooldown_s": 0, "ok": 1, "failed": 0}, ...}`.
Verified 2026-07-23: `gemini`/`github`/`mistral`/`groq` → `configured: true`;
`anthropic`/`deepseek` → `false` (no key); `claude-cli` → `true` (no key
needed, but only actually works if a `claude` binary is on `PATH` and
authenticated — untested here).

## POST /complete

Request: `{"prompt": str, "system"?: str, "model"?: str, "priority"?: "high"|"medium"|"low"}`
Response: `{"text": str, "provider": str}` or `{"error": str}` (503 if every
provider in the chain fails/is exhausted).

Verified live 2026-07-23: a real `/complete` call round-tripped through
GitHub Models successfully (`{"provider":"github","text":"pong"}`).

## Technology Notes

- **Not in Docker by design.** Needs the host `claude` CLI auth context (if
  used) and lets one process own all outbound LLM rate limiting regardless of
  how many Communicator containers might eventually call it. To containerize
  later: drop the `claude-cli` provider, and if `ai_agent` (in Docker) needs to
  reach it, Linux Docker requires `extra_hosts: ["host.docker.internal:host-gateway"]`
  in `docker-compose.yml` — `host.docker.internal` is NOT automatically
  resolvable on Linux the way it is on Docker Desktop (Windows/Mac). Not added
  yet since nothing calls this service.
- **In-memory router state.** Cooldowns and ok/fail counters reset on restart.
  No persistence by design (matches OO).
- **Real credentials, real quota.** `/complete` calls are live third-party API
  requests. Each provider's free-tier limits still apply (see OO's
  `host-wrapper/FLOWS.md` provider table for RPM/daily caps) — this gateway
  doesn't change the limits, only which provider absorbs a given request.
- **`claude-cli` provider is unverified here.** It's always `configured: true`
  (no key required by design) but will fail at call time if no `claude` binary
  is on `PATH` / not authenticated — self-healing (benched, chain continues to
  the next provider), just don't expect it to actually work without setup.
- **Privacy implication of turning this on.** Once wired into ai_agent, chat/
  summarize/validate prompts (which include confidential friend data) would be
  eligible to land on ANY configured provider — Gemini, GitHub Models,
  Mistral, or Groq — not just Gemini as today. That's the crux of the
  deferred privacy decision; don't wire this in without revisiting it.

## Change Index

| Thing to change | Where |
|---|---|
| Any API key | `host-wrapper/.env` |
| Provider order | `.env → LLM_TEXT_PRIORITY / LLM_VISION_PRIORITY` |
| Models per provider | `.env → GEMINI_MODEL / GROQ_TEXT_MODEL / ...` (see `.env.example`) |
| Port | `.env → PORT` (default 5011 — see collision note above) |
| Rate spacing / RPM | `llm_router._build_providers()` → `min_interval` |
| Cooldown policy | `llm_router.Provider.bench()` |
| Add a provider | `llm_router._build_providers()` + add to a priority chain |
| Add vision HTTP surface back | `main.py` — `router.complete_vision(...)` already exists in `llm_router.py`, just needs a route |
| Wire ai_agent to use this instead of direct Gemini | `[NOT IMPLEMENTED]` — pending privacy decision; would touch `ai_agent/services/agent_service.py._setup_llm` (or a new HTTP-backed LLM client) |
