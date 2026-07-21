# AI Agent — Proto (RAG + fact-validation pipeline)

> **Proto, not a flow.** The user-facing "generate a friend's knowledge summary" and "chat about a friend" pipelines are in [flows/](../flows/). This maps the internals + the many external seams (Gemini, Ollama, Mongo, Redis, MCP, friend).

Files: main.py, routers/chat.py, routers/knowledge.py, services/{agent,knowledge,fact,fact_validation,chunking,embedding,search,friend_api,knowledge_cache,mcp}_service.py, repositories/{mongo,redis,fact}_repository.py, prompts/{prompt_manager,summary_prompt_service}.py, config/settings.py (+ config/config.yaml), dependencies/deps.py

## Role

The **AI brain**. FastAPI service, internal port **8001** (container `ai-agent`), nginx route `/api/ai/` (the only route with WebSocket upgrade). Two jobs:

1. **Chat** — a LangGraph ReAct agent (Gemini + MCP tools) you converse with over HTTP or WebSocket.
2. **Knowledge summarization** — turn a friend's raw knowledge notes into **validated, referenced key-value facts** (a RAG pipeline with AI fact-checking), stored in Mongo, cached in Redis.

`depends_on: mcp-knowledge-server, ollama`. Loads `ai_agent/.env` (secrets) + `config/config.yaml` (everything else). DI is wired in `dependencies/deps.py`; `main.py startup` eagerly builds the agent (fails hard if MCP/LLM won't init).

## Internal wiring — knowledge summarization (the crown jewel)

`POST /api/ai/knowledge/summarize {friend_id}` → `KnowledgeService.summarize_friend_knowledge()`:

```
1. cache_service.is_summary_cached(friend_id)?          Redis  → yes: return facts from Mongo (get_friend_facts_with_references)
2. friend_api_service.fetch_knowledge_paginated(fid)    HTTP → friend:8085 /getKnowledge/{fid}/page/0/size/N
   (empty → store empty summary, cache, return)
2.5 LAZY CHUNKING  _ensure_knowledge_chunked():
     per knowledge item: fetch_knowledge_text(id)       HTTP → friend:8085 /getKnowledgeText/{id}
       chunks exist in Mongo knowledge_chunks?  no → chunking_service.process_knowledge() (word-window chunks)
2.6  chunking_service.ensure_embeddings_exist(chunkIds) → embedding_service (Ollama) → cache vectors (Redis)
3. prompt_service.generate_summary(knowledge, llm)      Gemini  → freeform summary
4. prompt_service.parse_summary_to_facts()              → List[(key, value)]
5. per fact: fact_service.create_fact_with_references(fid, key, value):
     a. search_service.search(fid, "key is value")      FAISS over friend's chunk embeddings → [(chunk_id, score)]
        (no hits + discard_if_no_references → DROP fact)
     b. take top max_references_per_fact chunks → knowledge_ids
     c. friend_api_service.fetch_knowledge_texts_batch() HTTP → friend:8085 (asyncio.gather)
     d. validation_service.validate_fact(key,value,texts) Gemini → {is_valid, confidence, reasoning} (STRICT json)
     e. is_valid AND confidence ≥ min_validation_confidence?  no → DROP fact
     f. fact_repository.save_fact() + insert fact_references (chunk_id, knowledge_id, score, rank)  Mongo
6. cache_service.cache_summary(friend_id)               Redis
7. return get_friend_facts_with_references()            Mongo facts + reconstructed chunk texts (for UI tooltips)
```

**Mongo collections** (`generated_db` in the `generatedData` mongo container): `friend_summaries` (facts per friend), `knowledge_chunks` (chunk metadata + positions), `fact_references` (fact→chunk links w/ scores).

## Internal wiring — chat

- **HTTP** `POST /api/ai/chat/` → `AgentService.process_message()` → LangGraph `.ainvoke()` → one `{response}` blob (unchanged).
- **WebSocket** `WS /api/ai/chat/ws` → `_parse_envelope(raw)` unwraps the client's JSON `{type,message,friendId}` into the actual user text (prefixing `[Active friend_id=N]` for chat) → `AgentService.stream_message()` → LangGraph `.astream_events(version="v2")`. Each event becomes a WS frame: `thinking` / `token` (streamed answer deltas) / `tool_call{name,args}` / `tool_result{name,result}` / `trace` (tool-call decisions) / terminal `ai_response` / `error`. Terminal text is taken from the **last model turn's content**, falling back to assembled tokens — not `messages[-1]` (which can be a tool message). Every step logs a `TRACE …` line. `_extract_text()` collapses Gemini's list-or-string content.

`GET /api/ai/chat/tools` lists agent tools; `GET /api/ai/knowledge/tools` lists knowledge tools.

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
| **friend** (`http://friend:8085`, **DIRECT — not via nginx**) | pull knowledge + full texts + ids | `FriendApiService`: `/getKnowledge/{fid}/page/{p}/size/{s}`, `/getKnowledgeText/{id}`, `/getKnowledgeIds/{fid}` — config `friend_service.base_url` |
| **knowledgeMCP** (`mcp-knowledge-server:8000`) | agent tools (MCP) | `MCPService` → `MultiServerMCPClient` streamable_http, `mcp.server_url` |
| **Ollama** (`http://ollama:11434`) | embeddings (`all-minilm-l6-v2`, 384-dim) | `EmbeddingService` `/api/embeddings`, Redis-cached |
| **MongoDB** (`generatedData:27017`) | persist facts/chunks/references | `MongoRepository`, `databases.mongodb.url` |
| **Redis** (`redisCache:6379`) | summary-cached flags + embedding cache | `RedisRepository`, `databases.redis.url` |
| **Google Gemini** (cloud) | summary + fact validation + chat LLM | `ChatGoogleGenerativeAI`, **service-account creds** (`/app/service-account-key.json`), model `llm.model` |

## Gotchas / Technology Notes

- **Dual/confused LLM auth.** `settings.py` **requires `GEMINI_API_KEY` to exist** (raises at import if unset) — but `AgentService._setup_llm` passes `google_api_key=None` and sets `GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json`, so it actually authenticates via a **baked service-account key**, not the API key. You need BOTH present or startup fails, even though only one is used. Secret file is COPY'd into the image.
- **Calls friend DIRECTLY at `friend:8085`, bypassing nginx** — the opposite of chrono (which goes through nginx). Two services, two conventions for reaching the same friend service. Also: the endpoints it needs (`/getKnowledgeText/{id}`, `/getKnowledgeIds/{fid}`, `/getKnowledge/{fid}/page/{p}/size/{s}`) live in friend's `FriendKnowledgeController` — if those change shape, summarization breaks silently (FriendApiService swallows errors → returns `[]`/`None`).
- **The summarize call is one big synchronous blocking request.** For a friend with K knowledge items and F parsed facts it does: K text fetches + chunking + K-ish embedding calls + 1 summary LLM call + **F search+validate LLM calls**. That's many Gemini round-trips inside a single HTTP POST — slow, no job queue, no progress stream (chat has WS; summarize does not). A large friend can take minutes / time out at nginx (300s).
- **Kafka is provisioned but this service doesn't use it.** Compose runs `kafka`/`kafka-ui` "for event sourcing," but no producer/consumer appears in the ai_agent code read — the knowledge pipeline is synchronous HTTP, not event-driven. `[event bus UNWIRED]` — likely aspirational.
- **Two vector layers.** Embeddings live in Redis cache AND are indexed in FAISS (`SearchService`, `search.faiss_index_type`) per friend, while chunk *metadata* lives in Mongo. Postgres also has pgvector (for the Spring side) — so the system has pgvector + FAISS + Ollama all in play. Consolidation/clarity target.
- **`re_evaluate_fact` is half-implemented** — deletes old references then just logs "re-evaluated" without re-creating them (`# For now, just log`). Calling it degrades a fact. `[PARTIALLY IMPLEMENTED]`
- **Validation trusts the LLM's own JSON.** `FactValidationService` strips markdown fences and `json.loads` the model output; a malformed response → fact auto-fails (`is_valid=False`). If knowledge-text fetch fails entirely, the fact is **auto-validated at confidence 0.5** (`FactService` "proceed without validation") — a fetch outage silently lowers the quality bar instead of erroring.
- **No auth**; CORS from `config.yaml security.cors`. Anything reaching `/api/ai/` (or `ai-agent:8001` on the docker net) can drive the agent and spend Gemini quota.
- **Eager startup coupling.** `main.py` startup builds the agent → inits MCP with retries (`mcp.retry_attempts`). If `mcp-knowledge-server` is down past the retry budget, **ai-agent fails to start** (raises in startup_event).

## Change Index

| Thing to change | Where |
|---|---|
| Summarization workflow | `KnowledgeService.summarize_friend_knowledge()` |
| Fact validation threshold | `config.yaml referencing.min_validation_confidence` → `FactValidationService.meets_threshold` |
| Refs per fact / discard-if-none | `config.yaml referencing.max_references_per_fact` / `discard_if_no_references` |
| Chunking (word window/overlap/mode) | `config.yaml chunking.*` → `ChunkingService` |
| Search top-k / FAISS type / min relevance | `config.yaml search.*` → `SearchService` |
| Embedding model / Ollama URL / cache | `config.yaml embedding.*` → `EmbeddingService` (compose ollama pulls the model) |
| LLM model / temperature | `config.yaml llm.*` → `AgentService._setup_llm` |
| LLM credentials | `ai_agent/.env GEMINI_API_KEY` (must exist) + `ai_agent/service-account-key.json` (actually used) |
| Friend service URL/timeout | `config.yaml friend_service.base_url` (`http://friend:8085`, direct) → `FriendApiService` |
| MCP server URL / retries | `config.yaml mcp.server_url` / `retry_attempts` → `MCPService` |
| Mongo / Redis connection | `config.yaml databases.mongodb|redis.*` |
| Cache TTLs | `config.yaml cache.*` (`friend_summary_ttl`, embedding TTL) |
| Summary prompt / fact parsing | `prompts/summary_prompt_service.py` |
| Chat agent behaviour | `AgentService.process_message` / `create_react_agent` tools (from MCP) |
| Chat WS streaming/states/traces | `AgentService.stream_message` (astream_events v2) + `routers/chat.py _parse_envelope` |
| Public route (+WebSocket) | `nginx/nginx.conf location /api/ai/` |
