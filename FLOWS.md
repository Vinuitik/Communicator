# Communicator — Documentation Index

Personal-relationship CRM. Track friends, log interactions, score relationship "health", attach media, and turn free-text notes into AI-validated facts. This index is **navigation only** — content lives in the linked flows (end-to-end pipelines) and protos (per-service deep maps).

> **Topology (2026-07-12): the five JVM services are now ONE deployable.** friend, group, connections, chrono, backup were consolidated into a single Maven multi-module **modular monolith** (`communicator-app`, one JVM ~300 MB, was ~1.2 GB across 4–5 JVMs). Business boundaries are preserved as Maven modules; each still has its own `PROTO.md` at the same path. How the merge works (scanning, per-module URL prefixes, resolved bean collisions, single config) is in [**bootstrap/FLOWS.md**](bootstrap/FLOWS.md). **knowledgeMCP was merged INTO ai_agent** (2026-07-13): its 6 tools now run **in-process** as a stdio subprocess (`ai_agent/knowledgeMCP/knowledgeMCP.py`, spawned by `ai_agent/services/mcp_service.py`) — the separate `mcp-knowledge-server` container is gone (one fewer container, no MCP-over-HTTP). fileRepository remains its own Python service. Also: Kafka+kafka-ui replaced by **RabbitMQ** (durable task queue, mgmt UI :15672).
>
> **Datastore consolidation (2026-07-23): Mongo + FAISS retired, Postgres image swapped to ParadeDB.** `pgvector/pgvector:pg17` → `paradedb/paradedb:0.24.3-pg17` (same PG17 minor, no dump/restore needed — pgvector was provisioned but had zero data in it beforehand). ai_agent's RAG data (chunks, embeddings, facts, fact-references — previously split across MongoDB + an in-memory FAISS index) now all lives in that same Postgres instance: `knowledge_chunks`/`chunk_embeddings` (hybrid pgvector + `pg_search` BM25 search, RRF-fused) and `friend_summaries`/`fact_references` (JSONB). The `generatedData` Mongo container is gone from compose (data volume left un-mounted, not deleted). A new standalone **embedder** service (ONNX EmbeddingGemma, 768-dim, port 8010) replaces Ollama for embeddings. Details: [ai_agent/PROTO.md](ai_agent/PROTO.md), [embedder/PROTO.md](embedder/PROTO.md), [flows/knowledge-rag.md](flows/knowledge-rag.md).
>
> **LLM mode switch (2026-07-23): local Ollama vs. cloud, runtime-switchable via UI.** The privacy-vs-quality tradeoff mentioned above as deferred is now a live toggle, not a wiring decision. New [AI Settings page](nginx/static/settings/settings.html) + `llm_settings`/`llm_provider_keys` Postgres tables (encrypted keys, AES-256-GCM). `mode=ollama` (default): Ollama got a real chat model (`llama3.2:3b`, was embedding-only before) and ai_agent's chat agent switched from LangGraph's native-tool-calling `create_react_agent` to `langchain_classic`'s `create_structured_chat_agent` (JSON-action-blob ReAct, works with any plain-text LLM — needed because host-wrapper's `/complete` has no tool-calling API and MCP tools are multi-arg `StructuredTool`s the plain ReAct format can't drive). `mode=cloud`: **host-wrapper is now containerized and actually wired into ai_agent** — dropped its `claude-cli` provider to make that worthwhile (needed host CLI auth, incompatible with a container), reads provider keys from the shared Postgres with `.env` as fallback. Found and fixed two unrelated live outages while verifying tool-calling worked end-to-end: `ai_agent`'s `friend_service.base_url` had been dead since the 2026-07-12 JVM consolidation (silently — errors swallowed, always returned empty), and nginx was crash-looping on a stale `mcp-knowledge-server` upstream reference from the 2026-07-13 MCP consolidation (source config was already correct, the image just hadn't been rebuilt since). Details: [ai_agent/PROTO.md](ai_agent/PROTO.md), [host-wrapper/PROTO.md](host-wrapper/PROTO.md), [flows/ai-settings.md](flows/ai-settings.md), [flows/chat.md](flows/chat.md).

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
| [Knowledge → Validated Facts](flows/knowledge-rag.md) | RAG + AI fact-checking: notes → chunks → embeddings → summary → validated referenced facts | UI · nginx · ai_agent · friend · embedder · Postgres/ParadeDB · Redis · mode-switched LLM |
| [Chat with the AI agent](flows/chat.md) | structured-chat ReAct agent driving MCP tools over WebSocket, mode-switchable LLM | UI · nginx · ai_agent · knowledgeMCP (in-process) · friend · Ollama/host-wrapper |
| [AI Settings](flows/ai-settings.md) | local/cloud LLM mode switch + encrypted provider keys, live no-restart reload | UI · nginx · ai_agent · Postgres · host-wrapper |
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
| **knowledgeMCP** (MCP tools) | [ai_agent/knowledgeMCP/PROTO.md](ai_agent/knowledgeMCP/PROTO.md) | live (now nested under ai_agent/) |
| **embedder** (ONNX EmbeddingGemma) | [embedder/PROTO.md](embedder/PROTO.md) | live — ported 2026-07-23, replaces Ollama for embeddings |
| **data-extraction** | [data-extraction/PROTO.md](data-extraction/PROTO.md) | `[PROTOTYPE]` — not in compose |
| **react** (SPA) | [react/src/PROTO.md](react/src/PROTO.md) | `[SCAFFOLD]` — API stubbed; legacy MPA is the live UI |
| **host-wrapper** (multi-provider LLM gateway) | [host-wrapper/PROTO.md](host-wrapper/PROTO.md) | live, containerized, wired into ai_agent (2026-07-23) — used when `llm_settings.mode='cloud'` |

**Two frontends:** the live UI today is the **legacy vanilla-JS MPA** baked into `nginx/static/` (served directly); the React SPA at `/app/` is an unfinished replacement. See the [nginx proto §Two frontends](nginx/PROTO.md).

---

## Cross-cutting

- [**Code-Reuse Consolidation Report**](CODE_REUSE_REPORT.md) — where the codebase repeats itself (4× EMA, 3× Spring knowledge stacks, 3× Flask blueprints, …) and how to consolidate.
- [**JVM Monolith — Assembly & Routing**](bootstrap/FLOWS.md) — how friend/group/connections/chrono/backup became one process: module layout, component/entity scanning, per-module URL prefixes, resolved bean-name collisions, single config, and the single-JVM failure modes.
- **Infra** (all in `docker-compose.yml`, only nginx `8090` is host-exposed): one `communicator-app` (the JVM monolith), Postgres/ParadeDB (pgvector + pg_search, shared by the JVM app and ai_agent), Redis, embedder, Ollama (active again as of 2026-07-23 — local chat LLM, `mode=ollama`), host-wrapper (cloud LLM gateway, `mode=cloud`), Kafka (provisioned, **unwired** — candidate for removal), RabbitMQ. Details in the [nginx proto §Compose](nginx/PROTO.md).
- **Existing docs:** [README.md](README.md) (architecture overview), [Plan.md](Plan.md).
