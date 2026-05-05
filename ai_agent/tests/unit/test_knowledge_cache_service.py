"""Unit tests for KnowledgeCacheService."""
import pytest
from unittest.mock import AsyncMock

from services.knowledge_cache_service import KnowledgeCacheService


def _make_service(redis_repo):
    return KnowledgeCacheService(redis_repo=redis_repo)


# ---------------------------------------------------------------------------
# is_summary_cached
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_cache_miss_returns_false(mock_redis_repo):
    mock_redis_repo.get = AsyncMock(return_value=None)
    svc = _make_service(mock_redis_repo)
    result = await svc.is_summary_cached(friend_id=42)
    assert result is False
    mock_redis_repo.get.assert_called_once_with("friend_summary:42")


@pytest.mark.unit
async def test_cache_hit_returns_true(mock_redis_repo):
    mock_redis_repo.get = AsyncMock(return_value=b"cached")
    svc = _make_service(mock_redis_repo)
    result = await svc.is_summary_cached(friend_id=7)
    assert result is True


# ---------------------------------------------------------------------------
# cache_summary
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_cache_summary_stores_marker(mock_redis_repo):
    svc = _make_service(mock_redis_repo)
    await svc.cache_summary(friend_id=99)
    mock_redis_repo.set.assert_called_once_with("friend_summary:99", "cached")


# ---------------------------------------------------------------------------
# invalidate_summary
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_invalidate_summary_deletes_key(mock_redis_repo):
    svc = _make_service(mock_redis_repo)
    await svc.invalidate_summary(friend_id=5)
    mock_redis_repo.delete.assert_called_once_with("friend_summary:5")


# ---------------------------------------------------------------------------
# get_all_cached_friend_ids
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_get_all_cached_friend_ids_extracts_ids(mock_redis_repo):
    mock_redis_repo.keys = AsyncMock(
        return_value=["friend_summary:1", "friend_summary:2", "friend_summary:3"]
    )
    svc = _make_service(mock_redis_repo)
    ids = await svc.get_all_cached_friend_ids()
    assert sorted(ids) == [1, 2, 3]


@pytest.mark.unit
async def test_get_all_cached_friend_ids_empty(mock_redis_repo):
    mock_redis_repo.keys = AsyncMock(return_value=[])
    svc = _make_service(mock_redis_repo)
    ids = await svc.get_all_cached_friend_ids()
    assert ids == []


@pytest.mark.unit
async def test_get_all_cached_friend_ids_skips_invalid_keys(mock_redis_repo):
    mock_redis_repo.keys = AsyncMock(
        return_value=["friend_summary:10", "friend_summary:malformed_key"]
    )
    svc = _make_service(mock_redis_repo)
    ids = await svc.get_all_cached_friend_ids()
    # Only numeric ID should be returned
    assert 10 in ids
    assert len(ids) == 1
