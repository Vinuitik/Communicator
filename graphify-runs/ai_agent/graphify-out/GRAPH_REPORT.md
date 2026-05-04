# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~14,669 words - fits in a single context window. You may not need a graph.

## Summary
- 433 nodes · 1135 edges · 19 communities detected
- Extraction: 43% EXTRACTED · 57% INFERRED · 0% AMBIGUOUS · INFERRED: 650 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chunk Repository Layer|Chunk Repository Layer]]
- [[_COMMUNITY_Agent & Chunking Services|Agent & Chunking Services]]
- [[_COMMUNITY_Fact & Summary CRUD|Fact & Summary CRUD]]
- [[_COMMUNITY_Message Processing Pipeline|Message Processing Pipeline]]
- [[_COMMUNITY_Agent Core & Tool Management|Agent Core & Tool Management]]
- [[_COMMUNITY_Prompt & Configuration|Prompt & Configuration]]
- [[_COMMUNITY_Embedding & Settings|Embedding & Settings]]
- [[_COMMUNITY_Knowledge Evaluation|Knowledge Evaluation]]
- [[_COMMUNITY_Service Health & Validation|Service Health & Validation]]
- [[_COMMUNITY_Summary Cache|Summary Cache]]
- [[_COMMUNITY_Prompt Loading|Prompt Loading]]
- [[_COMMUNITY_Data Storage Repos|Data Storage Repos]]
- [[_COMMUNITY_FAISS Index Stats|FAISS Index Stats]]
- [[_COMMUNITY_Summary Prompt Init|Summary Prompt Init]]
- [[_COMMUNITY_Validation Init|Validation Init]]
- [[_COMMUNITY_Friend API Init|Friend API Init]]
- [[_COMMUNITY_Friend Cache Lookup|Friend Cache Lookup]]
- [[_COMMUNITY_Cache Service Init|Cache Service Init]]
- [[_COMMUNITY_Service Health Check|Service Health Check]]

