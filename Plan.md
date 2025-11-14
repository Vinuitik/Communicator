# Knowledge–Fact Referencing and Stability Framework

**Goal:** Build a system that maintains structured knowledge pairs (facts) derived from raw knowledge text and ensures their semantic correctness, stability, and traceability through automatic referencing and AI-based validation.

**Last Updated:** November 13, 2025

---

## 1. Current Architecture Overview

### PostgreSQL (Java/Spring Boot)
**`FriendKnowledge` Entity** - Stores raw knowledge texts:
- `id`, `text`, `priority`, `date`, `reviewDate`, `interval`, `friend_id`
- `createdAt` (LocalDateTime) - ✅ Auto-populated on creation
- `updatedAt` (LocalDateTime) - ✅ Auto-updated on modification

### MongoDB (Python/FastAPI ai_agent)
**Collections to Modify:**
- `friend_summaries` - **RESTRUCTURED** to store structured facts with references (replaces monolithic summary)

**New Collections (To Implement):**
- `fact_references` - Many-to-many links between facts and knowledge chunks
- `knowledge_chunks` - Text chunks from knowledge with embeddings
- `chunk_embeddings` - Persistent embeddings for chunks (optimization)

### Redis
- Embedding cache (temporary)
- Summary cache

### Vector Search
- **FAISS** - In-memory vector search on chunk embeddings (Python)
- Embeddings generated via **HuggingFace Inference API** (`EmbeddingService`)

---

## 2. Data Schema

### 2.1 PostgreSQL: FriendKnowledge (✅ Updated)

Raw knowledge texts with automatic timestamps for tracking changes.

**Key Fields:**
- `id`, `text` (Lob), `priority`, `date`, `reviewDate`, `interval`
- `createdAt` (auto-populated), `updatedAt` (auto-updated)
- `friend_id` (FK)

---

### 2.2 MongoDB: `friend_summaries` Collection (RESTRUCTURED)

**Old Structure (To Remove):**
```python
{
    "friend_id": 123,
    "summary": "Monolithic text blob...",
    "generated_at": datetime
}
```

**New Structure (Structured Facts):**
```python
{
    "friend_id": 123,
    "facts": [
        {
            "fact_id": ObjectId,           # Unique identifier for this fact
            "key": "favorite_food",         # Fact category
            "value": "sushi",               # Fact value
            "stability_score": 0.92,        # Confidence score (0.0 - 1.0)
            "validated": true,              # AI validation status
            "created_at": datetime,
            "updated_at": datetime
        },
        {
            "fact_id": ObjectId,
            "key": "hobby",
            "value": "playing guitar",
            "stability_score": 0.87,
            "validated": true,
            "created_at": datetime,
            "updated_at": datetime
        }
    ],
    "last_updated": datetime,
    "fact_count": 2
}
```

**Purpose:** Single document per friend containing all structured facts - optimized for frontend table display

**Indexes:**
- `friend_id` (unique)
- `facts.fact_id`
- `facts.key`
- `facts.stability_score`

**Design Rationale:**
- One document per friend simplifies queries (`GET /summaries/{friend_id}`)
- Facts array easily maps to frontend table rows
- Supports partial updates (add/remove individual facts)
- Redis cache key remains `friend_summary:{friend_id}` (existing logic preserved)

---

### 2.3 MongoDB: `knowledge_chunks` Collection (NEW)

**Purpose:** Store text chunks derived from knowledge for granular semantic search.

**Schema:**
- `knowledge_id` (int) - FK to FriendKnowledge.id
- `friend_id` (int) - Denormalized for performance
- `chunk_text` (str) - Text segment from knowledge
- `chunk_index` (int) - Position in original text (0, 1, 2...)
- `word_count` (int)
- `char_start`, `char_end` (int) - Position markers in original text
- `created_at` (datetime)
- `text_hash` (str) - MD5 of `knowledge.text` for invalidation detection

**Indexes:**
- `knowledge_id`
- `friend_id`
- `text_hash`

**Chunking Strategy:**
- Configured via `CHUNK_SIZE_WORDS` and `CHUNK_OVERLAP_WORDS`
- Triggered on knowledge create/update (eager or lazy - see Section 8.6)
- Old chunks deleted when knowledge text changes

---

### 2.4 MongoDB: `chunk_embeddings` Collection (NEW - OPTIMIZATION)

