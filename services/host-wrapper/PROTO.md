# Host Wrapper — LLM Gateway (containerized, wired into ai_agent)

Files: main.py, llm_router.py, pg_keys.py, encryption_service.py, Dockerfile, .dockerignore, requirements.txt, .env.example, start.sh

> **Status (2026-07-23): containerized and live.** `ai_agent` routes chat/summarize/
> validate through this gateway whenever `llm_settings.mode = 'cloud'` (Postgres,
> UI-switchable — see [AI Settings flow](../flows/ai-settings.md)). `mode = 'ollama'`
> (the default) bypasses this entirely and uses a local model instead — the
> privacy-vs-quality tradeoff the earlier deferred decision was about is now a
> runtime switch, not a wiring decision. Both paths verified live.

Ported from ObsidianOptimizer's `host-wrapper/` (2026-07-23), right-sized: OO's
version also browsed/mounted an Obsidian vault and extracted text from note
images (`/fs/list`, `/vault-path`, `/process-image[s]`). Communicator has no
vault and no image-extraction caller today, so only the generic LLM-routing
surface was ported. `llm_router.py` started as a verbatim copy (domain-agnostic,
no vault coupling) but has since diverged — see History below.

## Role

One process that owns every outbound call to a third-party LLM: free-tier
providers tried in priority order, so no single caller can burn quota
unfairly. Six real API-key providers: gemini, github, mistral, groq,
deepseek, anthropic.

## Startup

Docker Compose service `host-wrapper` (own `Dockerfile`, `python3 main.py` —
same entry point `start.sh` used when this ran on the host). Reachable at
`http://host-wrapper:5011` on the normal docker network — no
`host.docker.internal` gymnastics, no `extra_hosts` config needed (that would
have been the path if this had stayed host-only; see History).

