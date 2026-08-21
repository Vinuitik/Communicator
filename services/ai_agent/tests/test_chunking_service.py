"""Tests for ChunkingService's multi-entity support (2026-08-20 feature):
source_type + friend_id/group_id/connection_friend*_id tagging on
knowledge_chunks rows, and the "exactly one subject" validation that
enforces it (mirrors the JVM meeting module's Meeting.validateExactlyOneSubject()
invariant, applied here since this is raw asyncpg SQL with no ORM entity to
hang a DB-level check off of).
"""
import asyncio
from unittest.mock import AsyncMock

import pytest

from services.chunking_service import ChunkingService


class FakeEmbeddingService:
    """Minimal stand-in for EmbeddingService — just enough surface for
    ChunkingService.process_knowledge (embed_texts + get_embedding_dimension).
    """

    def __init__(self):
        self.embed_texts_calls = []

    async def embed_texts(self, texts):
        self.embed_texts_calls.append(list(texts))
        return [[0.1] * 768 for _ in texts]

    def get_embedding_dimension(self):
        return 768


def make_service():
    embedding_service = FakeEmbeddingService()
    chunk_repo = AsyncMock()
    chunk_repo.find_many.return_value = []  # no existing chunks/refs
    chunk_repo.insert_many.return_value = 0
    chunk_repo.delete_many.return_value = 0
    service = ChunkingService(embedding_service, chunk_repo)
    return service, embedding_service, chunk_repo


# ── "exactly one subject" validation ─────────────────────────────────────

def test_process_knowledge_rejects_no_subject():
    service, _, _ = make_service()
    with pytest.raises(ValueError, match="Exactly one subject"):
        asyncio.run(service.process_knowledge(
            knowledge_id=1, knowledge_text="some text", source_type="FRIEND"
        ))


def test_process_knowledge_rejects_multiple_subjects():
    service, _, _ = make_service()
    with pytest.raises(ValueError, match="Exactly one subject"):
        asyncio.run(service.process_knowledge(
            knowledge_id=1, knowledge_text="some text",
            source_type="FRIEND", friend_id=5, group_id=7
        ))


def test_process_knowledge_rejects_mismatched_source_type():
    service, _, _ = make_service()
    with pytest.raises(ValueError, match="doesn't match"):
        asyncio.run(service.process_knowledge(
            knowledge_id=1, knowledge_text="some text",
            source_type="GROUP", friend_id=5
        ))


def test_process_knowledge_rejects_partial_connection_ids():
    service, _, _ = make_service()
    with pytest.raises(ValueError, match="must both be set"):
        asyncio.run(service.process_knowledge(
            knowledge_id=1, knowledge_text="some text",
            source_type="CONNECTION", connection_friend1_id=2
        ))


def test_process_knowledge_rejects_invalid_source_type():
    service, _, _ = make_service()
    with pytest.raises(ValueError, match="Invalid source_type"):
        asyncio.run(service.process_knowledge(
            knowledge_id=1, knowledge_text="some text",
            source_type="PET", friend_id=5
        ))


# ── happy path: source columns actually get persisted ────────────────────

def test_process_knowledge_persists_friend_chunk_backward_compatible():
    """Default source_type="FRIEND" (no source_type/friend_id passed) is the
    old lazy-chunking call shape — must keep working unchanged."""
    service, embedding_service, chunk_repo = make_service()

    chunk_ids = asyncio.run(service.process_knowledge(
        knowledge_id=1, knowledge_text="short friend note", friend_id=42
    ))

    assert len(chunk_ids) == 1
    inserted_docs = chunk_repo.insert_many.call_args_list[0].args[1]
    assert inserted_docs[0]["source_type"] == "FRIEND"
    assert inserted_docs[0]["friend_id"] == 42
    assert inserted_docs[0]["group_id"] is None
    assert inserted_docs[0]["connection_friend1_id"] is None


def test_process_knowledge_persists_group_chunk():
    service, embedding_service, chunk_repo = make_service()

    chunk_ids = asyncio.run(service.process_knowledge(
        knowledge_id=2, knowledge_text="this group meets biweekly",
        source_type="GROUP", group_id=9
    ))

    assert len(chunk_ids) == 1
    inserted_docs = chunk_repo.insert_many.call_args_list[0].args[1]
    assert inserted_docs[0]["source_type"] == "GROUP"
    assert inserted_docs[0]["group_id"] == 9
    assert inserted_docs[0]["friend_id"] is None
    assert inserted_docs[0]["connection_friend1_id"] is None
    assert inserted_docs[0]["connection_friend2_id"] is None


def test_process_knowledge_persists_connection_chunk_with_both_ids():
    service, embedding_service, chunk_repo = make_service()

    chunk_ids = asyncio.run(service.process_knowledge(
        knowledge_id=3, knowledge_text="always argue about politics",
        source_type="CONNECTION", connection_friend1_id=2, connection_friend2_id=9
    ))

    assert len(chunk_ids) == 1
    inserted_docs = chunk_repo.insert_many.call_args_list[0].args[1]
    assert inserted_docs[0]["source_type"] == "CONNECTION"
    assert inserted_docs[0]["connection_friend1_id"] == 2
    assert inserted_docs[0]["connection_friend2_id"] == 9
    assert inserted_docs[0]["friend_id"] is None
    assert inserted_docs[0]["group_id"] is None
    # embeddings were actually generated for the one chunk produced
    assert len(embedding_service.embed_texts_calls) == 1