**Purpose:** Persist chunk embeddings to avoid recomputing on every FAISS rebuild.

**Schema:**
- `chunk_id` (ObjectId) - FK to knowledge_chunks._id
- `knowledge_id` (int) - Denormalized
- `friend_id` (int) - Denormalized for filtering
- `embedding` (List[float]) - Vector from config (`EMBEDDING_DIMENSION`)
- `model_name` (str) - From config (`EMBEDDING_MODEL`)
- `dimension` (int)
- `created_at` (datetime)

**Indexes:**
- `chunk_id` (unique)
- `knowledge_id`
- `friend_id`

**Invalidation:**
- When `knowledge_chunks` are regenerated, old embeddings are deleted
- New embeddings computed for new chunks
- Tracks consistency with chunk lifecycle

---

### 2.5 MongoDB: `fact_references` Collection (NEW)

**Purpose:** Many-to-many links between facts (stored in `friend_summaries.facts`) and supporting knowledge chunks.

**Schema:**
- `fact_id` (ObjectId) - FK to friend_summaries.facts[].fact_id
- `chunk_id` (ObjectId) - FK to knowledge_chunks._id
- `knowledge_id` (int) - Denormalized (source knowledge)
- `friend_id` (int) - Denormalized for performance
- `relevance_score` (float) - Cosine similarity (0.0 to 1.0)
- `validated` (bool) - AI confirmed this reference
- `validation_confidence` (float)
- `created_at` (datetime)
- `rank` (int) - 1=strongest, 2=second, 3=third

**Constraints:**
- Maximum references per fact: config `MAX_REFERENCES_PER_FACT`
- References ranked by `relevance_score` DESC

**Indexes:**
- `fact_id`
- `chunk_id`
- `knowledge_id`
- `(fact_id, rank)`
- `friend_id`

---

### 2.6 In-Memory: FAISS Index (Python)

**Purpose:** Fast vector similarity search over chunk embeddings (not full knowledge or facts).

**Structure:**
```
FAISIndex:
  - index: faiss.Index object
  - id_mapping: {faiss_idx: chunk_id (ObjectId)}
  - friend_id: int
  - dimension: int (from config)
  - last_updated: datetime
```

**Index Type:** Configured via `FAISS_INDEX_TYPE`
- `IndexFlatL2` - Exact search (< 10K chunks per friend)
- `IndexIVFFlat` - Approximate search (> 10K chunks)

**Build Strategy:**
1. Load chunk embeddings from `chunk_embeddings` collection
2. Build FAISS index in memory per friend
3. Rebuild when chunks change or on scheduled interval

---

## 3. Core Workflows

### 3.1 Knowledge Chunking & Embedding

**Trigger:** Knowledge created or updated in PostgreSQL

**Process:**

1. **Detect Change**
   - Calculate hash of `knowledge.text`
   - Compare with stored hash in `knowledge_chunks.text_hash`
   - If unchanged, skip processing

2. **Delete Old Chunks** (if text changed)
   - Remove all chunks for this `knowledge_id` from `knowledge_chunks`
   - Cascade delete embeddings from `chunk_embeddings`
   - Trigger FAISS index rebuild for this friend

3. **Generate New Chunks**
   - Split `knowledge.text` into overlapping chunks
   - Chunk size and overlap from config: `CHUNK_SIZE_WORDS`, `CHUNK_OVERLAP_WORDS`
   - Store in `knowledge_chunks` with position markers

4. **Generate Chunk Embeddings**
   - Batch embed all chunks via `EmbeddingService`
   - Store in `chunk_embeddings` collection
   - Link via `chunk_id`

5. **Update FAISS Index**
   - Add new chunk embeddings to friend's FAISS index
   - Or trigger full rebuild (depends on strategy)

**Implementation Choice (See Section 8.6):**
- **Eager:** Process immediately on knowledge save
- **Lazy:** Process on first fact extraction or search request

---

### 3.2 Fact Creation & Reference Linking

**Input:** Extracted fact (key-value pair) for a friend

**Process:**

1. **Create Fact Entry**
   - Generate unique `fact_id` (ObjectId)
   - Add fact to `friend_summaries.facts` array
   - If friend summary doesn't exist, create new document
   - Facts are semantic concepts, not directly embedded

