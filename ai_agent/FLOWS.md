# AI Agent Service — FLOWS.md

Files: main.py, config/settings.py, config/config.yaml, routers/chat.py, routers/knowledge.py, services/agent_service.py, services/mcp_service.py, services/knowledge_service.py, services/chunking_service.py, services/embedding_service.py, services/fact_service.py, services/fact_validation_service.py, services/search_service.py, services/friend_api_service.py, services/knowledge_cache_service.py, repositories/mongo_repository.py, repositories/redis_repository.py, repositories/chunk_repository.py, repositories/embedding_repository.py, repositories/fact_repository.py, prompts/prompt_manager.py, prompts/summary_prompt_service.py, models/schemas.py, dependencies/deps.py, utils/json_parser.py, nginx/static/profile/modules/aiChat.js, nginx/static/profile/modules/aiChatUI.js, nginx/static/shared/knowledgeManager.js, nginx/static/facts/facts.js

---

## 1. Startup / Dependency Wiring

`main.py` app startup → `deps.get_agent_service()` (singleton, lazy) → `AgentService.initialize()` → `MCPService.initialize()` → `MCPService._setup_mcp_client()` (retry up to `mcp_retry_attempts` times with `mcp_connection_retry_delay` backoff) → `MultiServerMCPClient.get_tools()` (fetches tool list from `mcp_server_url`) → `AgentService._setup_llm()` → `ChatVertexAI(model=llm_model, location="us-central1")` (uses `/app/service-account-key.json`) → `AgentService._create_agent()` → `create_react_agent(llm, tools)`

All other singletons (`EmbeddingService`, `ChunkingService`, `SearchService`, `FactService`, `KnowledgeService`, etc.) are lazily initialized on first HTTP request via FastAPI `Depends` chains in `deps.py`.

To change the LLM model: `settings.llm_model` (config.yaml `llm.model`)
To change MCP server address: `settings.mcp_server_url` (config.yaml `mcp.server_url`)
To change GCP credentials path: hardcoded `os.environ["GOOGLE_APPLICATION_CREDENTIALS"]` in `AgentService`

---

## 2. Chat Flow (UI → WebSocket → ReAct Agent → LLM → MCP tools)

### UI side
`AiChat.init()` → `AiChat.connect()` → `new WebSocket("wss://{host}/api/ai/chat/ws")` → on open: `AiChat.sendInitialContext()` (sends friend name/ID as context message)

User types message → `AiChat.sendMessage()` → `AiChat.sendRawMessage({type:"chat", message, friendId})` → `AiChatUI.showTyping()`

Server pushes `{type:"ai_response", content:"..."}` → `AiChat.handleMessage()` → `AiChatUI.addMessage()` + `AiChatUI.hideTyping()`

Reconnect: exponential backoff, max `maxReconnectAttempts=5`, delay starts at `reconnectDelay=1000ms`

### Backend side
`POST /chat/` or `WebSocket /chat/ws` → `chat.router` → `AgentService.process_message(message)` → `agent.ainvoke({"messages": [{"role":"user","content":message}]})` → LangGraph ReAct loop:
- LLM reasons → may call MCP tools → tool result injected back → LLM reasons again → final answer

`AgentService.process_message()` returns full LangGraph result dict; WebSocket handler extracts `result['messages'][-1].content` (normalizes list-of-dict or plain string).

To change temperature/max_tokens: `settings.llm_temperature`, `settings.llm_max_tokens` (config.yaml `llm.*`)
To change agent type: `AgentService._create_agent()` (currently `create_react_agent`)
To add/remove tools: extend the MCP server at `mcp_server_url`; `MCPService.refresh_tools()` can reload without restart

---

## 3. Knowledge Ingestion (UI → communicator-core → ai_agent)

### UI side (knowledge CRUD, stored in communicator-core, NOT ai_agent)
`facts.js` → `KnowledgeManager` (configured with `apiBaseUrl: '/api/friend'`)

Add: form submit → `KnowledgeManager.handleSubmitInfo()` → `POST /api/friend/addKnowledge/{friendId}` (JSON array `[{fact, importance}]`) → communicator-core Java service
Read: `KnowledgeManager.loadKnowledgePage(page)` → `GET /api/friend/getKnowledge/{friendId}/page/{page-1}` → paginated response
Update: `KnowledgeManager.handleUpdate()` → `PUT /api/friend/updateKnowledge` (body `{id, fact, importance}`)
Delete: `KnowledgeManager.handleDelete()` → `DELETE /api/friend/deleteKnowledge/{knowledgeId}`

