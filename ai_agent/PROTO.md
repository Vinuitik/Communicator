# AI Agent — Proto (RAG + fact-validation pipeline)

> **Proto, not a flow.** The user-facing "generate a friend's knowledge summary" and "chat about a friend" pipelines are in [flows/](../flows/). This maps the internals + the many external seams (host-wrapper/Ollama, embedder, Postgres/ParadeDB, Redis, MCP, friend).

Files: main.py, routers/{chat,knowledge,settings}.py, services/{agent,knowledge,fact,fact_validation,chunking,embedding,search,friend_api,knowledge_cache,mcp,encryption}_service.py, services/host_wrapper_chat_model.py, repositories/{postgres,redis,fact,llm_settings}_repository.py, db/schema.sql, prompts/{prompt_manager,summary_prompt_service}.py, config/settings.py (+ config/config.yaml), dependencies/deps.py

## Role

The **AI brain**. FastAPI service, internal port **8001** (container `ai-agent`), nginx route `/api/ai/` (the only route with WebSocket upgrade). Two jobs:

1. **Chat** — a structured-chat ReAct agent (MCP tools) you converse with over HTTP or WebSocket. LLM is runtime-switchable: local Ollama or cloud via host-wrapper — see [AI Settings flow](../flows/ai-settings.md).
2. **Knowledge summarization** — turn a friend's raw knowledge notes into **validated, referenced key-value facts** (a RAG pipeline with AI fact-checking), stored in Postgres, cached in Redis. Uses the same mode-switched LLM as chat (`AgentService.generate_response()` / `self.llm`).