2. **Search for Supporting Chunks**
   - Construct search query from fact: `"The friend's {key} is {value}"`
   - Embed query via `EmbeddingService`
   - Search FAISS index with query embedding
   - Parameters from config: `TOP_K_CHUNKS`, `MIN_RELEVANCE_THRESHOLD`

3. **Select Top References**
   - Rank chunks by relevance score
   - Select top N from config: `MAX_REFERENCES_PER_FACT`
   - Store in `fact_references` collection with rank and scores

4. **Calculate Initial Stability**
   - **0 references:** `stability_score = 0.0`, mark unstable
   - **1 reference:** Trigger AI validation (Section 3.3)
   - **2+ references:** Calculate composite score (Section 3.4)
   - Update fact in `friend_summaries.facts` array with calculated score

---

### 3.3 AI Validation (Single Reference Case)

**Trigger:** Fact has only one supporting chunk above threshold

**Process:**

1. **Fetch Chunk Text**
   - Retrieve chunk from `knowledge_chunks` using `chunk_id`

2. **AI Validation Prompt**
   - System: "You are a fact validator. Determine if a fact is supported by this text."
   - User: Provide chunk text and fact (key-value)
   - Request JSON response with validation result

3. **Parse Validation Result**
   - Extract: `is_valid` (bool), `confidence` (float), `reasoning` (str)
   - Confidence threshold from config: `MIN_VALIDATION_CONFIDENCE`

4. **Update Fact & Reference**
   - If valid: Set `stability_score = confidence`, `validated = True`
   - If invalid: Set `stability_score = confidence`, `validated = False`
   - Update fact in `friend_summaries.facts` array using `fact_id`
   - Update reference with validation details in `fact_references`

---

### 3.4 Stability Scoring (Multiple References)

**Trigger:** Fact has 2+ supporting chunks

**Algorithm:**

1. **Calculate Average Relevance**
   - Mean of all reference `relevance_score` values

2. **Calculate Reference Count Bonus**
   - Normalize reference count: `min(count / MAX_REFERENCES_PER_FACT, 1.0)`

3. **Composite Score**
   - Weights from config: `STABILITY_WEIGHT_RELEVANCE`, `STABILITY_WEIGHT_COUNT`
   - Formula: `(avg_relevance × weight_relevance) + (count_bonus × weight_count)`

4. **Update Fact**
   - Set `stability_score` to calculated value
   - Mark `validated = True` (auto-validated with multiple sources)
   - Update fact in `friend_summaries.facts` array using `fact_id`

---

### 3.5 Chunk Embedding Storage & Retrieval

**Purpose:** Persist chunk embeddings to avoid recomputing

**On Chunk Creation:**
1. Generate embedding via `EmbeddingService`
2. Store in `chunk_embeddings` with chunk metadata
3. Add to FAISS index (incremental or rebuild)

**On Chunk Deletion:**
1. Remove from `chunk_embeddings`
2. Trigger FAISS index rebuild for friend

**On FAISS Index Build:**
1. Fetch all chunk embeddings for friend from MongoDB
2. Build index in memory with chunk_id mapping
3. Cache index per friend with LRU eviction policy

**Benefits:**
- Embeddings computed once per chunk
- Fast FAISS rebuilds (no API calls)
- Automatic invalidation when knowledge changes

---

## 4. Maintenance Workflows

### 4.1 Knowledge Deleted

**Trigger:** `FriendKnowledge` deleted from PostgreSQL

**Actions:**
1. Delete all chunks for this knowledge from `knowledge_chunks`
2. Cascade delete embeddings from `chunk_embeddings`
3. Find all facts referencing these chunks via `fact_references`
4. Re-evaluate stability for affected facts (may become unstable)
5. Rebuild FAISS index for friend

---

### 4.2 Knowledge Updated

**Trigger:** `FriendKnowledge.text` modified in PostgreSQL

**Actions:**
1. Calculate new text hash and compare with stored value
2. If text unchanged, skip processing
3. If text changed:
   - Delete old chunks and embeddings
   - Trigger chunking workflow (Section 3.1)
   - Generate new chunk embeddings
   - Find affected facts via old chunk references
   - Re-evaluate stability for affected facts
   - Update FAISS index (incremental or rebuild)

---

### 4.3 Re-evaluate Fact Stability

**Purpose:** Recalculate stability when supporting chunks change

