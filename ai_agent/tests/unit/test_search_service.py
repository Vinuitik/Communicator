"""Unit tests for SearchService.

FAISS is used in-memory (no mock). MongoDB and FriendApiService are mocked.
"""
import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.search_service import SearchService


def _make_service(embedding_service=None, friend_api_service=None, mongo_repo=None, *,
                  top_k=5, threshold=0.0, index_type="IndexFlatIP"):
    embedding_service = embedding_service or AsyncMock()
    friend_api_service = friend_api_service or AsyncMock()
    mongo_repo = mongo_repo or AsyncMock()
    with patch("services.search_service.settings") as s:
        s.top_k_chunks = top_k
        s.faiss_index_type = index_type
        s.min_relevance_threshold = threshold
        return SearchService(embedding_service, friend_api_service, mongo_repo)


def _unit_vec(seed: int = 0, dim: int = 384) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.random(dim).astype(np.float32)
    return v / np.linalg.norm(v)


# ---------------------------------------------------------------------------
# build_index_for_friend
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_build_index_no_knowledge_ids_returns_false(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[])
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    result = await svc.build_index_for_friend(friend_id=1)
    assert result is False


@pytest.mark.unit
async def test_build_index_no_chunks_returns_false(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1, 2])
    # chunks collection returns empty
    mock_mongo_repo.find_many = AsyncMock(return_value=[])
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    result = await svc.build_index_for_friend(friend_id=1)
    assert result is False


@pytest.mark.unit
async def test_build_index_no_embeddings_returns_false(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1])
    mock_mongo_repo.find_many = AsyncMock(
        side_effect=[
            [{"chunk_id": "c1"}],  # chunks call
            [],                     # embeddings call → empty
        ]
    )
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    result = await svc.build_index_for_friend(friend_id=1)
    assert result is False


@pytest.mark.unit
async def test_build_index_success_adds_to_indexes(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    vec = _unit_vec(0).tolist()
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1])
    mock_mongo_repo.find_many = AsyncMock(
        side_effect=[
            [{"chunk_id": "c1"}],
            [{"chunk_id": "c1", "embedding": vec}],
        ]
    )
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    result = await svc.build_index_for_friend(friend_id=99)
    assert result is True
    assert 99 in svc.indexes


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_search_lazy_builds_index_when_missing(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    vec = _unit_vec(0).tolist()
    query_vec = _unit_vec(0)  # identical to stored → should score ~1.0

    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1])
    mock_mongo_repo.find_many = AsyncMock(
        side_effect=[
            [{"chunk_id": "c1"}],
            [{"chunk_id": "c1", "embedding": vec}],
        ]
    )
    mock_embedding_service.embed_query = AsyncMock(return_value=query_vec.tolist())

    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo,
                        top_k=1, threshold=0.0)
    results = await svc.search(friend_id=1, query="test query")

    assert len(results) == 1
    chunk_id, score = results[0]
    assert chunk_id == "c1"


@pytest.mark.unit
async def test_search_threshold_filters_low_scores(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    # Use orthogonal vectors so their similarity is ~0, well below threshold=0.9
    vec_stored = np.zeros(384, dtype=np.float32)
    vec_stored[0] = 1.0
    query_vec = np.zeros(384, dtype=np.float32)
    query_vec[1] = 1.0  # orthogonal

    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1])
    mock_mongo_repo.find_many = AsyncMock(
        side_effect=[
            [{"chunk_id": "c1"}],
            [{"chunk_id": "c1", "embedding": vec_stored.tolist()}],
        ]
    )
    mock_embedding_service.embed_query = AsyncMock(return_value=query_vec.tolist())

    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo,
                        top_k=5, threshold=0.9)
    results = await svc.search(friend_id=1, query="query")
    assert results == []


@pytest.mark.unit
async def test_search_returns_empty_when_index_build_fails(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[])
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    results = await svc.search(friend_id=404, query="anything")
    assert results == []


# ---------------------------------------------------------------------------
# clear_index / clear_all_indexes
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_clear_index_removes_entry(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    vec = _unit_vec(0).tolist()
    mock_friend_api_service.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1])
    mock_mongo_repo.find_many = AsyncMock(
        side_effect=[
            [{"chunk_id": "c1"}],
            [{"chunk_id": "c1", "embedding": vec}],
        ]
    )
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    await svc.build_index_for_friend(friend_id=5)
    assert 5 in svc.indexes
    svc.clear_index(5)
    assert 5 not in svc.indexes


@pytest.mark.unit
async def test_clear_all_indexes_empties_dict(
    mock_embedding_service, mock_friend_api_service, mock_mongo_repo
):
    svc = _make_service(mock_embedding_service, mock_friend_api_service, mock_mongo_repo)
    # Manually inject a fake entry
    import faiss
    idx = faiss.IndexFlatIP(4)
    svc.indexes[1] = (idx, ["c1"])
    svc.indexes[2] = (idx, ["c2"])
    svc.clear_all_indexes()
    assert svc.indexes == {}


# ---------------------------------------------------------------------------
# get_index_stats
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_get_index_stats_returns_none_for_absent_friend():
    svc = _make_service()
    assert svc.get_index_stats(999) is None


@pytest.mark.unit
def test_get_index_stats_returns_dict_for_present_friend():
    svc = _make_service()
    import faiss
    idx = faiss.IndexFlatIP(384)
    svc.indexes[42] = (idx, ["c1", "c2"])
    stats = svc.get_index_stats(42)
    assert stats["friend_id"] == 42
    assert stats["chunk_count"] == 2
    assert stats["dimension"] == 384
