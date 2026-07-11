# Flow: Knowledge → Validated Facts (the RAG + fact-checking pipeline)

Turn a friend's messy free-text knowledge notes into **structured, AI-validated, source-referenced key-value facts**. This is the most cross-service pipeline in the system: **UI → nginx → ai_agent → {friend, Ollama, MongoDB, Redis, Gemini}**.

Protos for mechanics: [ai_agent](../ai_agent/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md). Raw facts come from Stage 1 of the [relationship lifecycle](relationship-lifecycle.md).

---

## The pipeline

```
User clicks "summarize {friendId}"  (validation page)
 → POST http://localhost:8090/api/ai/knowledge/summarize {friend_id}
 → nginx  location /api/ai/  (CORS + WebSocket-capable) ─►  ai-agent:8001/knowledge/summarize
 → KnowledgeService.summarize_friend_knowledge(friend_id)                    [ai_agent proto]

 1. cache_service.is_summary_cached(fid)?        ── Redis (redisCache:6379)
      HIT → return facts from Mongo (skip to step 7)
 2. friend_api_service.fetch_knowledge_paginated  ── HTTP → friend:8085/getKnowledge/{fid}/page/0/size/N
      (DIRECT to friend, NOT via nginx — unlike chrono/MCP)
 2.5 LAZY CHUNKING per knowledge item:
      fetch_knowledge_text(id)                   ── HTTP → friend:8085/getKnowledgeText/{id}
      chunks in Mongo knowledge_chunks?  no → ChunkingService.process_knowledge (word windows)
 2.6 ensure_embeddings_exist(chunkIds):
      EmbeddingService → Ollama (ollama:11434/api/embeddings, all-minilm-l6-v2, 384-dim)
      vectors cached in Redis
 3. SummaryPromptService.generate_summary(knowledge, llm)   ── Gemini (service-account creds)
 4. parse_summary_to_facts()                     → [(key, value), ...]
 5. FOR EACH fact → FactService.create_fact_with_references(fid, key, value):
      a. SearchService.search(fid, "key is value")   ── FAISS over friend's chunk embeddings
           no hits + discard_if_no_references → DROP FACT
      b. top-k chunks → knowledge_ids
      c. fetch_knowledge_texts_batch()               ── HTTP → friend:8085 (asyncio.gather)
      d. FactValidationService.validate_fact()        ── Gemini, STRICT json {is_valid,confidence,reasoning}
      e. is_valid AND confidence ≥ min_validation_confidence?  no → DROP FACT
      f. save fact + fact_references (chunk_id, knowledge_id, score, rank)  ── Mongo (generated_db)
 6. cache_service.cache_summary(fid)             ── Redis
 7. get_friend_facts_with_references(fid)        ── Mongo facts + reconstructed chunk texts (UI tooltips)
 → JSON: { friend_id, facts:[{key,value,stability_score,validated,references:[{chunk_text,score,rank}]}], fact_count }
```

---

## What each store holds

| Store | Container | Holds |
|---|---|---|
| **friend Postgres** | `postgresDB` | source of truth: the raw knowledge notes (owned by friend service) |
| **Ollama** | `ollama` | embedding model, computes 384-dim vectors on demand |
| **Redis** | `redisCache` | "summary already generated" flags + embedding vector cache |
| **MongoDB** | `generatedData` (`generated_db`) | derived: `knowledge_chunks`, `friend_summaries` (facts), `fact_references` |
| **Gemini** | cloud | the LLM doing summary + validation |

**Achieves:** a curated fact sheet per friend where **every fact is traceable to the source note that supports it** (references with relevance scores → the UI can show "why do we believe this?" tooltips), and unsupported LLM hallucinations are **dropped** at the validation gate.

---

## Trust & failure notes (from the ai_agent proto)

- **The validation gate is the whole point:** a parsed fact survives only if FAISS finds supporting chunks AND Gemini confirms it above `min_validation_confidence`. Everything else is discarded — this is what keeps the LLM honest.
- **Silent degradation:** if the knowledge-text fetch fails, the fact is **auto-validated at confidence 0.5** instead of erroring — a friend-service hiccup lowers the quality bar rather than failing loudly.
- **Synchronous & slow:** the whole thing runs inside one HTTP POST — K text fetches + embeddings + 1 summary call + one search+validate Gemini call *per fact*. Big friends can approach nginx's 300s timeout. No progress stream (unlike [chat](chat.md)). No Kafka despite it being provisioned.
- **Re-generation is cache-gated:** once cached in Redis, new notes won't re-summarize until the cache entry expires or is cleared (`cache.friend_summary_ttl`). `re_evaluate_fact` is only half-implemented.

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| The whole pipeline | `KnowledgeService.summarize_friend_knowledge()` |
| Validation strictness | `config.yaml referencing.min_validation_confidence` |
| Drop-if-unsupported behaviour | `config.yaml referencing.discard_if_no_references` |
| Chunking granularity | `config.yaml chunking.*` |
| Embedding model | `config.yaml embedding.model` + compose `ollama` pull |
| Which friend endpoints supply text | `FriendApiService` (friend `FriendKnowledgeController`) |
| Re-summarize freshness | `config.yaml cache.friend_summary_ttl` |
| Public route | `nginx/nginx.conf location /api/ai/` |
