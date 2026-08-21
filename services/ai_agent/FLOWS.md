# FLOWS: ai_agent

Three flows through this service, merged into one file since none of them has its own subdirectory to live next to (ai_agent is flat: `services/`, `routers/`, `models/`, etc.). See [PROTO.md](PROTO.md) for the module's own Role/Internal-wiring/Seams breakdown.

- [AI Settings](#ai-settings-localcloud-mode-switch--provider-keys) — local/cloud mode switch + provider keys
- [Chat](#chat-with-the-ai-agent-structured-chat-agent--mcp-tools) — the structured-chat agent + MCP tools
- [Knowledge → Validated Facts](#knowledge--validated-facts-the-rag--fact-checking-pipeline) — the RAG + fact-checking pipeline

---

## AI Settings (local/cloud mode switch + provider keys)

Lets you choose whether chat and knowledge summarization run entirely on this machine (Ollama, private, slower) or through a multi-provider cloud gateway with failover (host-wrapper, faster, higher quality, third-party data exposure). **UI → nginx → ai_agent → Postgres (+ host-wrapper for cloud provider status/reload)**.

Protos: [ai_agent](PROTO.md) · [host-wrapper](../host-wrapper/PROTO.md) · [nginx spine](../nginx/PROTO.md). Determines which LLM the [chat flow](#chat-with-the-ai-agent-structured-chat-agent--mcp-tools) actually uses.

### The pipeline

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

### What each store holds

| Store | Holds |
|---|---|
| **Postgres `llm_settings`** | Singleton row: current mode (`ollama` or `cloud`), default `ollama` |
| **Postgres `llm_provider_keys`** | One row per configured cloud provider, `encrypted_key BYTEA` (AES-256-GCM) |
| **host-wrapper's in-memory Router** | Rebuilt on `/admin/reload` from Postgres + its own `.env` fallback; cooldown/rate-limit state resets on rebuild (acceptable — key changes are rare) |
| **ai_agent's `AgentService`** | Holds the currently-built LLM + agent object; rebuilt by `reload_llm()`, not persisted (re-reads mode from Postgres on every ai_agent restart) |

**Achieves:** a runtime-switchable, UI-driven privacy/quality tradeoff for every LLM call this app makes, without redeploying anything — confirmed live by switching modes mid-session and watching the very next chat request use the new LLM.

### Notes

- **Mode is global, not per-purpose.** One switch affects chat, knowledge summarization, and fact validation alike — a deliberate simplification over per-feature provider choice (this was a real fork discussed and decided in favor of the simpler design).
- **Cloud mode needs host-wrapper actually running.** It's a normal docker-compose service now (containerized 2026-07-23 — see host-wrapper's proto for why it used to be host-only and what changed), so `docker compose up` starts it automatically, but if it's down, cloud mode chat requests fail rather than silently falling back to local. The settings page's reachability indicator exists specifically to surface this before it surprises you mid-chat.
- **The two secrets involved don't overlap.** `AI_SETTINGS_ENCRYPTION_KEY` (must match in `ai_agent/.env` and `host-wrapper/.env`) encrypts/decrypts the *provider keys stored in Postgres*. The provider keys themselves (Gemini, GitHub, etc.) are a completely separate secret domain — one derives a symmetric cipher key, the others authenticate to third-party APIs.
- **Ollama's local model is genuinely small (3B params) for CPU-inference speed**, and it's not always reliable at the strict JSON tool-calling format the chat agent needs — see the [chat flow](#chat-with-the-ai-agent-structured-chat-agent--mcp-tools)'s notes. Plain conversation works fine regardless.

### Change Index

| Want to change | Where |
|---|---|
| Default mode | `ai_agent/db/schema.sql` `llm_settings` seed row |
| Known cloud providers | `ai_agent/repositories/llm_settings_repository.py` `KNOWN_PROVIDERS` (must match `host-wrapper/llm_router.py`'s provider names) |
| Encryption passphrase | `AI_SETTINGS_ENCRYPTION_KEY` in both `ai_agent/.env` and `host-wrapper/.env` — must match |
| Settings API | `ai_agent/routers/settings.py` |
| Settings UI | `nginx/static/settings/settings.{html,css,js}` |
| Local model swap | `config.yaml llm.ollama_chat_model` + pull it in `docker-compose.yml` ollama `command` |
| Cloud provider priority/failover | `host-wrapper/llm_router.py` `TEXT_PRIORITY`/`VISION_PRIORITY` |

---

## Chat with the AI agent (structured-chat agent + MCP tools)

Conversational access to your CRM: ask the agent about a friend and it uses **MCP tools** to read/write the friend service, reasoning with whichever LLM `llm_settings.mode` currently picks — local Ollama, or cloud via host-wrapper's multi-provider fanout (see [AI Settings flow](#ai-settings-localcloud-mode-switch--provider-keys)). **UI (WebSocket) → nginx → ai_agent → (in-process knowledgeMCP stdio) → nginx → friend**. (knowledgeMCP runs inside ai_agent as of 2026-07-13 — no separate container.)

> **2026-07-23: agent architecture changed, not just the model source.** Was LangGraph's `create_react_agent` (needs native LLM tool-calling). Now `langchain_classic`'s `create_structured_chat_agent` — a JSON-action-blob ReAct variant that works with ANY plain-text-completion LLM, deliberately, so tool access doesn't depend on whether the current mode's LLM supports native `.bind_tools()`. Hit and fixed a real incompatibility getting here: MCP tools are multi-arg `StructuredTool`s, and the plain-ReAct agent's single-string "Action Input" can't drive those at all.

Protos: [ai_agent](PROTO.md) · [host-wrapper](../host-wrapper/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md). (knowledgeMCP's own proto is stale — see note below.)

### The pipeline (WebSocket path — the real-time one)

```
Browser opens WebSocket  ws://localhost:8090/api/ai/chat/ws
 → nginx location /api/ai/  (Upgrade/Connection headers — the ONLY route with WS)  ─► ai-agent:8001/chat/ws
 → chat.py websocket_endpoint: loop receive_text()   (STATELESS — no server memory)
     → client sends {type:'chat', friendId, messages:[{role,content}...]}  ← FULL transcript
        (the browser owns it in sessionStorage; server never stores it)
     → _build_messages(payload): normalize + _cap_history (≤50) + stamp
        `[Active friend_id=N]` on the latest user turn (NOT the raw JSON)
     → AgentService.stream_message(messages)   ← replayed each turn = the "memory"
        → create_structured_chat_agent(llm, mcp_tools).astream_events(v2)
             llm = ChatOllama (mode=ollama, default) or HostWrapperChatModel (mode=cloud)
             per event → WS frame (state machine, not one blob):
               on_chat_model_start  → {type:"thinking"}
               on_chat_model_stream → {type:"token", content:delta}  (+ {type:"trace"} on tool decision)
               on_tool_start        → {type:"tool_call",  name, data:args}
                 MCP tool call ─► in-process knowledgeMCP (stdio subprocess of ai_agent)
                   e.g. get_friend_knowledge(fid) ─► http://nginx/api/friend/getKnowledge/...
                                                 ─► communicator-app:8080 → Postgres
                   e.g. create_friend_knowledge(fid,fact,importance) ─► POST /api/friend/addKnowledge/{fid}
               on_tool_end          → {type:"tool_result", name, data:result}
             stream end → {type:"ai_response", content: full answer}   (careful extraction: last
                          model turn's content, NOT messages[-1]); on failure → {type:"error"}
```

Every event is also logged server-side as a `TRACE …` line (see the LLM's thoughts / tool decisions). HTTP one-shot alternative: `POST /api/ai/chat/` → still `process_message` (single blob, unchanged). `GET /api/ai/chat/tools` lists the agent's MCP tools.

### The tool surface (what the agent can actually do)

From [knowledgeMCP](knowledgeMCP/PROTO.md) — all proxy to friend via nginx:
`get_friend_knowledge` · `create_friend_knowledge` · `update_friend_knowledge` · `get_friend_analytics` · `calculate_friend_moving_averages` · `get_friends_list`.

**Achieves:** natural-language CRUD over friends' knowledge + analytics, with the LLM choosing tools. Writes done here (e.g. `create_friend_knowledge`) land as real knowledge rows — which then feed the [knowledge-RAG flow](#knowledge--validated-facts-the-rag--fact-checking-pipeline).

### Notes (from protos)

- **Startup coupling:** ai_agent builds its toolset from knowledgeMCP at boot with retries; if MCP is down past the budget, **ai_agent won't start**. So this flow's availability gates the whole ai_agent service.
- **Two hops to friend, mixed conventions:** agent → MCP → **nginx** → friend. But ai_agent's *own* knowledge pipeline calls friend **directly**. Same backend, two routes.
- **External clients:** ~~the same MCP server is reachable at nginx `/api/mcp/knowledge/`~~ — that claim is stale (describes the pre-2026-07-13 standalone `mcp-knowledge-server` container; no such nginx location exists now, knowledgeMCP is an in-process stdio subprocess with no network listener at all). `ai_agent/knowledgeMCP/PROTO.md` still describes the old architecture throughout — needs a real rewrite, not done here (out of scope for this session, found while fixing an adjacent stale reference).
- **WS now streams a state machine** (2026-07-21): `thinking → tool_call/tool_result → token… → ai_response` (or `error`), plus `trace` frames carrying the agent's tool-call decisions. Token streaming is live (`astream_events` v2). The HTTP one-shot path (`process_message`) is still a single blob. **The client used to feed the raw JSON envelope to the LLM** — now `_parse_envelope` extracts `.message` and injects `friend_id`.
- **Conversation memory** (2026-07-21): the LangGraph graph is **stateless** — before this, every message started from scratch (no memory of the chat). Fixed **client-side**: the browser stores the transcript in **sessionStorage** (`AiChat` in `aiChat.js`) and replays the full `messages` array each turn; the server just re-runs the agent over it. Deliberately simple (no summarizer/window model) — this agent is chit-chat.
- **Debug traces:** server logs every step as `TRACE …`; the UI shows tool calls + LLM thoughts as grey lines when `AiChat.debug` (default on). Set `AiChat.debug = false` to hide the trace lines (still console-logged).
- **Mode switch is live, no restart:** `PUT /api/ai/settings/llm/mode` calls `AgentService.reload_llm()` in-process — rebuilds just the LLM + agent, MCP session/tools untouched. Confirmed live: switched ollama→cloud mid-session and the very next chat request used the new LLM.
- **Small local models can fail the JSON-blob format under load.** Confirmed live: `llama3.2:3b` sometimes hits `AgentExecutor`'s `max_iterations` cap (6) trying to invoke a tool, rather than emitting a valid action blob — verified this is a model-capability limit, not an agent bug, by running the identical query through cloud mode and getting a correct tool call immediately. Plain (non-tool) chat in ollama mode works fine either way.

### Technology Notes

- **Chat memory lives in the browser's sessionStorage, keyed `frm_chat:<friendId>`.** Lifecycle is deliberately the sessionStorage contract: **survives page reload**, **wiped by the browser on tab close**, and `dropOtherFriendChats()` clears other friends' keys on open (so opening a new friend drops the old chat). Consequences: NOT durable across tab close, NOT synced across tabs/devices, ~5 MB cap, string-only. If durable/cross-device memory is ever wanted, persist the transcript to Postgres (a `conversation` table) — do NOT reach for IndexedDB just to "keep on close", that fights the chosen lifecycle.
- **Server is stateless / client-authoritative.** The browser replays the whole transcript each turn; the WS handler holds no memory, so reconnects (tab refocus, network blips, ai_agent restart) lose nothing as long as the tab lives. `friend_id` is stamped onto the latest user turn server-side (`_build_messages`).
- **Whole transcript is re-sent to Gemini every turn** — cost/latency grow linearly with turn count. Capped at `MAX_HISTORY=50` (`_cap_history`, keeps first turn + most recent) as a runaway guard, not a real context-window strategy.
- **Only user/assistant text is remembered, not tool calls.** Intermediate `tool_call`/`tool_result` steps are streamed to the UI but never stored; each turn the agent re-decides tools fresh from the visible Q&A. It won't "remember" a specific tool result unless it surfaced in its answer.

### Change Index

| Want to change | Where |
|---|---|
| Agent behaviour | `AgentService` + `config.yaml llm.*` |
| Local vs. cloud LLM | [AI Settings page](#ai-settings-localcloud-mode-switch--provider-keys) (`/settings/settings.html`) or `PUT /api/ai/settings/llm/mode` directly |
| Local model | `config.yaml llm.ollama_chat_model` (+ pull it in `docker-compose.yml` ollama `command`) |
| ReAct prompt / tool-call format | `agent_service.py` `_SYSTEM_PROMPT`/`_HUMAN_PROMPT` + `max_iterations` |
| WS state events / streaming | `AgentService.stream_message` (astream_events v2) + `routers/chat.py` |
| Client envelope → message | `routers/chat.py _parse_envelope` |
| Chat transcript store / lifecycle | `aiChat.js` sessionStorage (`STORE_PREFIX`, `persist`, `dropOtherFriendChats`) |
| Transcript → agent messages / cap | `routers/chat.py _build_messages` + `_cap_history` (`MAX_HISTORY`) |
| Which states the UI renders | `aiChat.handleMessage` + `aiChatUI` stream/trace methods |
| Show/hide thought traces | `AiChat.debug` (aiChat.js) |
| Available tools | `knowledgeMCP.py @mcp.tool()` functions |
| MCP connection | in-process stdio — `mcp_service.py` spawns `knowledgeMCP/knowledgeMCP.py` (no `server_url`/HTTP) |
| WebSocket routing | `nginx/nginx.conf location /api/ai/` (Upgrade headers) |

---

## Knowledge → Validated Facts (the RAG + fact-checking pipeline)

Turn a friend's messy free-text knowledge notes into **structured, AI-validated, source-referenced key-value facts**. This is the most cross-service pipeline in the system: **UI → nginx → ai_agent → {friend, embedder, Postgres/ParadeDB, Redis, Gemini}**.

Protos for mechanics: [ai_agent](PROTO.md) · [embedder](../embedder/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md). Raw facts come from Stage 1 of the [relationship lifecycle](../friend/src/main/java/communicate/Friend/FLOWS.md).

> **2026-07-23: Mongo + FAISS + Ollama retired from this pipeline.** Chunks, embeddings, facts, and fact-references all moved to Postgres/ParadeDB (same instance the JVM app uses). Search is now hybrid pgvector + BM25 (RRF-fused) instead of an in-memory FAISS index. Embeddings come from a new standalone `embedder` service (ONNX EmbeddingGemma, 768-dim) instead of Ollama — the Ollama container itself still runs, just unused by this pipeline; a privacy-motivated Ollama-for-chat decision is a separate, not-yet-had conversation.

> **2026-08-20: `knowledge_chunks` is no longer Friend-only.** Group and Connection knowledge now feed the same table (tagged by `source_type`), populated by a *second*, separate multi-module flow — see [Eager multi-entity chunking](#eager-multi-entity-chunking) below. That flow also adds cross-entity search (`POST /api/ai/search`), which finds a Friend/Group/Connection by its recorded facts instead of by name. It reuses this pipeline's chunk/embedding/RRF machinery but is not part of the summarize-a-friend walkthrough below — kept in this section rather than a separate file because it shares the exact same Postgres tables and hybrid-search math. Deep mechanics for both live in [ai_agent PROTO.md](PROTO.md#internal-wiring--cross-entity-search-2026-08-20).
>
> **2026-08-21: the eager trigger for that flow moved off fire-and-forget HTTP onto durable RabbitMQ**, closing the silent-data-loss gap called out below — Group/Connection knowledge no longer permanently loses its chunks if ai-agent happens to be down at save time. See the updated [Eager multi-entity chunking](#eager-multi-entity-chunking) section.

### The pipeline

```
User clicks "summarize {friendId}"  (validation page)
 → POST http://localhost:8090/api/ai/knowledge/summarize {friend_id}
 → nginx  location /api/ai/  (CORS + WebSocket-capable) ─►  ai-agent:8001/knowledge/summarize
 → KnowledgeService.summarize_friend_knowledge(friend_id)                    [ai_agent proto]

 1. cache_service.is_summary_cached(fid)?        ── Redis (redisCache:6379)
      HIT → return facts from Postgres (skip to step 7)
 2. friend_api_service.fetch_knowledge_paginated  ── HTTP → friend:8085/getKnowledge/{fid}/page/0/size/N
      (DIRECT to friend, NOT via nginx — unlike chrono/MCP)
 2.5 LAZY CHUNKING per knowledge item:
      fetch_knowledge_text(id)                   ── HTTP → friend:8085/getKnowledgeText/{id}
      chunks in Postgres knowledge_chunks?  no → ChunkingService.process_knowledge (word windows, chunk_text persisted)
 2.6 ensure_embeddings_exist(chunkIds):
      EmbeddingService → embedder (embedder:8010/embed, kind=document, EmbeddingGemma, 768-dim)
      vectors cached in Redis
 3. SummaryPromptService.generate_summary(knowledge, llm)   ── Gemini (GEMINI_API_KEY)
 4. parse_summary_to_facts()                     → [(key, value), ...]
 5. FOR EACH fact → FactService.create_fact_with_references(fid, key, value):
      a. SearchService.search(fid, "key is value")   ── hybrid: pgvector `<=>` cosine + pg_search `@@@` BM25, RRF-fused
           no hits + discard_if_no_references → DROP FACT
      b. top-k chunks → knowledge_ids
      c. fetch_knowledge_texts_batch()               ── HTTP → friend:8085 (asyncio.gather)
      d. FactValidationService.validate_fact()        ── Gemini, STRICT json {is_valid,confidence,reasoning}
      e. is_valid AND confidence ≥ min_validation_confidence?  no → DROP FACT
      f. save fact + fact_references (chunk_id, knowledge_id, score, rank)  ── Postgres
 6. cache_service.cache_summary(fid)             ── Redis
 7. get_friend_facts_with_references(fid)        ── Postgres facts + chunk_text read directly off the row (no reconstruction needed anymore)
 → JSON: { friend_id, facts:[{key,value,stability_score,validated,references:[{chunk_text,score,rank}]}], fact_count }
```

### What each store holds

| Store | Container | Holds |
|---|---|---|
| **Postgres/ParadeDB** | `postgresDB` | source of truth for friend service's own data (JVM side) **and** derived RAG data: `knowledge_chunks` (+chunk_text, BM25-indexed), `chunk_embeddings` (vector(768), HNSW), `friend_summaries` (facts, JSONB array), `fact_references` — one instance, one database, shared by the JVM app and ai_agent |
| **embedder** | `embedder` | ONNX EmbeddingGemma, computes 768-dim vectors on demand (doc/query prompt-asymmetric) |
| **Redis** | `redisCache` | "summary already generated" flags + embedding vector cache |
| **Gemini** | cloud | the LLM doing summary + validation |

`ollama` container still runs but nothing in this pipeline calls it — see the note at the top of this section.

**Achieves:** a curated fact sheet per friend where **every fact is traceable to the source note that supports it** (references with relevance scores → the UI can show "why do we believe this?" tooltips), and unsupported LLM hallucinations are **dropped** at the validation gate.

### Trust & failure notes (from the ai_agent proto)

- **The validation gate is the whole point:** a parsed fact survives only if the hybrid search finds supporting chunks AND Gemini confirms it above `min_validation_confidence`. Everything else is discarded — this is what keeps the LLM honest.
- **Silent degradation:** if the knowledge-text fetch fails, the fact is **auto-validated at confidence 0.5** instead of erroring — a friend-service hiccup lowers the quality bar rather than failing loudly.
- **Synchronous & slow:** the whole thing runs inside one HTTP POST — K text fetches + embeddings + 1 summary call + one search+validate Gemini call *per fact*. Big friends can approach nginx's 300s timeout. No progress stream (unlike [chat](#chat-with-the-ai-agent-structured-chat-agent--mcp-tools)). No Kafka despite it being provisioned.
- **Re-generation is cache-gated:** once cached in Redis, new notes won't re-summarize until the cache entry expires or is cleared (`cache.friend_summary_ttl`). `re_evaluate_fact` is only half-implemented.
- **pg_search query gotcha:** natural-language queries with punctuation (apostrophes, question marks) must go through `paradedb.match()`, not a bare `@@@ 'string'` — see [ai_agent proto](PROTO.md) gotchas.

### Change Index

| Want to change | Where |
|---|---|
| The whole pipeline | `KnowledgeService.summarize_friend_knowledge()` |
| Validation strictness | `config.yaml referencing.min_validation_confidence` |
| Drop-if-unsupported behaviour | `config.yaml referencing.discard_if_no_references` |
| Chunking granularity | `config.yaml chunking.*` |
| Embedding model | `config.yaml embedding.model` + `embedder` service (see [embedder proto](../embedder/PROTO.md)) |
| Hybrid search tuning (top-k / RRF k / candidates) | `config.yaml search.*` |
| Which friend endpoints supply text | `FriendApiService` (friend `FriendKnowledgeController`) |
| Re-summarize freshness | `config.yaml cache.friend_summary_ttl` |
| Public route | `nginx/nginx.conf location /api/ai/` |

### Eager multi-entity chunking

*(and cross-entity search — 2026-08-20)*. Unlike the summarize pipeline above, which is UI-triggered and Friend-only, this flow is triggered by the JVM apps themselves, covers all three knowledge-bearing entities, and has no UI consumer yet. Protos for mechanics: [ai_agent](PROTO.md#internal-wiring--cross-entity-search-2026-08-20).

**Why it exists:** the summarize pipeline's chunking is *lazy* and *Friend-only* — a knowledge item only gets chunked when someone summarizes that friend. Group and Connection knowledge have no summarize pipeline of their own, so without this, they'd never be searchable at all. The fix: every Friend/Group/Connection knowledge save fires an event that chunks it *eagerly*, right after the JVM commit, regardless of which entity it belongs to or whether anyone ever asks for a summary.

```
User adds/edits knowledge on a Friend, Group, or Connection   (any of the three JVM modules)
 → Friend/Group/ConnectionKnowledgeService.save/saveAll/update()   (knowledge-core AbstractFactService override point)
 → ApplicationEventPublisher.publishEvent(KnowledgeChunkTriggerEvent)
      {knowledgeId, sourceType: FRIEND|GROUP|CONNECTION, friendId|groupId|(connFriend1Id,connFriend2Id), text}
 → KnowledgeChunkTriggerListener   @TransactionalEventListener(phase = AFTER_COMMIT)
      — only fires once the DB transaction has actually committed, so a rolled-back save never chunks
 → KnowledgeChunkTriggerClient.triggerChunk()   RabbitTemplate.convertAndSend, publisher confirms
      on — writes to the channel and returns (doesn't block on the network round trip), same
      never-blocks-the-caller contract the old HTTP-only version had
      → durable queue knowledge.chunk.trigger (RabbitMQ, docker-compose)
      confirm ack  → done, broker durably has it
      confirm nack / can't reach broker at all → falls back to the old direct HTTP POST
        {ai-agent.url}/knowledge/chunk (5s connect / 15s request / 20s outer timeouts,
        never thrown, never blocks or fails the knowledge save)
 → ai_agent KnowledgeChunkConsumer (services/rabbitmq_consumer.py, aio-pika, started at app
      startup) consumes knowledge.chunk.trigger — OR, on the HTTP-fallback path,
      POST /knowledge/chunk (routers/knowledge.py chunk_knowledge, still there for direct/
      manual triggering)
 → both paths call the SAME ChunkingService.process_knowledge(source_type,
      friend_id|group_id|connection_friend*_id, text) — word-window chunks + embeddings,
      persisted to Postgres knowledge_chunks/chunk_embeddings tagged with the owning entity
      (same tables the summarize pipeline reads/writes)
 → consumer failure: republished to the same queue with an incremented x-retry-count header
      (cap 3), then to knowledge.chunk.trigger.dlq — inspectable via RabbitMQ's management UI
 → nightly backstop: chrono's ChronoJobService.reconcileMissingKnowledgeChunks() finds
      Group/Connection knowledge rows with zero knowledge_chunks rows (JdbcTemplate query,
      same Postgres instance) and republishes them through the same KnowledgeChunkTriggerClient
      — covers the JVM-crashes-between-commit-and-publish case, the one gap RabbitMQ alone
      can't close (commit and publish aren't atomic)
```

Independently, anything can now ask **"who/what do I have notes about that mention X"** across all three entities in one call:

```
POST http://localhost:8090/api/ai/search  {query, top_k}
 → nginx location /api/ai/ ─► ai-agent:8001/search
 → SearchService.search_all(query, top_k)
      pgvector `<=>` + pg_search `@@@` BM25 over ALL of knowledge_chunks (no knowledge_id scoping)
      RRF-fused (same _rrf_fuse() the per-friend search() uses)
      grouped/deduped by owning entity, keeping each entity's single best-scoring chunk
      truncated to top_k DISTINCT ENTITIES (not top_k chunks)
 → routers/search.py enriches each hit with a display name (best-effort, HTTP)
      FRIEND    → FriendApiService.fetch_friend_name()      → communicator-app:8080/api/friend/{id}
      GROUP     → GroupApiService.fetch_group_name()        → communicator-app:8080/api/groups/{id}
      CONNECTION→ both friend names via fetch_friend_name()
 → JSON: {query, count, results:[{source_type, friend_id|group_id|connection_friend*_id,
            friend_name|group_name|friend1_name/friend2_name, matched_text, score}]}
```

**Achieves:** a knowledge_chunks table that stays current for Group/Connection knowledge without anyone summarizing anything, plus a way to search across all three entity types by content rather than name.

#### Trust & failure notes

- **No lazy fallback for Group/Connection — still true.** The summarize pipeline's `_ensure_knowledge_chunked()` step only ever chunks Friend knowledge (`source_type="FRIEND"` hardcoded). What changed 2026-08-21: the eager trigger is no longer a single unretried HTTP call. RabbitMQ makes the trigger durable (survives ai-agent being down at publish time), the consumer retries transient failures (cap 3) before DLQ-ing, and chrono's nightly sweep catches the remaining JVM-crash-mid-publish gap. Net effect: a Group/Connection item can still take up to a day to get its first chunk if everything fails at once, but it's no longer possible to lose one forever.
- **Not fire-and-forget anymore, but still never blocks or fails the save.** `RabbitTemplate.convertAndSend` writes to the channel and returns without waiting on the network round trip — same non-blocking contract the old HTTP-only version had. Publisher confirms arrive asynchronously; only a negative confirm (or no broker connection at all) triggers the HTTP fallback, and even that fallback is itself fire-and-forget.
- **Cross-entity search has no caller yet.** No MCP tool wraps it (the chat agent can't use it), and no React code calls `/api/ai/search`. It's a complete, tested capability sitting unused pending a UI or agent-tool integration.
- **No new auth surface.** `POST /api/ai/search` and `POST /knowledge/chunk` inherit the service's existing no-auth posture — anything that can reach `ai-agent:8001` (or `/api/ai/` via nginx) can call either. RabbitMQ itself is only reachable on the docker network (AMQP port 5672 not published to the host) plus the management UI on `:15672`, credentials in `.env` (`RABBITMQ_USER`/`RABBITMQ_PASS`, default `communicator`/`example` — change for anything beyond local dev).

#### Change Index

| Want to change | Where |
|---|---|
| Trigger publish sites (Friend/Group/Connection save paths) | `*KnowledgeService.save/saveAll/update()` (knowledge-core `AbstractFactService` override), `publishChunkTrigger()` |
| Trigger delivery (queue publish, publisher confirms, HTTP fallback) | `knowledge-core` `KnowledgeChunkTriggerListener`/`KnowledgeChunkTriggerClient`, `RabbitMqConfig` (queue/DLQ declarations) |
| Queue / DLQ names | `RabbitMqConfig.KNOWLEDGE_CHUNK_TRIGGER_QUEUE`/`_DLQ` (`knowledge.chunk.trigger[.dlq]`) — must match `ai_agent/services/rabbitmq_consumer.py`'s `QUEUE_NAME`/`DLQ_NAME` exactly (both sides declare idempotently) |
| Retry cap before DLQ | `ai_agent/services/rabbitmq_consumer.py MAX_ATTEMPTS` (3) |
| RabbitMQ connection (JVM side) | `bootstrap/src/main/resources/application.yml spring.rabbitmq.*` (env `RABBITMQ_HOST`/`PORT`/`USER`/`PASS`) |
| RabbitMQ connection (ai_agent side) | `ai_agent/config/config.yaml databases.rabbitmq.url` (env `RABBITMQ_URL`) |
| ai-agent URL as seen by the JVM trigger client (now HTTP-fallback-only) | `bootstrap/src/main/resources/application.yml ai-agent.url` (env `AI_AGENT_URL`) |
| Chunk ingestion (both RabbitMQ consumer and the HTTP fallback path call this) | `ai_agent ChunkingService.process_knowledge()` — invoked from `services/rabbitmq_consumer.py KnowledgeChunkConsumer._on_message` and `routers/knowledge.py POST /knowledge/chunk` |
| "Exactly one subject" validation | `ChunkingService._validate_subject()` |
| Nightly reconciliation sweep (JVM-crash-before-publish backstop) | `chrono` module `ChronoJobService.reconcileMissingKnowledgeChunks()`, same cron slot as `applyDailyDecay()` |
| Cross-entity search grouping/dedup/top_k | `ai_agent SearchService.search_all()` |
| Cross-entity search endpoint/response shape | `ai_agent routers/search.py`, `models/schemas.py SearchAllInput` |
| Group name enrichment | `ai_agent GroupApiService.fetch_group_name()`, `config.yaml group_service.base_url` |