Knowledge is stored in communicator-core (Java/friend service at `http://friend:8085`). The ai_agent does NOT receive knowledge at write time; it fetches it on-demand during summarization.

---

## 4. Knowledge Summarization Flow (`POST /knowledge/summarize`)

Triggered by: `POST /knowledge/summarize` with `{friend_id: int}` (called from profile UI or integration code)

```
knowledge.router → KnowledgeService.summarize_friend_knowledge(friend_id)
  │
  ├─ Step 1: KnowledgeCacheService.is_summary_cached(friend_id)
  │           Redis key: "friend_summary:{friend_id}"
  │           Cache HIT → KnowledgeService.get_friend_facts_with_references(friend_id) → return
  │
  ├─ Step 2 (cache miss): FriendApiService.fetch_knowledge_paginated(friend_id, page=0, size=knowledge_max_items_per_request)
  │           GET http://friend:8085/getKnowledge/{friendId}/page/0/size/{size}
  │           Returns: [{id, fact, importance}, ...]
  │
  ├─ Step 2.5: KnowledgeService._ensure_knowledge_chunked(friend_id, knowledge_items)
  │   For each knowledge item:
  │     FriendApiService.fetch_knowledge_text(knowledge_id)
  │       GET http://friend:8085/getKnowledgeText/{id} → {id, text}
  │     MongoRepository.find_many("knowledge_chunks", {knowledge_id}) → existing chunks?
  │       HIT: skip chunking
  │       MISS: ChunkingService.process_knowledge(knowledge_id, text, force_regenerate=False)
  │               → ChunkingService._calculate_text_hash(text) [MD5]
  │               → ChunkRepository.find_chunks_by_knowledge_and_hash() → cache check
  │               → ChunkRepository.delete_chunks_and_embeddings() [if regenerating]
  │               → ChunkingService._split_into_chunks(text) → [(chunk_text, char_start, char_end), ...]
  │                   Text < min_chunk_size_words → single chunk
  │                   Else: sliding window, step = chunk_size_words - chunk_overlap_words
  │               → ChunkRepository.create_chunk_documents() → ChunkDocument list
  │               → ChunkRepository.save_chunks() → INSERT to "knowledge_chunks"
  │               → EmbeddingService.embed_texts(chunk_texts) [see §5]
  │               → EmbeddingRepository.create_embedding_documents()
  │               → EmbeddingRepository.save_embeddings() → INSERT to "chunk_embeddings"
  │               → returns chunk_id list
  │
  ├─ Step 2.6: ChunkingService.ensure_embeddings_exist(all_chunk_ids, knowledge_texts)
  │             ChunkRepository.find_chunks_missing_embeddings() → EmbeddingRepository.find_chunks_missing_embeddings()
  │             For missing: reconstruct text from char_start/char_end → EmbeddingService.embed_texts() → save
  │
  ├─ Step 3: SummaryPromptService.generate_summary(knowledge_items, llm)
  │           loads prompts/knowledge_summary_system.txt + prompts/knowledge_summary_user.txt via prompt_manager.load_prompt_parts()
  │           chain: ChatPromptTemplate | llm (ChatVertexAI) | StrOutputParser | fix_json_format()
  │           Returns parsed JSON dict
  │
  ├─ Step 4: SummaryPromptService.parse_summary_to_facts(summary_json)
  │           Recursive traversal of JSON → [(key, value), ...] with hierarchical keys ("parent > child")
  │           Filters empty values
  │
  ├─ Step 5: For each (fact_key, fact_value):
  │           FactService.create_fact_with_references(friend_id, fact_key, fact_value) [see §6]
  │
  ├─ Step 6: KnowledgeCacheService.cache_summary(friend_id)
  │           Redis SET "friend_summary:{friend_id}" = "cached" (no TTL, permanent)
  │
  └─ Step 7: KnowledgeService.get_friend_facts_with_references(friend_id)
              FactRepository.get_friend_summary(friend_id) → MongoDB "friend_summaries"
              For each fact: FactService.get_fact_references(fact_id) → "fact_references"
                For each ref: MongoRepository.find_one("knowledge_chunks", {chunk_id})
                              FriendApiService.fetch_knowledge_text(knowledge_id)
                              ChunkingService.get_chunk_text(chunk_id, full_text) [char_start:char_end slice]
              Returns {friend_id, facts: [{fact_id, key, value, stability_score, validated, references:[{chunk_id, knowledge_id, chunk_text, relevance_score, rank}]}], fact_count}
```

