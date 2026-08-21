# Flow: Knowledge → Validated Facts (the RAG + fact-checking pipeline)

Turn a friend's messy free-text knowledge notes into **structured, AI-validated, source-referenced key-value facts**. This is the most cross-service pipeline in the system: **UI → nginx → ai_agent → {friend, embedder, Postgres/ParadeDB, Redis, Gemini}**.

Protos for mechanics: [ai_agent](../ai_agent/PROTO.md) · [embedder](../embedder/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md). Raw facts come from Stage 1 of the [relationship lifecycle](relationship-lifecycle.md).

> **2026-07-23: Mongo + FAISS + Ollama retired from this pipeline.** Chunks, embeddings, facts, and fact-references all moved to Postgres/ParadeDB (same instance the JVM app uses). Search is now hybrid pgvector + BM25 (RRF-fused) instead of an in-memory FAISS index. Embeddings come from a new standalone `embedder` service (ONNX EmbeddingGemma, 768-dim) instead of Ollama — the Ollama container itself still runs, just unused by this pipeline; a privacy-motivated Ollama-for-chat decision is a separate, not-yet-had conversation.

> **2026-08-20: `knowledge_chunks` is no longer Friend-only.** Group and Connection knowledge now feed the same table (tagged by `source_type`), populated by a *second*, separate multi-module flow — see [Eager multi-entity chunking](#eager-multi-entity-chunking) below. That flow also adds cross-entity search (`POST /api/ai/search`), which finds a Friend/Group/Connection by its recorded facts instead of by name. It reuses this pipeline's chunk/embedding/RRF machinery but is not part of the summarize-a-friend walkthrough below — kept in this file rather than a new one because it shares the exact same Postgres tables and hybrid-search math. Deep mechanics for both live in [ai_agent PROTO.md](../ai_agent/PROTO.md#internal-wiring--cross-entity-search-2026-08-20).
>
> **2026-08-21: the eager trigger for that flow moved off fire-and-forget HTTP onto durable RabbitMQ**, closing the silent-data-loss gap called out below — Group/Connection knowledge no longer permanently loses its chunks if ai-agent happens to be down at save time. See the updated [Eager multi-entity chunking](#eager-multi-entity-chunking) section.

---

## The pipeline

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

---

## What each store holds

| Store | Container | Holds |
|---|---|---|
| **Postgres/ParadeDB** | `postgresDB` | source of truth for friend service's own data (JVM side) **and** derived RAG data: `knowledge_chunks` (+chunk_text, BM25-indexed), `chunk_embeddings` (vector(768), HNSW), `friend_summaries` (facts, JSONB array), `fact_references` — one instance, one database, shared by the JVM app and ai_agent |
| **embedder** | `embedder` | ONNX EmbeddingGemma, computes 768-dim vectors on demand (doc/query prompt-asymmetric) |
| **Redis** | `redisCache` | "summary already generated" flags + embedding vector cache |
| **Gemini** | cloud | the LLM doing summary + validation |

`ollama` container still runs but nothing in this pipeline calls it — see the note at the top of this file.

**Achieves:** a curated fact sheet per friend where **every fact is traceable to the source note that supports it** (references with relevance scores → the UI can show "why do we believe this?" tooltips), and unsupported LLM hallucinations are **dropped** at the validation gate.

---

## Trust & failure notes (from the ai_agent proto)

- **The validation gate is the whole point:** a parsed fact survives only if the hybrid search finds supporting chunks AND Gemini confirms it above `min_validation_confidence`. Everything else is discarded — this is what keeps the LLM honest.
- **Silent degradation:** if the knowledge-text fetch fails, the fact is **auto-validated at confidence 0.5** instead of erroring — a friend-service hiccup lowers the quality bar rather than failing loudly.
- **Synchronous & slow:** the whole thing runs inside one HTTP POST — K text fetches + embeddings + 1 summary call + one search+validate Gemini call *per fact*. Big friends can approach nginx's 300s timeout. No progress stream (unlike [chat](chat.md)). No Kafka despite it being provisioned.
- **Re-generation is cache-gated:** once cached in Redis, new notes won't re-summarize until the cache entry expires or is cleared (`cache.friend_summary_ttl`). `re_evaluate_fact` is only half-implemented.
- **pg_search query gotcha:** natural-language queries with punctuation (apostrophes, question marks) must go through `paradedb.match()`, not a bare `@@@ 'string'` — see [ai_agent proto](../ai_agent/PROTO.md) gotchas.

## Change Index (flow-level)

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

---

## Eager multi-entity chunking

*(and cross-entity search — 2026-08-20)*. Unlike the summarize pipeline above, which is UI-triggered and Friend-only, this flow is triggered by the JVM apps themselves, covers all three knowledge-bearing entities, and has no UI consumer yet. Protos for mechanics: [ai_agent](../ai_agent/PROTO.md#internal-wiring--cross-entity-search-2026-08-20).

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

### Trust & failure notes

- **No lazy fallback for Group/Connection — still true.** The summarize pipeline's `_ensure_knowledge_chunked()` step only ever chunks Friend knowledge (`source_type="FRIEND"` hardcoded). What changed 2026-08-21: the eager trigger is no longer a single unretried HTTP call. RabbitMQ makes the trigger durable (survives ai-agent being down at publish time), the consumer retries transient failures (cap 3) before DLQ-ing, and chrono's nightly sweep catches the remaining JVM-crash-mid-publish gap. Net effect: a Group/Connection item can still take up to a day to get its first chunk if everything fails at once, but it's no longer possible to lose one forever.
- **Not fire-and-forget anymore, but still never blocks or fails the save.** `RabbitTemplate.convertAndSend` writes to the channel and returns without waiting on the network round trip — same non-blocking contract the old HTTP-only version had. Publisher confirms arrive asynchronously; only a negative confirm (or no broker connection at all) triggers the HTTP fallback, and even that fallback is itself fire-and-forget.
- **Cross-entity search has no caller yet.** No MCP tool wraps it (the chat agent can't use it), and no React code calls `/api/ai/search`. It's a complete, tested capability sitting unused pending a UI or agent-tool integration.
- **No new auth surface.** `POST /api/ai/search` and `POST /knowledge/chunk` inherit the service's existing no-auth posture — anything that can reach `ai-agent:8001` (or `/api/ai/` via nginx) can call either. RabbitMQ itself is only reachable on the docker network (AMQP port 5672 not published to the host) plus the management UI on `:15672`, credentials in `.env` (`RABBITMQ_USER`/`RABBITMQ_PASS`, default `communicator`/`example` — change for anything beyond local dev).

### Change Index

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
