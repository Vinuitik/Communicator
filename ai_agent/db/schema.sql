-- Chunk storage + hybrid search backing tables. Applied idempotently at
-- ai_agent startup (PostgresRepository.initialize()) — every statement here
-- must be safe to re-run. Replaces the Mongo `knowledge_chunks` /
-- `chunk_embeddings` collections. chunk_text is new: chunks used to be
-- reconstructed on demand from the JVM's full knowledge text via
-- char_start/char_end, but pg_search's BM25 index needs real text in a
-- real column, so it's persisted here now.

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    chunk_id     TEXT PRIMARY KEY,
    knowledge_id INTEGER NOT NULL,
    chunk_index  INTEGER NOT NULL,
    chunk_text   TEXT NOT NULL,
    word_count   INTEGER NOT NULL,
    char_start   INTEGER NOT NULL,
    char_end     INTEGER NOT NULL,
    text_hash    TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_knowledge_id
    ON knowledge_chunks (knowledge_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hash
    ON knowledge_chunks (knowledge_id, text_hash);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_bm25
    ON knowledge_chunks USING bm25 (chunk_id, chunk_text)
    WITH (key_field='chunk_id');

CREATE TABLE IF NOT EXISTS chunk_embeddings (
    chunk_id   TEXT PRIMARY KEY REFERENCES knowledge_chunks(chunk_id) ON DELETE CASCADE,
    embedding  vector(768) NOT NULL,
    model_name TEXT NOT NULL,
    dimension  INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_hnsw
    ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);
