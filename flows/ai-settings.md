# Flow: AI Settings (local/cloud mode switch + provider keys)

Lets you choose whether chat and knowledge summarization run entirely on this machine (Ollama, private, slower) or through a multi-provider cloud gateway with failover (host-wrapper, faster, higher quality, third-party data exposure). **UI → nginx → ai_agent → Postgres (+ host-wrapper for cloud provider status/reload)**.

Protos: [ai_agent](../ai_agent/PROTO.md) · [host-wrapper](../host-wrapper/PROTO.md) · [nginx spine](../nginx/PROTO.md). Determines which LLM the [chat flow](chat.md) actually uses.

---

## The pipeline

```
Browser opens /settings/settings.html
 → GET /api/ai/settings/llm                  → {mode, providers: {name: bool}}
 → GET /api/ai/settings/llm/host-wrapper-status → {reachable, providers: {...}} (proxies host-wrapper's own /providers)

User flips the mode radio:
 → PUT /api/ai/settings/llm/mode {mode}
    → LLMSettingsRepository.set_mode()        Postgres llm_settings (singleton row)
    → AgentService.reload_llm()               rebuilds LLM + agent IN-PROCESS, no restart
       mode=ollama → ChatOllama(llama3.2:3b, http://ollama:11434)
       mode=cloud  → HostWrapperChatModel(http://host-wrapper:5011)

User pastes a provider API key and clicks Save:
 → PUT /api/ai/settings/llm/providers/{name} {api_key}
    → EncryptionService.encrypt()             AES-256-GCM, AI_SETTINGS_ENCRYPTION_KEY
    → LLMSettingsRepository.set_provider_key() Postgres llm_provider_keys (encrypted_key BYTEA)
    → POST http://host-wrapper:5011/admin/reload   best-effort, logged not raised if unreachable
       → host-wrapper re-reads llm_provider_keys, decrypts, rebuilds its Router
       → DB-sourced key takes precedence over the matching host-wrapper/.env var, per provider
```

GET never returns a decrypted key — only whether each provider has one configured (bool), which is all the UI renders (a badge, not the key itself).

---

## What each store holds

| Store | Holds |
|---|---|
| **Postgres `llm_settings`** | Singleton row: current mode (`ollama` or `cloud`), default `ollama` |
| **Postgres `llm_provider_keys`** | One row per configured cloud provider, `encrypted_key BYTEA` (AES-256-GCM) |
| **host-wrapper's in-memory Router** | Rebuilt on `/admin/reload` from Postgres + its own `.env` fallback; cooldown/rate-limit state resets on rebuild (acceptable — key changes are rare) |
| **ai_agent's `AgentService`** | Holds the currently-built LLM + agent object; rebuilt by `reload_llm()`, not persisted (re-reads mode from Postgres on every ai_agent restart) |

**Achieves:** a runtime-switchable, UI-driven privacy/quality tradeoff for every LLM call this app makes, without redeploying anything — confirmed live by switching modes mid-session and watching the very next chat request use the new LLM.

---

## Notes

- **Mode is global, not per-purpose.** One switch affects chat, knowledge summarization, and fact validation alike — a deliberate simplification over per-feature provider choice (this was a real fork discussed and decided in favor of the simpler design).
- **Cloud mode needs host-wrapper actually running.** It's a normal docker-compose service now (containerized 2026-07-23 — see host-wrapper's proto for why it used to be host-only and what changed), so `docker compose up` starts it automatically, but if it's down, cloud mode chat requests fail rather than silently falling back to local. The settings page's reachability indicator exists specifically to surface this before it surprises you mid-chat.
- **The two secrets involved don't overlap.** `AI_SETTINGS_ENCRYPTION_KEY` (must match in `ai_agent/.env` and `host-wrapper/.env`) encrypts/decrypts the *provider keys stored in Postgres*. The provider keys themselves (Gemini, GitHub, etc.) are a completely separate secret domain — one derives a symmetric cipher key, the others authenticate to third-party APIs.
- **Ollama's local model is genuinely small (3B params) for CPU-inference speed**, and it's not always reliable at the strict JSON tool-calling format the chat agent needs — see the [chat flow](chat.md)'s notes. Plain conversation works fine regardless.

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| Default mode | `ai_agent/db/schema.sql` `llm_settings` seed row |
| Known cloud providers | `ai_agent/repositories/llm_settings_repository.py` `KNOWN_PROVIDERS` (must match `host-wrapper/llm_router.py`'s provider names) |
| Encryption passphrase | `AI_SETTINGS_ENCRYPTION_KEY` in both `ai_agent/.env` and `host-wrapper/.env` — must match |
| Settings API | `ai_agent/routers/settings.py` |
| Settings UI | `nginx/static/settings/settings.{html,css,js}` |
| Local model swap | `config.yaml llm.ollama_chat_model` + pull it in `docker-compose.yml` ollama `command` |
| Cloud provider priority/failover | `host-wrapper/llm_router.py` `TEXT_PRIORITY`/`VISION_PRIORITY` |