**Process:**
1. Construct search query from fact (key-value)
2. Re-run vector search against current FAISS index
3. Delete old references from `fact_references`
4. Create new references based on current top-K chunks
5. Recalculate stability score:
   - 0 chunks: Mark unstable (`stability_score = 0`)
   - 1 chunk: Trigger AI validation
   - 2+ chunks: Calculate composite score
6. Update fact in `friend_summaries.facts` array with new stability and validation status

---

## 5. Service Layer Overview

### 5.1 ChunkingService
- Split knowledge text into chunks based on config parameters
- Store chunks in `knowledge_chunks` with position metadata
- Handle chunk deletion when knowledge changes
- Track text hash for change detection

### 5.2 EmbeddingService (Existing - Extended)
- Generate embeddings for chunks via HuggingFace API
- Batch processing with size from config: `EMBEDDING_BATCH_SIZE`
- Cache embeddings in Redis (temporary)
- Store embeddings in MongoDB `chunk_embeddings` (permanent)

### 5.3 FAISService
- Manage per-friend FAISS indexes in memory
- Build indexes from `chunk_embeddings` collection
- Search with parameters from config: `TOP_K_CHUNKS`, `MIN_RELEVANCE_THRESHOLD`
- Convert L2 distances to similarity scores
- Handle incremental updates or full rebuilds
- Thread-safe index operations with async locks

### 5.4 FactService (Replaces/Extends KnowledgeService)
- Extract facts from knowledge using AI prompts
- Add/update facts in `friend_summaries.facts` array
- Link facts to supporting chunks via vector search
- Calculate stability scores using configured weights
- Trigger AI validation for single-reference cases
- Handle fact re-evaluation workflows
- Provide frontend-ready fact table format

---

## 6. API Endpoints

### 6.1 Python/FastAPI (ai_agent)

**Summary/Fact Management:**
- `POST /summaries/extract/{friend_id}` - Extract facts from knowledge using AI (replaces old summary generation)
- `GET /summaries/{friend_id}` - Get all facts for friend (frontend table format)
- `GET /summaries/{friend_id}/facts` - Same as above (alias for clarity)
- `POST /summaries/{friend_id}/facts/{fact_id}/validate` - Manually trigger AI validation
- `GET /summaries/{friend_id}/facts/{fact_id}/references` - Get supporting chunks for a fact
- `POST /summaries/{friend_id}/facts/{fact_id}/re-evaluate` - Re-calculate stability
- `DELETE /summaries/{friend_id}/facts/{fact_id}` - Remove fact from summary and delete references

**Chunk Management (Internal):**
- `POST /chunks/generate/{knowledge_id}` - Trigger chunking workflow
- `POST /chunks/rebuild/{friend_id}` - Rebuild all chunks for friend
- `GET /chunks/{knowledge_id}` - Get chunks for knowledge item

**FAISS Management:**
- `POST /faiss/rebuild/{friend_id}` - Force FAISS index rebuild
- `GET /faiss/stats/{friend_id}` - Get index statistics

### 6.2 Java/Spring Boot Integration

**Webhook Notifications to Python Service:**
- Knowledge created → Trigger chunking (if eager mode)
- Knowledge updated → Trigger chunk regeneration
- Knowledge deleted → Clean up chunks and re-evaluate facts

**Implementation:** Add webhook calls in `FriendKnowledgeService` methods

---

## 7. Implementation Phases

### Phase 1: Foundation & Chunking (Week 1)
- [x] Add timestamps to `FriendKnowledge` entity  
- [ ] **Migrate** existing `friend_summaries` schema (backup old data)
- [ ] Create new MongoDB collections with indexes (`knowledge_chunks`, `chunk_embeddings`, `fact_references`)
- [ ] Implement `ChunkingService` with configurable parameters
- [ ] Create Pydantic schemas for restructured `friend_summaries`

### Phase 2: Embedding Storage & FAISS (Week 2)
- [ ] Implement `chunk_embeddings` persistence
- [ ] Build FAISS index from MongoDB
- [ ] Implement vector search in `FAISService`
- [ ] Add incremental updates or rebuild logic

### Phase 3: Fact Extraction & Linking (Week 3)
- [ ] Create AI fact extraction prompts (replace old summary prompt)
- [ ] **Refactor** `KnowledgeService` to work with structured facts
- [ ] Implement fact linking with reference creation
- [ ] Build stability scoring (both modes)
- [ ] Update API endpoints (maintain backward compatibility if needed)