To change max knowledge items fetched: `settings.knowledge_max_items_per_request` (config.yaml `knowledge.max_knowledge_items_per_request`)
To change chunk size: `settings.chunk_size_words`, `settings.chunk_overlap_words`, `settings.min_chunk_size_words` (config.yaml `chunking.*`)
To change prompt files: `ai_agent/prompts/knowledge_summary_system.txt`, `ai_agent/prompts/knowledge_summary_user.txt`
To change summarization LLM chain: `SummaryPromptService.generate_summary()`
To change fact parsing: `SummaryPromptService.parse_summary_to_facts()`
To invalidate cache: `KnowledgeCacheService.invalidate_summary(friend_id)` deletes Redis key

---

## 5. Embedding Flow

`EmbeddingService.embed_texts(texts)` → for each text: check Redis cache (`embedding:{MD5(model:text)}`)
  Cache HIT: return cached vector
  Cache MISS: `EmbeddingService._call_ollama_api(texts, session)` → `POST {ollama_url}/api/embeddings` `{model, prompt}` (one text at a time)
    → `EmbeddingService._normalize_embedding()` (L2 norm to unit length for cosine similarity)
    → `EmbeddingService._cache_embedding()` → Redis SET with `embedding_cache_ttl`
Returns: List[List[float]] in original input order

`EmbeddingService.embed_query(query)` → identical to `embed_text()`, alias for semantic clarity in search contexts

To change embedding model: `settings.embedding_model` (config.yaml `embedding.model`); also update `EmbeddingService.get_embedding_dimension()` map
To change embedding provider: `settings.embedding_provider` (config.yaml `embedding.provider`); currently only "ollama" is implemented
To change Ollama URL: `settings.embedding_ollama_url` (config.yaml `embedding.ollama_url`)
To disable embedding cache: `settings.embedding_cache_enabled` (config.yaml `embedding.cache_embeddings`)
To change embedding cache TTL: `settings.embedding_cache_ttl` (config.yaml `embedding.embedding_cache_ttl`)

---

## 6. Fact Extraction and Validation Flow

`FactService.create_fact_with_references(friend_id, fact_key, fact_value)`:

```
Step 1: query = "{fact_key} is {fact_value}"
        SearchService.search(friend_id, query) [see §7] → [(chunk_id, score), ...]
        No results + discard_if_no_references=True → return None (fact discarded)

Step 2: MongoRepository.find_many("knowledge_chunks", {chunk_id: {$in: chunk_ids}})
        Extract unique knowledge_ids from matched chunks

Step 3: FriendApiService.fetch_knowledge_texts_batch(knowledge_ids)
        asyncio.gather → concurrent GET http://friend:8085/getKnowledgeText/{id} for each
        Returns {knowledge_id: text}

Step 4: FactValidationService.validate_fact(fact_key, fact_value, knowledge_texts)
        → AgentService.generate_response(system_prompt, user_prompt)
            messages = [SystemMessage, HumanMessage] → ChatVertexAI.ainvoke()
        → JSON parse response → {is_valid, confidence, reasoning}
        Strips markdown code fences before JSON.parse

Step 5: FactValidationService.meets_threshold(confidence)
        confidence < min_validation_confidence → return None (fact discarded)

Step 6: FactDocument(fact_id=ObjectId, key, value, stability_score=confidence, validated=is_valid)
        FactRepository.save_fact(friend_id, fact_doc) → MongoDB $push to "friend_summaries".facts + $inc fact_count (upsert)

Step 7: For each (chunk_id, relevance_score) in search_results[:max_references_per_fact]:
        FactReferenceDocument(fact_id, chunk_id, knowledge_id, friend_id, relevance_score, rank)
        MongoRepository.insert_many("fact_references", [ref.dict(), ...])

Returns: fact_id (str) if saved, None if discarded
```

