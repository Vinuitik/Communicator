# Flow: Knowledge → Validated Facts (the RAG + fact-checking pipeline)

Turn a friend's messy free-text knowledge notes into **structured, AI-validated, source-referenced key-value facts**. This is the most cross-service pipeline in the system: **UI → nginx → ai_agent → {friend, embedder, Postgres/ParadeDB, Redis, Gemini}**.

Protos for mechanics: [ai_agent](../ai_agent/PROTO.md) · [embedder](../embedder/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md). Raw facts come from Stage 1 of the [relationship lifecycle](relationship-lifecycle.md).

> **2026-07-23: Mongo + FAISS + Ollama retired from this pipeline.** Chunks, embeddings, facts, and fact-references all moved to Postgres/ParadeDB (same instance the JVM app uses). Search is now hybrid pgvector + BM25 (RRF-fused) instead of an in-memory FAISS index. Embeddings come from a new standalone `embedder` service (ONNX EmbeddingGemma, 768-dim) instead of Ollama — the Ollama container itself still runs, just unused by this pipeline; a privacy-motivated Ollama-for-chat decision is a separate, not-yet-had conversation.

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