### Phase 4: Validation & Maintenance (Week 4)
- [ ] Implement AI validation for single-reference facts
- [ ] Create re-evaluation workflows
- [ ] Add webhook integration (Java → Python)
- [ ] Handle knowledge update/delete propagation
- [ ] Update Redis caching logic (key structure unchanged)

### Phase 5: Testing & Production (Week 5)
- [ ] Unit and integration tests
- [ ] Performance testing
- [ ] **Frontend fact table UI** (primary use case)
- [ ] Production deployment with data migration script

---

## 8. Open Questions & Decisions

### 8.1 FAISS Index Storage
**Recommendation:** Per-friend indexes in memory + optional disk persistence
- Improves search performance through isolation
- Embeddings in MongoDB enable fast rebuild

### 8.2 Fact Extraction Trigger
**Recommendation:** Hybrid approach
- Manual API trigger for initial extraction
- Automatic async job for new knowledge
- Scheduled batch re-extraction

### 8.3 Stability Threshold
**Recommendation:** Mark as unvalidated but keep (no auto-delete)
- Preserve all data
- Allow manual review via UI
- Filter unstable facts in queries

### 8.4 Recency Weighting
**Decision Needed:** Enable recency boost by default or make configurable?
- Could improve relevance for evolving knowledge
- Adds complexity to scoring
- **Suggested:** Make configurable with default = disabled

### 8.5 Conflicting Facts
**Recommendation:** Keep version history with timestamps
- Mark most recent/stable as "active"
- UI shows timeline of changes
- Allows tracking knowledge evolution

### 8.6 Chunking Strategy (NEW)
**Question:** When to generate chunks and embeddings?

**Options:**
- **A - Eager:** Process immediately on knowledge create/update
  - Pros: Chunks always ready, faster fact extraction
  - Cons: Upfront processing cost, API calls even if unused

- **B - Lazy:** Process on first fact extraction or search request
  - Pros: No unnecessary processing, saves API calls
  - Cons: First-use latency, complexity in trigger logic

**Recommendation:** **Eager mode** with async processing
- Trigger chunking workflow on knowledge save
- Process async (don't block user)
- Keeps system ready for immediate fact extraction
- Simplifies architecture (no lazy-load logic)
- Config flag to enable/disable: `CHUNKING_MODE="eager"|"lazy"`

---

## 9. Configuration Reference

All "magic numbers" should be defined in `config/settings.py`:

```python
# Chunking
CHUNK_SIZE_WORDS = 100              # Words per chunk
CHUNK_OVERLAP_WORDS = 20            # Overlap between chunks
CHUNKING_MODE = "eager"             # "eager" | "lazy"

# Embedding
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384
EMBEDDING_BATCH_SIZE = 50

# FAISS
FAISS_INDEX_TYPE = "IndexFlatL2"   # or "IndexIVFFlat"
TOP_K_CHUNKS = 5                    # Chunks to retrieve
MIN_RELEVANCE_THRESHOLD = 0.7       # Minimum cosine similarity

# Facts
MAX_REFERENCES_PER_FACT = 3         # Top chunks per fact
MIN_VALIDATION_CONFIDENCE = 0.8     # AI validation threshold
MIN_STABILITY_SCORE = 0.5           # Filter threshold

# Stability Scoring
STABILITY_WEIGHT_RELEVANCE = 0.7    # Quality weight
STABILITY_WEIGHT_COUNT = 0.3        # Quantity weight

# Recency (optional)
RECENCY_ENABLED = False
RECENCY_DECAY_DAYS = 365
RECENCY_BOOST_FACTOR = 0.2
```

---

## 10. Success Metrics

**Quality Metrics:**
- Fact precision (% correct among high-stability facts)
- Fact recall (% of correct facts extracted from knowledge)
- Stability score correlation with actual validity

**Performance Metrics:**
- Chunk generation time (per knowledge item)
- Embedding generation time (per batch)
- FAISS search latency (p95 < 100ms)
- Fact extraction time (per friend)

**System Metrics:**
- MongoDB collection sizes
- FAISS index memory usage
- API call volume to HuggingFace
- Cache hit rates (Redis, FAISS)

---
**End of Plan** | Last Updated: November 13, 2025