Config: **`host-wrapper/.env`** (own SSOT, gitignored — same convention as
`ai_agent/.env`), loaded via `env_file:` in `docker-compose.yml` at container
start, **not baked into the image** (`.dockerignore` excludes it — this
matters now that it's an image that gets built, not a script run in place).
Copy `.env.example` → `.env` and fill in whichever provider keys you have;
they're a *fallback* now, not the only source — see Provider keys below.

## Provider keys: Postgres first, `.env` fallback (2026-07-23)

`pg_keys.load_db_keys()` reads `llm_provider_keys` (Postgres, same instance
`postgresDB`/`my_database` the JVM app and ai_agent use — reachable at
`postgresDB:5432` since this service joined the docker network), decrypts
each row with `encryption_service.EncryptionService` (AES-256-GCM, passphrase
`AI_SETTINGS_ENCRYPTION_KEY` — **must match the same var in `ai_agent/.env`**,
that's the only thing tying the two services' key-handling together, no key
material is ever exchanged directly). A DB-sourced key takes precedence over
the matching `.env` var per provider; if the DB is unreachable or
`AI_SETTINGS_ENCRYPTION_KEY` isn't set, it falls back to `.env`-only — logged,
never raised, so a Postgres hiccup doesn't take the gateway down.

Loaded once at `Router()` construction (module-level `router = ...` in
`main.py`), rebuilt on **`POST /admin/reload`** — ai_agent's settings-save
endpoint calls this automatically after a key changes, so a save takes effect
on the very next chat request, no restart. Trade-off: reload rebuilds the
whole `Router`, so in-flight cooldown/rate-limit counters reset too — accepted
as fine since key changes are rare.

## Provider chains

```
Text (LLM_TEXT_PRIORITY):     groq → github → mistral → deepseek → gemini
Vision (LLM_VISION_PRIORITY): gemini → github → mistral → anthropic
```

Gemini is deliberately late in the text chain (reserve its quota). See
`llm_router.py` module docstring for the full concurrency model (sharding via
`in_flight ≤ 1` per provider, priority-weighted waiters, exponential-backoff
cooldown honoring `Retry-After`).

## GET /health

`{"status": "ok"}`.

## GET /providers

Router introspection: `{"gemini": {"configured": true, "in_flight": 0, "cooldown_s": 0, "ok": 1, "failed": 0}, ...}`. Proxied by ai_agent's `GET /api/ai/settings/llm/host-wrapper-status` for the settings page's reachability indicator.

## POST /complete

Request: `{"prompt": str, "system"?: str, "priority"?: "high"|"medium"|"low"}`
(the `"model"` field from before claude-cli's removal is gone — it only ever
applied to that provider).
Response: `{"text": str, "provider": str}` or `{"error": str}` (503 if every
provider in the chain fails/is exhausted).

Verified live 2026-07-23 (post-containerization): a real `/complete` call
round-tripped through GitHub Models successfully, called from inside the
`ai-agent` container over the docker network.

## POST /admin/reload

Rebuilds the `Router` from Postgres + `.env`. Returns `{"status": "reloaded", "providers": {...}}` (same shape as `GET /providers`). Called automatically by ai_agent's settings endpoints after a provider key changes; safe to call anytime otherwise.

## History: why this was host-only, and why that changed (2026-07-23)

Originally **deliberately not in Docker** — needed the host `claude` CLI auth
context for a `claude-cli` fallback provider (subscription credits, no API
key), and running as a single host process gave it sole ownership of
outbound rate-limiting regardless of how many containers might eventually
call it. The documented containerization path at the time was: drop
`claude-cli`, and if `ai_agent` (in Docker) needs to reach a host-only
process, Linux Docker requires `extra_hosts: ["host.docker.internal:host-gateway"]`
(`host.docker.internal` isn't auto-resolvable on Linux the way it is on
Docker Desktop).

That path was **not** taken. Instead: `claude-cli` was dropped (six real
API-key providers cover the same failover shape without it) and the service
was containerized outright — no `extra_hosts` needed since it's just another
compose service on the normal network now. The "one process owns rate
limiting" rationale still holds: it only ever required a single instance,
which is just as true running in a container as on the host.

## Technology Notes

- **In-memory router state, resets on rebuild.** Cooldowns and ok/fail
  counters live in the `Provider` objects inside `Router` — restarting the
  container OR hitting `/admin/reload` loses them (matches OO's original
  design; the reload trade-off is new but the same category of loss).
- **Real credentials, real quota.** `/complete` calls are live third-party API
  requests. Each provider's free-tier limits still apply — this gateway
  doesn't change the limits, only which provider absorbs a given request.
- **Privacy is now a live toggle, not a wiring decision.** Whenever
  `llm_settings.mode = 'cloud'`, chat/summarize/validate prompts (which
  include confidential friend data) become eligible to land on whichever
  provider's turn it is in the priority chain — Gemini, GitHub Models,
  Mistral, Groq, DeepSeek, or Anthropic. `mode = 'ollama'` (default) keeps
  everything local instead. The UI's mode toggle states this trade-off
  directly; there's no separate gate beyond the mode switch itself.
- **Two encrypted-key domains, don't confuse them.** `AI_SETTINGS_ENCRYPTION_KEY`
  encrypts/decrypts the *provider keys stored in Postgres* — it is not
  itself a provider credential and authenticates to nothing external.
  `GEMINI_API_KEY`/`GITHUB_MODELS_TOKEN`/etc. (whether from `.env` or
  decrypted from Postgres) are the actual third-party credentials.

## Change Index

| Thing to change | Where |
|---|---|
| Any API key (fallback, if not set via the settings UI) | `host-wrapper/.env` |
| Any API key (primary path) | [AI Settings page](../nginx/static/settings/settings.html) → Postgres `llm_provider_keys`, encrypted |
| Encryption passphrase | `AI_SETTINGS_ENCRYPTION_KEY` in both `host-wrapper/.env` and `ai_agent/.env` — must match |
| Postgres connection | `POSTGRES_DSN` env var (`pg_keys.py`), default `postgresql://myapp_user:example@postgresDB:5432/my_database` |
| Provider order | `.env → LLM_TEXT_PRIORITY / LLM_VISION_PRIORITY` |
| Models per provider | `.env → GEMINI_MODEL / GROQ_TEXT_MODEL / ...` (see `.env.example`) |
| Port | `.env → PORT` (default 5011) / `docker-compose.yml` host-wrapper `ports` |
| Rate spacing / RPM | `llm_router._build_providers()` → `min_interval` |
| Cooldown policy | `llm_router.Provider.bench()` |
| Add a provider | `llm_router._build_providers()` + add to a priority chain + add to ai_agent's `LLMSettingsRepository.KNOWN_PROVIDERS` |
| Add vision HTTP surface back | `main.py` — `router.complete_vision(...)` already exists in `llm_router.py`, just needs a route |
| Which ai_agent calls route here | `mode` in the [AI Settings flow](../flows/ai-settings.md) — `ChatOllama` vs `HostWrapperChatModel` in `agent_service.py._setup_llm` |
