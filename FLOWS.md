# Communicator — Documentation Index

Personal-relationship CRM. Track friends, log interactions, score relationship "health", attach media, and turn free-text notes into AI-validated facts. This index is **navigation only** — content lives in the linked flows (end-to-end pipelines) and protos (per-service deep maps).

> **Topology (2026-07-12): the five JVM services are now ONE deployable.** friend, group, connections, chrono, backup were consolidated into a single Maven multi-module **modular monolith** (`communicator-app`, one JVM ~300 MB, was ~1.2 GB across 4–5 JVMs). Business boundaries are preserved as Maven modules; each still has its own `PROTO.md` at the same path. How the merge works (scanning, per-module URL prefixes, resolved bean collisions, single config) is in [**bootstrap/FLOWS.md**](bootstrap/FLOWS.md). The Python services (ai_agent, knowledgeMCP, fileRepository) remain separate.

## How this documentation is structured

Two layers, built bottom-up:

- **`PROTO.md`** (one per service, co-located deep in the code) — the *internal wiring* of a single service + its **`## Seams`** (inbound/outbound cross-service edges). These are the building blocks: dense, code-referenced (`ClassName.method()`, env vars, exact endpoints), and they call out every gotcha/failure mode. **Not flows** — they describe one service in isolation.
- **`flows/*.md`** (top-level) — genuine **end-to-end pipelines** that stitch the seams together: a user action traced UI → nginx → service → service → store → back. Flows link *down* into protos for mechanics.

Read a **flow** to understand "what happens when the user does X." Drop into a **proto** when you need the exact method/line to change. Protos are the deeper supplement — if a flow is enough, you may not need to open the code at all.

> Convention for future sessions: keep protos as the permanent deep layer; when you build a new feature, update the relevant `PROTO.md` seams first, then add/extend a `flows/*.md`. Protos are named `PROTO.md` precisely so they don't get mistaken for the flows.

---

## End-to-end flows

| Flow | What it covers | Services touched |
|---|---|---|
| [Relationship Lifecycle](flows/relationship-lifecycle.md) | log interaction → EMA health → weekly reminder → nightly decay (the CRM core loop) | UI · nginx · friend · chrono · Postgres |
| [Knowledge → Validated Facts](flows/knowledge-rag.md) | RAG + AI fact-checking: notes → chunks → embeddings → summary → validated referenced facts | UI · nginx · ai_agent · friend · Ollama · Mongo · Redis · Gemini |
| [Chat with the AI agent](flows/chat.md) | LangGraph ReAct agent driving MCP tools over WebSocket | UI · nginx · ai_agent · knowledgeMCP · friend |
| [Media Upload & Serve](flows/media.md) | per-friend/group media; the bytes-vs-metadata two-store hazard | UI · nginx · friend/group · fileRepository · Postgres |
| [Nightly Backup](flows/backup.md) | pg_dump + media zip → Google Drive | backup · Postgres · fileRepository · Drive |

---

## Service protos (deep supplement)

| Service | Proto | Status |
|---|---|---|
| **friend** (core CRM) | [friend/…/Friend/PROTO.md](friend/src/main/java/communicate/Friend/PROTO.md) | live |
| **nginx + orchestration** (routing spine, compose, infra) | [nginx/PROTO.md](nginx/PROTO.md) | live |
| **group** | [group/…/Group/PROTO.md](group/src/main/java/com/example/demo/Group/PROTO.md) | live (near-clone of friend) |
| **connections** | [connections/…/Connections/PROTO.md](connections/src/main/java/coommunicator/connections/Connections/PROTO.md) | `[SKELETON]` — model only, no endpoints |
| **chrono** (cron worker) | [chrono/…/chrono/PROTO.md](chrono/src/main/java/com/communicator/chrono/PROTO.md) | live |
| **backup** | [backup/PROTO.md](backup/PROTO.md) | live |
| **resourceRepository** (fileRepository, Flask) | [resourceRepository/…/PROTO.md](resourceRepository/flask-template/PROTO.md) | live |
| **ai_agent** (RAG + agent) | [ai_agent/PROTO.md](ai_agent/PROTO.md) | live (crown jewel) |
| **knowledgeMCP** (MCP tools) | [knowledgeMCP/PROTO.md](knowledgeMCP/PROTO.md) | live |
| **data-extraction** | [data-extraction/PROTO.md](data-extraction/PROTO.md) | `[PROTOTYPE]` — not in compose |
| **react** (SPA) | [react/src/PROTO.md](react/src/PROTO.md) | `[SCAFFOLD]` — API stubbed; legacy MPA is the live UI |

**Two frontends:** the live UI today is the **legacy vanilla-JS MPA** baked into `nginx/static/` (served directly); the React SPA at `/app/` is an unfinished replacement. See the [nginx proto §Two frontends](nginx/PROTO.md).

---

## Cross-cutting

- [**Code-Reuse Consolidation Report**](CODE_REUSE_REPORT.md) — where the codebase repeats itself (4× EMA, 3× Spring knowledge stacks, 3× Flask blueprints, …) and how to consolidate.
- [**JVM Monolith — Assembly & Routing**](bootstrap/FLOWS.md) — how friend/group/connections/chrono/backup became one process: module layout, component/entity scanning, per-module URL prefixes, resolved bean-name collisions, single config, and the single-JVM failure modes.
- **Infra** (all in `docker-compose.yml`, only nginx `8090` is host-exposed): one `communicator-app` (the JVM monolith), Postgres+pgvector, Redis, MongoDB, Kafka (provisioned, **unwired** — candidate for removal), Ollama. Details in the [nginx proto §Compose](nginx/PROTO.md).
- **Existing docs:** [README.md](README.md) (architecture overview), [Plan.md](Plan.md).
