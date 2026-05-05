"""Integration tests: SearchService + EmbeddingService (in-memory FAISS).

Ollama API mocked via aioresponses. No MongoDB needed for the search itself
(embeddings are injected directly into the FAISS index).
"""
import numpy as np
import pytest
import faiss
from aioresponses import aioresponses
from unittest.mock import AsyncMock, MagicMock, patch

from services.embedding_service import EmbeddingService
from services.search_service import SearchService

OLLAMA_URL = "http://ollama-test:11434/api/embeddings"
DIM = 384


def _unit_vec(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.random(DIM).astype(np.float32)
    return v / np.linalg.norm(v)


def _make_embedding_service():
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
        return EmbeddingService()


def _make_search_service(embedding_svc, friend_api_svc=None, mongo_repo=None, *,
                         top_k=5, threshold=0.0):
    friend_api_svc = friend_api_svc or AsyncMock()
    mongo_repo = mongo_repo or AsyncMock()
    with patch("services.search_service.settings") as s:
        s.top_k_chunks = top_k
        s.faiss_index_type = "IndexFlatIP"
        s.min_relevance_threshold = threshold
        return SearchService(embedding_svc, friend_api_svc, mongo_repo)


def _inject_index(search_svc, vectors: dict):
    """Directly inject pre-built FAISS index for a friend to skip build_index."""
    chunk_ids = list(vectors.keys())
    matrix = np.array(list(vectors.values()), dtype=np.float32)
    faiss.normalize_L2(matrix)
    idx = faiss.IndexFlatIP(DIM)
    idx.add(matrix)
    search_svc.indexes[1] = (idx, chunk_ids)


# ---------------------------------------------------------------------------
# Relevant chunk surfaces in top results
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_search_returns_most_similar_chunk():
    """Query vector identical to chunk_2 → chunk_2 should rank first."""
    vec_1 = _unit_vec(10)
    vec_2 = _unit_vec(20)
    vec_3 = _unit_vec(30)

    embedding_svc = _make_embedding_service()
    search_svc = _make_search_service(embedding_svc, threshold=0.0)

    # Pre-build the index
    _inject_index(search_svc, {"c1": vec_1, "c2": vec_2, "c3": vec_3})

    # Query is almost identical to vec_2
    query_vec = vec_2.copy()

    with aioresponses() as m:
        m.post(OLLAMA_URL, payload={"embedding": query_vec.tolist()})
        results = await search_svc.search(friend_id=1, query="test")

    assert len(results) > 0
    top_chunk_id = results[0][0]
    assert top_chunk_id == "c2"


@pytest.mark.integration
async def test_search_respects_top_k():
    """With top_k=2 and 5 chunks, only 2 results are returned."""
    vecs = {f"c{i}": _unit_vec(i) for i in range(5)}
    embedding_svc = _make_embedding_service()
    search_svc = _make_search_service(embedding_svc, top_k=2, threshold=0.0)
    _inject_index(search_svc, vecs)

    query_vec = _unit_vec(0)  # matches c0 best

    with aioresponses() as m:
        m.post(OLLAMA_URL, payload={"embedding": query_vec.tolist()})
        results = await search_svc.search(friend_id=1, query="query", top_k=2)

    assert len(results) <= 2


@pytest.mark.integration
async def test_rebuild_index_picks_up_new_chunk(
    mock_friend_api_service, mock_mongo_repo
):
    """After rebuild, a newly added chunk embedding appears in search results."""
    new_vec = _unit_vec(99)
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[5])
    mock_mongo_repo.find_many = AsyncMock(
        side_effect=[
            [{"chunk_id": "new_c"}],
            [{"chunk_id": "new_c", "embedding": new_vec.tolist()}],
        ]
    )

    embedding_svc = _make_embedding_service()
    search_svc = _make_search_service(
        embedding_svc, mock_friend_api_service, mock_mongo_repo,
        top_k=3, threshold=0.0,
    )

    success = await search_svc.rebuild_index(friend_id=1)
    assert success is True
    assert 1 in search_svc.indexes

    _, chunk_id_mapping = search_svc.indexes[1]
    assert "new_c" in chunk_id_mapping
