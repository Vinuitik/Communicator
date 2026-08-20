"""Tests for SearchService.search_all — the cross-entity hybrid search
(2026-08-20 feature) that drops search()'s per-friend knowledge_id scoping
and instead groups/dedupes fused chunk hits by owning entity
(source_type + friend_id/group_id/connection_friend*_id), keeping each
entity's single best-scoring chunk.
"""
from unittest.mock import AsyncMock, MagicMock

import asyncio

from services.search_service import SearchService


def _row(**kwargs):
    """asyncpg Records support dict-style indexing — a plain dict is a fine stand-in."""
    return kwargs


class FakePool:
    """Minimal asyncpg-pool stand-in: `async with pool.acquire() as conn` plus a
    queue of canned `conn.fetch(...)` results, consumed in call order (search_all
    issues them as: vector candidates, BM25 candidates, then entity metadata).
    """

    def __init__(self, fetch_results):
        self._fetch_results = list(fetch_results)
        self.fetch_calls = []

    def acquire(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def fetch(self, query, *params):
        self.fetch_calls.append((query, params))
        return self._fetch_results.pop(0)


def make_service(fetch_results):
    embedding_service = AsyncMock()
    embedding_service.embed_query.return_value = [0.1] * 768
    friend_api_service = AsyncMock()
    postgres_repo = MagicMock()
    postgres_repo.pool = FakePool(fetch_results)
    service = SearchService(embedding_service, friend_api_service, postgres_repo)
    return service, postgres_repo.pool


def test_search_all_groups_by_owning_entity_keeping_best_chunk():
    service, pool = make_service([
        [_row(chunk_id="c1"), _row(chunk_id="c2")],  # vector candidates
        [_row(chunk_id="c1")],                        # bm25 candidates (c1 hit both -> higher fused score)
        [  # entity metadata for the fused candidate_ids
            _row(chunk_id="c1", source_type="FRIEND", friend_id=1, group_id=None,
                 connection_friend1_id=None, connection_friend2_id=None, chunk_text="loves hiking"),
            _row(chunk_id="c2", source_type="GROUP", friend_id=None, group_id=5,
                 connection_friend1_id=None, connection_friend2_id=None, chunk_text="book club notes"),
        ],
    ])

    results = asyncio.run(service.search_all("hiking", top_k=5))

    assert len(results) == 2
    # c1 (both rankers) scores higher than c2 (vector-only) -> sorted first.
    assert results[0]["chunk_id"] == "c1"
    assert results[0]["source_type"] == "FRIEND"
    assert results[0]["friend_id"] == 1
    assert results[1]["source_type"] == "GROUP"
    assert results[1]["group_id"] == 5
    # No per-friend scoping in the SQL, unlike search() -- confirm no knowledge_id filter param leaked in.
    vector_query, vector_params = pool.fetch_calls[0]
    assert "WHERE" not in vector_query or "knowledge_id" not in vector_query


def test_search_all_dedupes_multiple_chunks_from_same_friend():
    service, _ = make_service([
        [_row(chunk_id="c1"), _row(chunk_id="c2")],
        [],
        [
            _row(chunk_id="c1", source_type="FRIEND", friend_id=1, group_id=None,
                 connection_friend1_id=None, connection_friend2_id=None, chunk_text="chunk one"),
            _row(chunk_id="c2", source_type="FRIEND", friend_id=1, group_id=None,
                 connection_friend1_id=None, connection_friend2_id=None, chunk_text="chunk two"),
        ],
    ])

    results = asyncio.run(service.search_all("query", top_k=5))

    # Both chunks belong to the same friend (friend_id=1) -> collapsed to one entry,
    # keeping the higher-ranked chunk (c1, rank 1 in the vector candidates).
    assert len(results) == 1
    assert results[0]["friend_id"] == 1
    assert results[0]["chunk_id"] == "c1"


def test_search_all_respects_top_k_after_grouping():
    service, _ = make_service([
        [_row(chunk_id=f"c{i}") for i in range(4)],
        [],
        [
            _row(chunk_id=f"c{i}", source_type="FRIEND", friend_id=i, group_id=None,
                 connection_friend1_id=None, connection_friend2_id=None, chunk_text=f"text {i}")
            for i in range(4)
        ],
    ])

    results = asyncio.run(service.search_all("query", top_k=2))

    assert len(results) == 2


def test_search_all_connection_entity_keyed_by_both_friend_ids():
    service, _ = make_service([
        [_row(chunk_id="c1")],
        [],
        [
            _row(chunk_id="c1", source_type="CONNECTION", friend_id=None, group_id=None,
                 connection_friend1_id=3, connection_friend2_id=7, chunk_text="they get along well"),
        ],
    ])

    results = asyncio.run(service.search_all("query", top_k=5))

    assert len(results) == 1
    assert results[0]["source_type"] == "CONNECTION"
    assert results[0]["connection_friend1_id"] == 3
    assert results[0]["connection_friend2_id"] == 7


def test_search_all_no_candidates_returns_empty():
    service, _ = make_service([
        [],  # no vector candidates
        [],  # no bm25 candidates
    ])

    results = asyncio.run(service.search_all("nothing matches", top_k=5))

    assert results == []