To change validation confidence threshold: `settings.min_validation_confidence` (config.yaml `referencing.min_validation_confidence`)
To change max chunk references per fact: `settings.max_references_per_fact` (config.yaml `referencing.max_references_per_fact`)
To change discard-if-no-refs behavior: `settings.discard_if_no_references` (config.yaml `referencing.discard_if_no_references`)
To change validation prompt: inline in `FactValidationService.validate_fact()` (`system_prompt` / `user_prompt`)

---

## 7. Search / Retrieval Flow (Semantic Search)

`SearchService.search(friend_id, query)`:

```
friend_id in self.indexes (in-memory FAISS cache)?
  NO → SearchService.build_index_for_friend(friend_id)
        FriendApiService.fetch_knowledge_ids_for_friend(friend_id)
          GET http://friend:8085/getKnowledgeIds/{friendId} → [int, ...]
        MongoRepository.find_many("knowledge_chunks", {knowledge_id: {$in: knowledge_ids}}) → chunks
        MongoRepository.find_many("chunk_embeddings", {chunk_id: {$in: chunk_ids}}) → embedding docs
        Build np.float32 matrix → faiss.normalize_L2() (if IndexFlatIP)
        faiss.IndexFlatIP(dimension).add(matrix)
        Store: self.indexes[friend_id] = (index, chunk_id_mapping)
  YES → use cached index

EmbeddingService.embed_query(query) → query_vector (normalized)
index.search(query_vector, top_k) → (distances, indices)
IndexFlatIP: distance IS cosine similarity (already normalized)
Filter: score >= min_relevance_threshold
Returns: [(chunk_id, score), ...] sorted descending by score
```

FAISS index is in-memory, per-friend, rebuilt on first search miss or explicit `SearchService.rebuild_index(friend_id)`.
Stale index (after new chunks added): call `SearchService.clear_index(friend_id)` before next search.

To change top-K results: `settings.top_k_chunks` (config.yaml `search.top_k_chunks`)
To change relevance threshold: `settings.min_relevance_threshold` (config.yaml `search.min_relevance_threshold`)
To change FAISS index type: `settings.faiss_index_type` (config.yaml `search.faiss_index_type`) — "IndexFlatIP" or "IndexFlatL2"

---

## 8. Friend Data Fetching (ai_agent → communicator-core)

All calls via `FriendApiService` (base URL: `settings.friend_service_url`, timeout: `settings.friend_service_timeout`):

| Method | Endpoint | Returns |
|---|---|---|
| `fetch_knowledge_paginated(friend_id, page, size)` | `GET /getKnowledge/{friendId}/page/{page}/size/{size}` | `[{id, fact, importance}]` |
| `fetch_knowledge_text(knowledge_id)` | `GET /getKnowledgeText/{id}` | `{id, text}` → `.text` field |
| `fetch_knowledge_texts_batch(knowledge_ids)` | concurrent `GET /getKnowledgeText/{id}` via `asyncio.gather` | `{knowledge_id: text}` |
| `fetch_knowledge_ids_for_friend(friend_id)` | `GET /getKnowledgeIds/{friendId}` | `[int, ...]` |

404 responses → empty result (no exception). Network errors → empty result + log.

To change base URL: `settings.friend_service_url` (config.yaml `friend_service.base_url`)
To change timeout: `settings.friend_service_timeout` (config.yaml `friend_service.timeout`)

---

## 9. MongoDB Collections

| Collection | Schema | Owner |
|---|---|---|
| `knowledge_chunks` | `ChunkDocument` (chunk_id, knowledge_id, chunk_index, word_count, char_start, char_end, text_hash, created_at) | `ChunkRepository` |
| `chunk_embeddings` | `EmbeddingDocument` (chunk_id, embedding: List[float], model_name, dimension, created_at) | `EmbeddingRepository` |
| `friend_summaries` | `FriendSummaryDocument` (friend_id, facts: [FactDocument], last_updated, fact_count) | `FactRepository` |
| `fact_references` | `FactReferenceDocument` (fact_id, chunk_id, knowledge_id, friend_id, relevance_score, validated, validation_confidence, rank, created_at) | `FactService` (raw `mongo_repo.insert_many`) |

MongoDB URL: `settings.mongodb_url` (config.yaml `databases.mongodb.url`)
MongoDB DB: `settings.mongodb_database` (config.yaml `databases.mongodb.database`)

