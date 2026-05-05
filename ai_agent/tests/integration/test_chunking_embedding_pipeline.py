"""Integration tests: ChunkingService wired with EmbeddingService.

Ollama HTTP is mocked via aioresponses.
Repositories are AsyncMocks so no MongoDB is needed.
"""
import pytest
from aioresponses import aioresponses
from unittest.mock import AsyncMock, MagicMock, patch

from services.embedding_service import EmbeddingService
from services.chunking_service import ChunkingService

OLLAMA_URL = "http://ollama-test:11434/api/embeddings"
DIM = 384
FAKE_VEC = [0.01] * DIM


def _make_embedding_service(redis_repo=None):
    with patch("services.embedding_service.settings") as s:
        s.get_embedding_config.return_value = {
            "model": "test-model",
            "timeout": 5,
            "max_retries": 1,
            "batch_size": 32,
            "cache_embeddings": False,
            "embedding_cache_ttl": 3600,
            "ollama_url": "http://ollama-test:11434",
        }
        return EmbeddingService(redis_repo=redis_repo)


def _make_chunking_service(chunk_repo, embedding_repo, embedding_service, *,
                           chunk_size=10, overlap=2, min_size=5):
    with patch("services.chunking_service.settings") as s:
        s.chunk_size_words = chunk_size
        s.chunk_overlap_words = overlap
        s.min_chunk_size_words = min_size
        s.chunking_mode = "eager"
        s.embedding_model = "test-model"
        return ChunkingService(embedding_service, chunk_repo, embedding_repo)


# ---------------------------------------------------------------------------
# Happy path: text → split → embed → persist
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_process_knowledge_saves_chunks_and_embeddings(
    mock_chunk_repo, mock_embedding_repo
):
    """Process a medium-length text and verify both repos are written to."""
    # 20-word text: with chunk_size=10, overlap=2 → 2 chunks
    text = " ".join(f"word{i}" for i in range(20))

    # Repo setup: no existing chunks → triggers fresh processing
    mock_chunk_repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=[])
    chunk_ids_returned = ["chunk_1_0_abcd1234", "chunk_1_1_abcd1234"]
    chunk_docs = [
        {"chunk_id": chunk_ids_returned[0]},
        {"chunk_id": chunk_ids_returned[1]},
    ]
    mock_chunk_repo.create_chunk_documents = MagicMock(
        return_value=(chunk_docs, [text[:50], text[40:]], chunk_ids_returned)
    )
    mock_embedding_repo.create_embedding_documents = MagicMock(
        return_value=[{"chunk_id": cid} for cid in chunk_ids_returned]
    )

    embedding_svc = _make_embedding_service()
    chunking_svc = _make_chunking_service(
        mock_chunk_repo, mock_embedding_repo, embedding_svc
    )

    with aioresponses() as m:
        # One POST per chunk text
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})
        ids = await chunking_svc.process_knowledge(knowledge_id=1, knowledge_text=text)

    assert ids == chunk_ids_returned
    mock_chunk_repo.save_chunks.assert_called_once()
    mock_embedding_repo.save_embeddings.assert_called_once()


@pytest.mark.integration
async def test_process_knowledge_chunk_count_matches_text_length(
    mock_chunk_repo, mock_embedding_repo
):
    """Verify split produces the expected number of chunks for a known-length text."""
    # chunk_size=5, overlap=1 → step=4 words per advance
    # 13 words → chunk0: 0-4, chunk1: 4-8, chunk2: 8-12, chunk3: 12
    text = " ".join(f"w{i}" for i in range(13))
    mock_chunk_repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=[])

    embedding_svc = MagicMock()
    embedding_svc.embed_texts = AsyncMock(return_value=[[0.0] * DIM] * 10)
    embedding_svc.get_embedding_dimension = MagicMock(return_value=DIM)

    # Let the real _split_into_chunks run to verify the count
    chunking_svc = _make_chunking_service(
        mock_chunk_repo, mock_embedding_repo, embedding_svc,
        chunk_size=5, overlap=1, min_size=3,
    )

    raw_chunks = chunking_svc._split_into_chunks(text)
    # With step=4, 13 words → 4 chunks
    assert len(raw_chunks) == 4


@pytest.mark.integration
async def test_embedding_vectors_have_correct_dimension(
    mock_chunk_repo, mock_embedding_repo
):
    """Verify that each saved embedding has the expected dimension."""
    text = " ".join(f"w{i}" for i in range(20))
    mock_chunk_repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=[])

    saved_embedding_docs = []

    def capture_embedding_docs(docs):
        saved_embedding_docs.extend(docs)

    mock_embedding_repo.create_embedding_documents = MagicMock(
        side_effect=lambda ids, embeddings, dim, model: [
            {"chunk_id": cid, "embedding": emb, "dimension": dim}
            for cid, emb in zip(ids, embeddings)
        ]
    )
    mock_embedding_repo.save_embeddings = AsyncMock(
        side_effect=lambda docs: saved_embedding_docs.extend(docs)
    )

    chunk_ids = ["c1", "c2"]
    mock_chunk_repo.create_chunk_documents = MagicMock(
        return_value=(
            [{"chunk_id": "c1"}, {"chunk_id": "c2"}],
            ["chunk text 1", "chunk text 2"],
            chunk_ids,
        )
    )

    embedding_svc = _make_embedding_service()

    with patch("services.chunking_service.settings") as s:
        s.chunk_size_words = 10
        s.chunk_overlap_words = 2
        s.min_chunk_size_words = 5
        s.chunking_mode = "eager"
        s.embedding_model = "test-model"
        chunking_svc = ChunkingService(embedding_svc, mock_chunk_repo, mock_embedding_repo)

    with aioresponses() as m:
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})
        await chunking_svc.process_knowledge(1, text)

    for doc in saved_embedding_docs:
        assert doc["dimension"] == DIM
