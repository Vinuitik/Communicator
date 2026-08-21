# Communicator — Documentation Index

Personal-relationship CRM. Track friends, log interactions, score relationship "health", attach media, and turn free-text notes into AI-validated facts. This index is **navigation only** — content lives in the linked flows (end-to-end pipelines) and protos (per-service deep maps).

**History:** 2026-07-12 the five JVM services (friend/group/connections/chrono/backup) merged into one Maven multi-module monolith, `communicator-app` — see [bootstrap/FLOWS.md](services/bootstrap/FLOWS.md). 2026-07-13 knowledgeMCP merged into ai_agent (in-process stdio, no separate container). 2026-07-23 Mongo+FAISS retired for Postgres/ParadeDB (`knowledge_chunks`/`chunk_embeddings`/`fact_references`), and the local/cloud LLM mode switch shipped — see [ai_agent/FLOWS.md](services/ai_agent/FLOWS.md#ai-settings-localcloud-mode-switch--provider-keys). 2026-08-21 Kafka's RabbitMQ replacement got its first real producer/consumer (the knowledge-chunk trigger) — see [ai_agent/FLOWS.md](services/ai_agent/FLOWS.md#eager-multi-entity-chunking). 2026-08 the repo root was reorganized into `services/` (Maven modules + Python services), `frontend/` (react/extension), and `infra/` (nginx/ollama/cloudflared) — see each directory's own layout, this file's links already point at the new paths.

## How this documentation is structured

Two layers, built bottom-up:

- **`PROTO.md`** (one per service, co-located deep in the code) — the *internal wiring* of a single service + its **`## Seams`** (inbound/outbound cross-service edges). These are the building blocks: dense, code-referenced (`ClassName.method()`, env vars, exact endpoints), and they call out every gotcha/failure mode. **Not flows** — they describe one service in isolation.
- **`FLOWS.md`** (co-located next to the module it documents, or `flows/*.md` at root for anything still cross-cutting/undecided) — genuine **end-to-end pipelines** that stitch the seams together: a user action traced UI → nginx → service → service → store → back. Flows link *down* into protos for mechanics.

Read a **flow** to understand "what happens when the user does X." Drop into a **proto** when you need the exact method/line to change. Protos are the deeper supplement — if a flow is enough, you may not need to open the code at all.

> Convention for future sessions: keep protos as the permanent deep layer; when you build a new feature, update the relevant `PROTO.md` seams first, then add/extend a `FLOWS.md` co-located with the code it describes. Protos are named `PROTO.md` precisely so they don't get mistaken for the flows.

---

## End-to-end flows

| Flow | What it covers | Services touched |
|---|---|---|
| [Relationship Lifecycle](services/friend/src/main/java/communicate/Friend/FLOWS.md) | log interaction → EMA health → weekly reminder → nightly decay (the CRM core loop) | UI · nginx · friend · chrono · Postgres |
| [Relationship Scheduling — FSRS + Bandit](services/friend/src/main/java/communicate/Friend/FriendService/FLOWS.md) | deep dive: how `plannedSpeakingTime` is actually chosen — FSRS-6 stability/difficulty + Thompson-sampling bandit interval multiplier + nightly neglect lapse | friend · chrono · host-wrapper · Postgres |
| [Knowledge → Validated Facts](services/ai_agent/FLOWS.md#knowledge--validated-facts-the-rag--fact-checking-pipeline) | RAG + AI fact-checking: notes → chunks → embeddings → summary → validated referenced facts | UI · nginx · ai_agent · friend · embedder · Postgres/ParadeDB · Redis · mode-switched LLM |
| [Chat with the AI agent](services/ai_agent/FLOWS.md#chat-with-the-ai-agent-structured-chat-agent--mcp-tools) | structured-chat ReAct agent driving MCP tools over WebSocket, mode-switchable LLM | UI · nginx · ai_agent · knowledgeMCP (in-process) · friend · Ollama/host-wrapper |
| [AI Settings](services/ai_agent/FLOWS.md#ai-settings-localcloud-mode-switch--provider-keys) | local/cloud LLM mode switch + encrypted provider keys, live no-restart reload | UI · nginx · ai_agent · Postgres · host-wrapper |
| [Media Upload & Serve](services/resourceRepository/flask-template/FLOWS.md) | per-friend/group media; the bytes-vs-metadata two-store hazard | UI · nginx · friend/group · fileRepository · Postgres |
| [Nightly Backup](services/backup/FLOWS.md) | pg_dump + media zip → Google Drive | backup · Postgres · fileRepository · Drive |
| [Meeting Scheduling](flows/meeting-scheduling.md) | week board across Friend/Group/Connection, attendee-list-driven meeting model | UI · nginx · meeting · friend · group · connections |

---

## Service protos (deep supplement)

| Service | Proto | Status |
|---|---|---|
| **friend** (core CRM) | [friend/…/Friend/PROTO.md](services/friend/src/main/java/communicate/Friend/PROTO.md) | live |
| **nginx + orchestration** (routing spine, compose, infra) | [nginx/PROTO.md](infra/nginx/PROTO.md) | live |
| **group** | [group/…/Group/PROTO.md](services/group/src/main/java/com/example/demo/Group/PROTO.md) | live (near-clone of friend) |
| **connections** | [connections/…/Connections/PROTO.md](services/connections/src/main/java/coommunicator/connections/Connections/PROTO.md) | `[SKELETON]` — model only, no endpoints |
| **meeting** | [meeting/FLOWS.md](services/meeting/src/main/java/com/communicator/meeting/FLOWS.md) | live |
| **chrono** (cron worker) | [chrono/…/chrono/PROTO.md](services/chrono/src/main/java/com/communicator/chrono/PROTO.md) | live |
| **backup** | [backup/PROTO.md](services/backup/PROTO.md) | live |
| **resourceRepository** (fileRepository, Flask) | [resourceRepository/…/PROTO.md](services/resourceRepository/flask-template/PROTO.md) | live |
| **ai_agent** (RAG + agent) | [ai_agent/PROTO.md](services/ai_agent/PROTO.md) | live (crown jewel) |
| **knowledgeMCP** (MCP tools) | [ai_agent/knowledgeMCP/PROTO.md](services/ai_agent/knowledgeMCP/PROTO.md) | live (now nested under ai_agent/) |
| **embedder** (ONNX EmbeddingGemma) | [embedder/PROTO.md](services/embedder/PROTO.md) | live — ported 2026-07-23, replaces Ollama for embeddings |
| **data-extraction** | [data-extraction/PROTO.md](services/data-extraction/PROTO.md) | `[PROTOTYPE]` — not in compose |
| **react** (SPA) | [react/src/PROTO.md](frontend/react/src/PROTO.md) | `[SCAFFOLD]` — API stubbed; legacy MPA is the live UI |
| **host-wrapper** (multi-provider LLM gateway) | [host-wrapper/PROTO.md](services/host-wrapper/PROTO.md) | live, containerized, wired into ai_agent (2026-07-23) — used when `llm_settings.mode='cloud'` |

**Two frontends:** the live UI today is the **legacy vanilla-JS MPA** baked into `nginx/static/` (served directly); the React SPA at `/app/` is an unfinished replacement. See the [nginx proto §Two frontends](infra/nginx/PROTO.md).

---

## Cross-cutting

- [**JVM Monolith — Assembly & Routing**](services/bootstrap/FLOWS.md) — how friend/group/connections/chrono/backup became one process: module layout, component/entity scanning, per-module URL prefixes, resolved bean-name collisions, single config, and the single-JVM failure modes.
- [**Offline Outbox — Three-Tier Write Path**](frontend/react/src/pwa/FLOWS.md) — client-side direct/Drive-relay/IndexedDB write fallback; server side is `MailboxConsumeService` (see `services/bootstrap/`). E2E coverage: [e2e/FLOWS.md](e2e/FLOWS.md).
- **Infra** (all in `docker-compose.yml`, only nginx `8090` is host-exposed): one `communicator-app` (the JVM monolith), Postgres/ParadeDB (pgvector + pg_search, shared by the JVM app and ai_agent), Redis, embedder, Ollama (local chat LLM, `mode=ollama`), host-wrapper (cloud LLM gateway, `mode=cloud`), RabbitMQ (durable task queue, mgmt UI :15672 — see [ai_agent/FLOWS.md](services/ai_agent/FLOWS.md#eager-multi-entity-chunking)). Details in the [nginx proto §Compose](infra/nginx/PROTO.md).
- **Existing docs:** [README.md](README.md) (architecture overview).