`depends_on: mcp-knowledge-server, postgres, embedder, host-wrapper` (host-wrapper is start-order only — chat/summarize still work if it's down and mode=ollama). Loads `ai_agent/.env` (secrets) + `config/config.yaml` (everything else). DI is wired in `dependencies/deps.py`; `main.py startup` eagerly builds the agent (fails hard if MCP won't init; LLM setup itself degrades to the ollama default rather than failing if the mode can't be read). **Mongo retired 2026-07-23** — everything this service persists now lives in Postgres/ParadeDB (same instance the JVM app uses), applied idempotently at startup via `PostgresRepository._apply_schema()` → `db/schema.sql`.

## Internal wiring — knowledge summarization (the crown jewel)

`POST /api/ai/knowledge/summarize {friend_id}` → `KnowledgeService.summarize_friend_knowledge()`:

```
1. cache_service.is_summary_cached(friend_id)?          Redis  → yes: return facts from Postgres (get_friend_facts_with_references)
2. friend_api_service.fetch_knowledge_paginated(fid)    HTTP → communicator-app:8080/api/friend/getKnowledge/{fid}/page/0/size/N
   (empty → store empty summary, cache, return)
2.5 LAZY CHUNKING  _ensure_knowledge_chunked():
     per knowledge item: fetch_knowledge_text(id)       HTTP → communicator-app:8080/api/friend/getKnowledgeText/{id}
       chunks exist in Postgres knowledge_chunks?  no → chunking_service.process_knowledge() (word-window chunks, chunk_text persisted)
2.6  chunking_service.ensure_embeddings_exist(chunkIds) → embedding_service (embedder svc, kind=document) → cache vectors (Redis)
3. prompt_service.generate_summary(knowledge, llm)      mode-switched LLM (ollama|host-wrapper)  → freeform summary
4. prompt_service.parse_summary_to_facts()              → List[(key, value)]
5. per fact: fact_service.create_fact_with_references(fid, key, value):
     a. search_service.search(fid, "key is value")      hybrid pgvector `<=>` + pg_search `@@@` BM25, RRF-fused → [(chunk_id, score)]
        (no hits + discard_if_no_references → DROP fact)
     b. take top max_references_per_fact chunks → knowledge_ids
     c. friend_api_service.fetch_knowledge_texts_batch() HTTP → communicator-app:8080/api/friend (asyncio.gather)
     d. validation_service.validate_fact(key,value,texts) mode-switched LLM → {is_valid, confidence, reasoning} (STRICT json)
     e. is_valid AND confidence ≥ min_validation_confidence?  no → DROP fact
     f. fact_repository.save_fact() + insert fact_references (chunk_id, knowledge_id, score, rank)  Postgres
6. cache_service.cache_summary(friend_id)               Redis
7. return get_friend_facts_with_references()            Postgres facts + chunk_text read directly off the row (no reconstruction — see below)
```

**Postgres tables** (same instance/database as the JVM app, `postgresDB`/`my_database`, applied via `db/schema.sql`): `knowledge_chunks` (chunk metadata + **chunk_text**, BM25-indexed via `pg_search`), `chunk_embeddings` (`vector(768)`, HNSW cosine index), `friend_summaries` (facts as a JSONB array per friend), `fact_references` (fact→chunk links w/ scores). `friend_summaries` is mutated via `jsonb_array_elements()`/`jsonb_agg()` directly in `FactRepository` (push/pull/positional-update) — the other three go through `PostgresRepository`'s generic `find_one/find_many/insert_many/delete_many/count_documents` adapter (same narrow surface the old `MongoRepository` had, so `chunking_service.py` barely changed). Also (2026-07-23): `llm_settings` (singleton mode toggle) + `llm_provider_keys` (encrypted cloud provider keys) — see [AI Settings flow](../flows/ai-settings.md), `repositories/llm_settings_repository.py`.

## Internal wiring — chat

- **Agent architecture (changed 2026-07-23):** was LangGraph's `create_react_agent` (needs native LLM tool-calling — Gemini only). Now `langchain_classic.agents.create_structured_chat_agent` + `AgentExecutor` (`agent_service.py` `_SYSTEM_PROMPT`/`_HUMAN_PROMPT`) — a JSON-action-blob ReAct variant that works with any plain-text-completion LLM, so the SAME agent code runs whether `self.llm` is `ChatOllama` or `HostWrapperChatModel`. Switched specifically because MCP tools are multi-arg `StructuredTool`s and the plainer `create_react_agent`'s single-string Action Input errors on those (`String tool inputs are not allowed when using tools with JSON schema args_schema` — hit live).
- **LLM is mode-switched, not fixed.** `_setup_llm()` reads `llm_settings.mode` (Postgres, via `LLMSettingsRepository`) — `ollama` (default): `ChatOllama(settings.ollama_chat_model, settings.ollama_url)`. `cloud`: `HostWrapperChatModel(settings.host_wrapper_url)` (`services/host_wrapper_chat_model.py`, a minimal `BaseChatModel` wrapping host-wrapper's `/complete` — no tool-calling API of its own, which is fine since the structured-chat agent doesn't need one). `AgentService.reload_llm()` rebuilds LLM + agent in-process (MCP session untouched) — called by `routers/settings.py`'s mode-switch endpoint, so a mode change takes effect on the very next message, no restart.
- **HTTP** `POST /api/ai/chat/` → `AgentService.process_message()` → `AgentExecutor.ainvoke({"input", "chat_history": []})` → `{"output": str}` (shape changed from the old LangGraph `{"messages":[...]}`; no known frontend consumer of this endpoint's response shape).
- **WebSocket** `WS /api/ai/chat/ws` → **stateless, client-authoritative**. The browser owns the transcript (sessionStorage) and replays it each turn as `{type:'chat', friendId, messages:[{role,content}...]}`. `_build_messages` normalizes it, caps to `MAX_HISTORY=50`, and stamps `[Active friend_id=N]` on the latest user turn → `AgentService.stream_message(messages)` (converts prior turns to a `HumanMessage`/`AIMessage` list for the prompt's `chat_history`, last turn becomes `input`) → `AgentExecutor.astream_events(version="v2")` (same LangChain Core callback event taxonomy LangGraph used — `on_chat_model_*`/`on_tool_*` — so this event-handling code is agent-implementation-agnostic). (`{type:'context'}` = first-open greeting; raw text = single turn.) No server-side memory — reconnects lose nothing. Each event becomes a WS frame: `thinking` / `token` (streamed answer deltas) / `tool_call{name,args}` / `tool_result{name,result}` / terminal `ai_response` / `error`. Terminal text is taken from the **last model turn's content**, falling back to assembled tokens — not `messages[-1]` (which can be a tool message). Every step logs a `TRACE …` line.
- **Small-model reliability, confirmed live:** `llama3.2:3b` (mode=ollama) can hit `AgentExecutor`'s `max_iterations` cap (6, trimmed from LangChain's default 10 so a stuck model fails faster) trying to produce a valid JSON action blob for a tool call, and give up. Verified this is a model-capability limit, not an agent bug, by running the identical tool-calling query through cloud mode (host-wrapper) and getting a correct response immediately. Plain non-tool chat works fine in ollama mode either way.

`GET /api/ai/chat/tools` lists agent tools; `GET /api/ai/knowledge/tools` lists knowledge tools. `GET/PUT/DELETE /api/ai/settings/llm*` — mode + provider keys, see [AI Settings flow](../flows/ai-settings.md).

## Seams

**Inbound:**

| Caller | Trigger | Endpoint |
|---|---|---|
| React UI (via nginx `/api/ai/`) | user asks to summarize a friend's facts | `POST /knowledge/summarize` |
| React UI (WebSocket via nginx) | live chat | `WS /chat/ws` |
| React UI | one-shot chat / tool list | `POST /chat/`, `GET /chat/tools`, `GET /knowledge/tools` |

**Outbound:**

| Callee | Why | How / where |
|---|---|---|
| **friend** (`http://communicator-app:8080/api/friend`, **DIRECT — not via nginx**) | pull knowledge + full texts + ids | `FriendApiService`: `/getKnowledge/{fid}/page/{p}/size/{s}`, `/getKnowledgeText/{id}`, `/getKnowledgeIds/{fid}` — config `friend_service.base_url`. **Fixed 2026-07-23** — was `http://friend:8085`, dead since the 2026-07-12 JVM consolidation; every call had been silently failing DNS resolution (errors swallowed → empty results, nothing crashed) until found while testing chat tool-calling. |
| **knowledgeMCP** (in-process stdio subprocess, NOT a network call) | agent tools (MCP) | `MCPService` → `MultiServerMCPClient({"knowledge": {"transport": "stdio", ...}})`, spawns `knowledgeMCP/knowledgeMCP.py` directly — no `mcp-knowledge-server` container, no `mcp.server_url` HTTP path (that config key is stale/unused; corrected here 2026-07-23) |
| **embedder** (`http://embedder:8010`, own service — see [embedder/PROTO.md](../embedder/PROTO.md)) | embeddings (ONNX EmbeddingGemma, 768-dim, prompt-asymmetric doc/query) | `EmbeddingService` `POST /embed {texts, kind}`, Redis-cached (cache key includes `kind` — doc/query embeddings of the same text differ and must not collide) |
| **Postgres/ParadeDB** (`postgresDB:5432`, same DB the JVM app uses) | persist chunks/embeddings/facts/references/llm settings | `PostgresRepository` (asyncpg + pgvector), `databases.postgres.dsn` |
| **Redis** (`redisCache:6379`) | summary-cached flags + embedding cache | `RedisRepository`, `databases.redis.url` |
| **Ollama** (`http://ollama:11434`) | local chat LLM (mode=ollama, default) | `ChatOllama`, model `llm.ollama_chat_model` (currently `llama3.2:3b`) |
| **host-wrapper** (`http://host-wrapper:5011`, own containerized service — see [host-wrapper/PROTO.md](../host-wrapper/PROTO.md)) | cloud chat LLM (mode=cloud): Gemini/GitHub Models/Mistral/Groq/DeepSeek/Anthropic, priority-ordered failover | `HostWrapperChatModel` → `POST /complete`; settings saves also hit `POST /admin/reload` |

## Gotchas / Technology Notes

- **~~Dual/confused LLM auth~~ SUPERSEDED (2026-07-23).** `_setup_llm` used to hardcode `ChatGoogleGenerativeAI` and previously crash-looped over a bogus service-account path (fixed earlier in that day), then over a hard `GEMINI_API_KEY` requirement (fixed later the same day). Both are now moot — `_setup_llm` doesn't call Gemini directly at all anymore, it builds `ChatOllama` or `HostWrapperChatModel` per `llm_settings.mode`. `GEMINI_API_KEY` isn't read by ai_agent at all now; host-wrapper owns it (`host-wrapper/.env` or the DB-configured key).
- **Calls friend DIRECTLY at `communicator-app:8080/api/friend`, bypassing nginx** — the opposite of chrono (which goes through nginx). Two services, two conventions for reaching the same friend service. Also: the endpoints it needs (`/getKnowledgeText/{id}`, `/getKnowledgeIds/{fid}`, `/getKnowledge/{fid}/page/{p}/size/{s}`) live in friend's `FriendKnowledgeController` — if those change shape, summarization breaks silently (FriendApiService swallows errors → returns `[]`/`None` — exactly how this URL sat broken and undetected from 2026-07-12 until 2026-07-23, see the Seams table above).
- **The summarize call is one big synchronous blocking request.** For a friend with K knowledge items and F parsed facts it does: K text fetches + chunking + K-ish embedding calls + 1 summary LLM call + **F search+validate LLM calls**. That's many LLM round-trips inside a single HTTP POST — slow, no job queue, no progress stream (chat has WS; summarize does not). A large friend can take minutes / time out at nginx (300s). Mode=ollama makes this worse (slower per-call than a cloud API); mode=cloud (host-wrapper) is closer to the original Gemini-direct latency.
- **Kafka is provisioned but this service doesn't use it.** Compose runs `kafka`/`kafka-ui` "for event sourcing," but no producer/consumer appears in the ai_agent code read — the knowledge pipeline is synchronous HTTP, not event-driven. `[event bus UNWIRED]` — likely aspirational.
- **~~Two vector layers~~ CONSOLIDATED (2026-07-23).** Used to be pgvector (Spring side, unused) + FAISS-in-RAM (this service) + Ollama for embeddings, three overlapping systems. Now: one Postgres instance, `chunk_embeddings.embedding vector(768)` + `knowledge_chunks.chunk_text` (BM25-indexed via `pg_search`), hybrid-searched with RRF. No in-memory index — every search is a live Postgres query scoped by `knowledge_id`. **Model swap consequence:** embeddings went 384d (Ollama all-minilm) → 768d (EmbeddingGemma) — not compatible dimensions, but moot since both Mongo collections were empty when this migration ran (no re-embed needed, started fresh).
- **pg_search gotcha:** don't write `chunk_text @@@ $2` with a raw query string — it runs through ParadeDB's query mini-language and errors on ordinary punctuation (apostrophes, question marks) in natural-language queries. Use `chunk_id @@@ paradedb.match('chunk_text', $2)` instead, which treats the param as literal text. Bit `SearchService.search()` once; fixed.
- **`re_evaluate_fact` is half-implemented** — deletes old references then just logs "re-evaluated" without re-creating them (`# For now, just log`). Calling it degrades a fact. `[PARTIALLY IMPLEMENTED]`
- **~~Ollama container is still running, deliberately unused~~ NOW ACTIVE (2026-07-23).** The earlier "unused pending a privacy decision" note is stale — Ollama is the **default** chat/summarize LLM now (`mode=ollama`), via `ChatOllama` + `llama3.2:3b`. What's still deferred is a *separate* conversation about Ollama specifically and privacy/data-handling that hasn't happened — not whether it's wired in (it is), but whether its current wiring is the final word on that question.
- **Validation trusts the LLM's own JSON.** `FactValidationService` strips markdown fences and `json.loads` the model output; a malformed response → fact auto-fails (`is_valid=False`). If knowledge-text fetch fails entirely, the fact is **auto-validated at confidence 0.5** (`FactService` "proceed without validation") — a fetch outage silently lowers the quality bar instead of erroring.
- **No auth**; CORS from `config.yaml security.cors`. Anything reaching `/api/ai/` (or `ai-agent:8001` on the docker net) can drive the agent and spend LLM quota — Ollama compute if mode=ollama, a cloud provider's free tier if mode=cloud.
- **Eager startup coupling.** `main.py` startup builds the agent → inits MCP with retries (`mcp.retry_attempts`) — this is the in-process stdio subprocess, not a network dependency, so it's really "if `knowledgeMCP.py` fails to spawn/handshake past the retry budget." LLM setup itself doesn't share this hard-fail behavior — a Postgres hiccup reading `llm_settings.mode` degrades to the ollama default rather than blocking startup.

## Change Index

| Thing to change | Where |
|---|---|
| Summarization workflow | `KnowledgeService.summarize_friend_knowledge()` |
| Fact validation threshold | `config.yaml referencing.min_validation_confidence` → `FactValidationService.meets_threshold` |
| Refs per fact / discard-if-none | `config.yaml referencing.max_references_per_fact` / `discard_if_no_references` |
| Chunking (word window/overlap/mode) | `config.yaml chunking.*` → `ChunkingService` |
| Search top-k / candidates-per-side / RRF k / min relevance | `config.yaml search.*` → `SearchService` (RRF score scale is ~0-0.033, not cosine similarity — see `config.yaml` comment) |
| Embedding model / embedder URL / cache | `config.yaml embedding.*` → `EmbeddingService` (points at the standalone `embedder` service, port 8010) |
| LLM mode (local/cloud) | `PUT /api/ai/settings/llm/mode` or the [AI Settings page](../nginx/static/settings/settings.html) — see [AI Settings flow](../flows/ai-settings.md) |
| Local model / temperature | `config.yaml llm.ollama_chat_model`/`temperature` → `AgentService._setup_llm` (pull the model in `docker-compose.yml` ollama `command` too) |
| Cloud provider keys / priority | Settings page, or `PUT /api/ai/settings/llm/providers/{name}` → Postgres `llm_provider_keys` → `host-wrapper/llm_router.py TEXT_PRIORITY` |
| Friend service URL/timeout | `config.yaml friend_service.base_url` (`http://communicator-app:8080/api/friend`, direct) → `FriendApiService` |
| MCP tool implementations | in-process — `ai_agent/knowledgeMCP/knowledgeMCP.py` (spawned by `mcp_service.py` as a stdio subprocess, not a separate service) |
| Postgres / Redis connection | `config.yaml databases.postgres.dsn` / `databases.redis.*` |
| Chunk/embedding/fact/settings schema | `ai_agent/db/schema.sql` (applied idempotently at startup, `CREATE ... IF NOT EXISTS` only) |
| Cache TTLs | `config.yaml cache.*` (`friend_summary_ttl`, embedding TTL) |
| Summary prompt / fact parsing | `prompts/summary_prompt_service.py` |
| Chat agent behaviour / tool-call prompt | `AgentService._create_agent` (`_SYSTEM_PROMPT`/`_HUMAN_PROMPT`, `max_iterations`) |
| Chat WS streaming/states/traces | `AgentService.stream_message` (astream_events v2) + `routers/chat.py _build_messages` |
| Public route (+WebSocket) | `nginx/nginx.conf location /api/ai/` |
