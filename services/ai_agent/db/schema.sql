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

-- Multi-entity support (2026-08-20): knowledge_chunks used to be Friend-only
-- (knowledge_id pointed at a friend_knowledge row and that was implicit).
-- Now also covers GroupKnowledge and ConnectionsKnowledge, so each row is
-- explicitly tagged with which of the three it came from. Same "exactly one
-- subject" invariant as the JVM meeting module's Meeting entity
-- (Meeting.validateExactlyOneSubject()) — there's no ORM here to hang a real
-- entity validator off of, so it's enforced in the write path instead
-- (ChunkingService.process_knowledge), not a DB CHECK constraint.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'FRIEND';
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS friend_id INTEGER;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS connection_friend1_id BIGINT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS connection_friend2_id BIGINT;

-- One-time backfill for rows that predate the columns above: every existing
-- knowledge_chunks row was implicitly a Friend chunk. knowledge_id is
-- FriendKnowledge.id (JVM's friend_knowledge.id) — same Postgres instance/
-- database as this service, so a direct join recovers friend_id without a
-- one-off script or an HTTP round trip. No-op once every row has been
-- backfilled (WHERE friend_id IS NULL guards re-runs at every boot).
UPDATE knowledge_chunks kc
SET friend_id = fk.friend_id, source_type = 'FRIEND'
FROM friend_knowledge fk
WHERE kc.knowledge_id = fk.id
  AND kc.friend_id IS NULL
  AND kc.group_id IS NULL
  AND kc.connection_friend1_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_friend_id
    ON knowledge_chunks (friend_id) WHERE friend_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_group_id
    ON knowledge_chunks (group_id) WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_connection
    ON knowledge_chunks (connection_friend1_id, connection_friend2_id)
    WHERE connection_friend1_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chunk_embeddings (
    chunk_id   TEXT PRIMARY KEY REFERENCES knowledge_chunks(chunk_id) ON DELETE CASCADE,
    embedding  vector(768) NOT NULL,
    model_name TEXT NOT NULL,
    dimension  INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_hnsw
    ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);

-- Friend fact summaries. facts is a JSONB array of {fact_id, key, value,
-- stability_score, validated, created_at, updated_at} — kept as an array-in-
-- JSONB (matching the old Mongo shape) rather than a child table, since
-- FactRepository's access pattern is always "whole array for one friend."
-- Mutated via jsonb_array_elements()/jsonb_agg() in fact_repository.py
-- (push/pull/positional-update), not through PostgresRepository's generic
-- find/insert adapter.
CREATE TABLE IF NOT EXISTS friend_summaries (
    friend_id    INTEGER PRIMARY KEY,
    facts        JSONB NOT NULL DEFAULT '[]'::jsonb,
    fact_count   INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fact-to-chunk references (which chunks support a given fact, ranked).
CREATE TABLE IF NOT EXISTS fact_references (
    fact_id               TEXT NOT NULL,
    chunk_id              TEXT NOT NULL,
    knowledge_id          INTEGER NOT NULL,
    friend_id             INTEGER NOT NULL,
    relevance_score       DOUBLE PRECISION NOT NULL,
    validated             BOOLEAN NOT NULL DEFAULT FALSE,
    validation_confidence DOUBLE PRECISION,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    rank                  INTEGER NOT NULL,
    PRIMARY KEY (fact_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_references_friend_id
    ON fact_references (friend_id);

-- LLM provider settings (2026-07-23). Singleton mode toggle (ollama = local,
-- private, no data leaves the box; cloud = routed through host-wrapper's
-- multi-provider fanout with failover). Read/written by both ai_agent
-- (settings UI backend) AND host-wrapper (to know which providers are
-- configured) — same Postgres instance, reachable from host-wrapper via
-- localhost:5433 since it's containerized on the same compose network now.
CREATE TABLE IF NOT EXISTS llm_settings (
    id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton row
    mode       TEXT NOT NULL DEFAULT 'ollama' CHECK (mode IN ('ollama', 'cloud')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO llm_settings (id, mode) VALUES (1, 'ollama')
    ON CONFLICT (id) DO NOTHING;

-- One row per cloud provider host-wrapper's llm_router.py knows about.
-- encrypted_key is AES-256-GCM ciphertext (see EncryptionService in both
-- ai_agent and host-wrapper) — NULL/absent row = provider not configured,
-- llm_router already skips unconfigured providers on its own.
CREATE TABLE IF NOT EXISTS llm_provider_keys (
    provider      TEXT PRIMARY KEY,
    encrypted_key BYTEA NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