## God Nodes (most connected - your core abstractions)
1. `EmbeddingRepository` - 55 edges
2. `EmbeddingService` - 54 edges
3. `FriendApiService` - 52 edges
4. `ChunkRepository` - 45 edges
5. `FactRepository` - 45 edges
6. `ChunkingService` - 41 edges
7. `AgentService` - 39 edges
8. `FactService` - 38 edges
9. `SearchService` - 38 edges
10. `KnowledgeCacheService` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Fact Repository - handles MongoDB operations for friend summaries and facts.` --uses--> `FactDocument`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\ai_agent\repositories\fact_repository.py → C:\Users\ACER\Desktop\Java\Communicator\ai_agent\models\schemas.py
- `Process a user message through the agent                  Args:             m` --uses--> `MCPService`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\ai_agent\services\agent_service.py → C:\Users\ACER\Desktop\Java\Communicator\ai_agent\services\mcp_service.py
- `startup_event()` --calls--> `get_agent_service()`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\ai_agent\main.py → C:\Users\ACER\Desktop\Java\Communicator\ai_agent\dependencies\deps.py
- `root()` --calls--> `HealthResponse`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\ai_agent\main.py → C:\Users\ACER\Desktop\Java\Communicator\ai_agent\models\schemas.py
- `Initialize services on application startup` --uses--> `HealthResponse`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\ai_agent\main.py → C:\Users\ACER\Desktop\Java\Communicator\ai_agent\models\schemas.py

## Hyperedges (group relationships)
- **LangChain Ecosystem Dependencies** — requirements_langchain, requirements_langchain_core, requirements_langchain_community, requirements_langchain_mcp_adapters, requirements_langchain_google_genai, requirements_langchain_google_vertexai, requirements_langgraph [EXTRACTED 1.00]
- **Vector Search and RAG Stack** — requirements_faiss_cpu, requirements_llama_index, requirements_langchain_community [INFERRED 0.80]
- **API Server Stack** — requirements_fastapi, requirements_uvicorn, requirements_pydantic, requirements_aiohttp [INFERRED 0.90]
- **Knowledge Summary Prompt Pair (System + User)** — knowledge_summary_system_prompt, knowledge_summary_user_prompt, knowledge_summary_task [EXTRACTED 1.00]
- **Data Persistence Stack** — requirements_redis, requirements_motor [INFERRED 0.85]

## Communities

### Community 0 - "Chunk Repository Layer"
Cohesion: 0.05
Nodes (56): ChunkRepository, Repository for managing chunk data in MongoDB.  This repository encapsulates a, Find multiple chunks by their IDs.                  Args:             chunk_i, Delete all chunks for a knowledge item.                  Args:             kn, Count chunks for a knowledge item.                  Args:             knowled, Repository for chunk persistence operations.          Responsibilities:     -, Create chunk documents from chunk tuples.                  Args:, Delete all chunks and their embeddings for a knowledge item. (+48 more)

### Community 1 - "Agent & Chunking Services"
Cohesion: 0.13
Nodes (64): AgentService, ChunkingService, get_agent_service(), get_chunk_repository(), get_chunking_service(), get_embedding_repository(), get_embedding_service(), get_fact_repository() (+56 more)

### Community 2 - "Fact & Summary CRUD"
Cohesion: 0.06
Nodes (25): Delete a specific fact from a friend's summary.                  Args:, Update specific fields of a fact.                  Args:             friend_i, Handles MongoDB operations for friend summaries and facts.          Features:, Create an empty summary document for a friend.                  Useful when no, Get the number of facts for a friend.                  Args:             frie, Check if a specific fact exists.                  Args:             friend_id, Initialize the fact repository.                  Args:             mongo_repo, Get the complete summary document for a friend.                  Args: (+17 more)

### Community 3 - "Message Processing Pipeline"
Cohesion: 0.07
Nodes (40): Process a user message through the agent                  Args:             m, BaseModel, chat_with_agent(), list_available_tools(), Chat with the AI agent using a standard HTTP request          Args:         u, WebSocket endpoint for real-time chat with the AI agent          Args:, Get list of available tools for the agent          Args:         agent_servic, websocket_endpoint() (+32 more)

### Community 4 - "Agent Core & Tool Management"
Cohesion: 0.07
Nodes (17): Get a specific tool by name                  Args:             tool_name: Nam, Get list of available tool names                  Returns:             List o, Check if the service is initialized, Service for managing the LangChain agent and its dependencies, Initialize the agent and all its dependencies, Setup the Google Gemini LLM, Create the ReAct agent with LLM and tools, Generate a direct LLM response without using the agent/tools. (+9 more)

### Community 5 - "Prompt & Configuration"
Cohesion: 0.13
Nodes (23): AI Agent Service, Knowledge Data Placeholder (Template Variable), Knowledge Summary System Prompt, Friend Knowledge Summarization Task, Knowledge Summary User Prompt Template, aiohttp, FAISS CPU (Vector Search), FastAPI (+15 more)

### Community 6 - "Embedding & Settings"
Cohesion: 0.12
Nodes (9): Initialize the embedding service.                  Args:             redis_re, Load configuration from YAML file, Application configuration settings loaded from YAML config and environment varia, Apply environment-specific configuration overrides, Recursively update nested dictionary, Get MongoDB connection parameters, Get Redis connection parameters, Get embedding service configuration (+1 more)

### Community 7 - "Knowledge Evaluation"
Cohesion: 0.12
Nodes (8): Fetch all knowledge IDs for a specific friend.                  Calls: GET /ge, fix_json_format(), Fix common JSON formatting issues and extract JSON from LLM response, Delete multiple documents matching the filter.                  Args:, Search for similar chunks using vector similarity.                  Args:, Clear the FAISS index for a friend.                  Called when chunks have b, Rebuild FAISS index for a friend.                  Args:             friend_i, Build FAISS index for all chunks belonging to a friend's knowledge.

### Community 8 - "Service Health & Validation"
Cohesion: 0.21
Nodes (5): Embedding service using Ollama API.  This service provides text embedding capa, Fact Validation Service - validates facts using AI against knowledge texts.  T, Friend API Service - handles all HTTP communication with Friend Java service., Knowledge Cache Service - manages Redis caching for knowledge summaries.  This, Search service for vector similarity search using FAISS.  This service manages

### Community 9 - "Summary Cache"
Cohesion: 0.14
Nodes (6): Generate consistent cache key for a friend's summary.                  Args:, Mark a friend's summary as cached.                  Args:             friend_, Invalidate (delete) a friend's cached summary.                  Called when kn, Atomically set `key` to `new` only if its current value equals `expected`., Create a key/value only if the key does not already exist.          Returns Tr, Alias for set - creates or updates the key unconditionally.          This mirr

### Community 10 - "Prompt Loading"
Cohesion: 0.2
Nodes (5): load_prompt_parts(), Loads prompt parts for a given prompt name.     Expects files:       - {name}_, Summary Prompt Service - manages prompts for knowledge summarization.  This se, Create the prompt template for knowledge summarization.                  Loads, Generate a summary using LLM from knowledge data.                  Args:

### Community 11 - "Data Storage Repos"
Cohesion: 0.29
Nodes (3): Fact Repository - handles MongoDB operations for friend summaries and facts., Async MongoDB repository using motor.  Provides a minimal CRUD wrapper suitabl, Async Redis repository used by the ai_agent services.  This module provides a

### Community 12 - "FAISS Index Stats"
Cohesion: 0.5
Nodes (2): Get statistics about a friend's FAISS index.                  Args:, Get statistics for all loaded indexes.                  Returns:

### Community 13 - "Summary Prompt Init"
Cohesion: 1.0
Nodes (1): Initialize the summary prompt service.

### Community 14 - "Validation Init"
Cohesion: 1.0
Nodes (1): Initialize the validation service.                  Args:             agent_s

### Community 15 - "Friend API Init"
Cohesion: 1.0
Nodes (1): Initialize the Friend API service.

### Community 16 - "Friend Cache Lookup"
Cohesion: 1.0
Nodes (1): Get all friend IDs that have cached summaries.                  Useful for cac

### Community 17 - "Cache Service Init"
Cohesion: 1.0
Nodes (1): Initialize the cache service.                  Args:             redis_repo:

### Community 23 - "Service Health Check"
Cohesion: 1.0
Nodes (1): Check if the service is initialized

## Knowledge Gaps
- **93 isolated node(s):** `Application configuration settings loaded from YAML config and environment varia`, `Load configuration from YAML file`, `Apply environment-specific configuration overrides`, `Recursively update nested dictionary`, `Get MongoDB connection parameters` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `FAISS Index Stats`** (4 nodes): `Get statistics about a friend's FAISS index.                  Args:`, `Get statistics for all loaded indexes.                  Returns:`, `.get_all_index_stats()`, `.get_index_stats()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Summary Prompt Init`** (2 nodes): `Initialize the summary prompt service.`, `.__init__()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Validation Init`** (2 nodes): `.__init__()`, `Initialize the validation service.                  Args:             agent_s`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend API Init`** (2 nodes): `.__init__()`, `Initialize the Friend API service.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Cache Lookup`** (2 nodes): `.get_all_cached_friend_ids()`, `Get all friend IDs that have cached summaries.                  Useful for cac`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cache Service Init`** (2 nodes): `.__init__()`, `Initialize the cache service.                  Args:             redis_repo:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Health Check`** (1 nodes): `Check if the service is initialized`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AgentService` connect `Agent & Chunking Services` to `Service Health & Validation`, `Message Processing Pipeline`, `Agent Core & Tool Management`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `EmbeddingService` connect `Chunk Repository Layer` to `Agent & Chunking Services`, `Embedding & Settings`, `Knowledge Evaluation`, `Service Health & Validation`, `FAISS Index Stats`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `EmbeddingRepository` connect `Chunk Repository Layer` to `Agent & Chunking Services`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 45 inferred relationships involving `EmbeddingRepository` (e.g. with `Dependency injection for AI agent services.  This module manages the lifecycle` and `Get shared RedisRepository instance.`) actually correct?**
  _`EmbeddingRepository` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 41 inferred relationships involving `EmbeddingService` (e.g. with `Dependency injection for AI agent services.  This module manages the lifecycle` and `Get shared RedisRepository instance.`) actually correct?**
  _`EmbeddingService` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 44 inferred relationships involving `FriendApiService` (e.g. with `Dependency injection for AI agent services.  This module manages the lifecycle` and `Get shared RedisRepository instance.`) actually correct?**
  _`FriendApiService` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `ChunkRepository` (e.g. with `Dependency injection for AI agent services.  This module manages the lifecycle` and `Get shared RedisRepository instance.`) actually correct?**
  _`ChunkRepository` has 31 INFERRED edges - model-reasoned connections that need verification._