---

## 10. Redis Key Space

| Key pattern | Value | TTL | Set by |
|---|---|---|---|
| `friend_summary:{friend_id}` | `"cached"` | none (permanent) | `KnowledgeCacheService.cache_summary()` |
| `embedding:{MD5(model:text)}` | JSON float array | `embedding_cache_ttl` (default 86400s) | `EmbeddingService._cache_embedding()` |

Redis URL: `settings.redis_url` (config.yaml `databases.redis.url`)

---

## Change Index

| Behaviour to change | Pointer |
|---|---|
| LLM model | `settings.llm_model` / config.yaml `llm.model` |
| LLM temperature | `settings.llm_temperature` / config.yaml `llm.temperature` |
| LLM via API key vs service account | `AgentService._setup_llm()` (currently `ChatVertexAI` + `/app/service-account-key.json`) |
| MCP server URL | `settings.mcp_server_url` / config.yaml `mcp.server_url` |
| MCP connection retries | `settings.mcp_retry_attempts`, `settings.mcp_connection_retry_delay` |
| Add/remove agent tools | extend MCP server; call `MCPService.refresh_tools()` |
| WebSocket endpoint path | `routers/chat.py` `@router.websocket("/ws")` |
| Initial context sent on WS connect | `AiChat.sendInitialContext()` |
| Embedding model | `settings.embedding_model` / config.yaml `embedding.model`; also update `EmbeddingService.get_embedding_dimension()` |
| Embedding provider | `settings.embedding_provider` / config.yaml `embedding.provider` (`EmbeddingService` only implements "ollama") |
| Ollama URL | `settings.embedding_ollama_url` / config.yaml `embedding.ollama_url` |
| Embedding cache TTL | `settings.embedding_cache_ttl` / config.yaml `embedding.embedding_cache_ttl` |
| Chunk size (words) | `settings.chunk_size_words` / config.yaml `chunking.chunk_size_words` |
| Chunk overlap (words) | `settings.chunk_overlap_words` / config.yaml `chunking.chunk_overlap_words` |
| Min chunk size before single-chunk | `settings.min_chunk_size_words` / config.yaml `chunking.min_chunk_size_words` |
| FAISS index type | `settings.faiss_index_type` / config.yaml `search.faiss_index_type` |
| Top-K search results | `settings.top_k_chunks` / config.yaml `search.top_k_chunks` |
| Similarity relevance threshold | `settings.min_relevance_threshold` / config.yaml `search.min_relevance_threshold` |
| Fact validation confidence threshold | `settings.min_validation_confidence` / config.yaml `referencing.min_validation_confidence` |
| Max chunk references per fact | `settings.max_references_per_fact` / config.yaml `referencing.max_references_per_fact` |
| Discard facts with no references | `settings.discard_if_no_references` / config.yaml `referencing.discard_if_no_references` |
| Fact validation prompt | inline in `FactValidationService.validate_fact()` |
| Summarization prompt | `ai_agent/prompts/knowledge_summary_system.txt`, `knowledge_summary_user.txt` |
| Summary JSON parsing | `SummaryPromptService.parse_summary_to_facts()` |
| LLM JSON cleanup | `utils/json_parser.py` `fix_json_format()` |
| Friend service base URL | `settings.friend_service_url` / config.yaml `friend_service.base_url` |
| Knowledge items per summarize call | `settings.knowledge_max_items_per_request` / config.yaml `knowledge.max_knowledge_items_per_request` |
| Summary cache invalidation | `KnowledgeCacheService.invalidate_summary(friend_id)` (deletes Redis key) |
| MongoDB connection | `settings.get_mongodb_connection_params()` / config.yaml `databases.mongodb.*` |
| Redis connection | `settings.get_redis_connection_params()` / config.yaml `databases.redis.*` |
| CORS allowed origins | config.yaml `security.cors.allow_origins` (production override: only nginx) |
| Log level | `settings.log_level` / config.yaml `app.log_level`; env `ENVIRONMENT=production` overrides to WARNING |
| Service account credentials | env var `GOOGLE_APPLICATION_CREDENTIALS` (hardcoded path in `AgentService`) |
| Gemini API key (unused path) | env var `GEMINI_API_KEY` (still required by `Settings.__init__` validation even though Vertex AI is used) |
