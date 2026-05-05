"""Integration tests: KnowledgeService cache hit/miss paths.

All eight dependencies are mocked — no real LLM, Redis, MongoDB, or HTTP calls.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from services.knowledge_service import KnowledgeService


def _make_knowledge_service(
    agent_service=None,
    fact_service=None,
    chunking_service=None,
    friend_api_service=None,
    cache_service=None,
    prompt_service=None,
    fact_repository=None,
    mongo_repo=None,
):
    return KnowledgeService(
        agent_service=agent_service or AsyncMock(),
        fact_service=fact_service or AsyncMock(),
        chunking_service=chunking_service or AsyncMock(),
        friend_api_service=friend_api_service or AsyncMock(),
        cache_service=cache_service or AsyncMock(),
        prompt_service=prompt_service or AsyncMock(),
        fact_repository=fact_repository or AsyncMock(),
        mongo_repo=mongo_repo or AsyncMock(),
    )


# ---------------------------------------------------------------------------
# Cache HIT path
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_summarize_cache_hit_skips_llm(
    mock_cache_service,
    mock_agent_service,
    mock_fact_service,
    mock_fact_repo,
    mock_mongo_repo,
):
    """When Redis says 'cached', no LLM call should happen."""
    mock_cache_service.is_summary_cached = AsyncMock(return_value=True)
    mock_fact_repo.get_friend_summary = AsyncMock(
        return_value={"facts": [], "last_updated": None}
    )

    svc = _make_knowledge_service(
        agent_service=mock_agent_service,
        cache_service=mock_cache_service,
        fact_service=mock_fact_service,
        fact_repository=mock_fact_repo,
        mongo_repo=mock_mongo_repo,
    )

    result = await svc.summarize_friend_knowledge(friend_id=1)

    mock_agent_service.generate_response.assert_not_called()
    mock_agent_service.llm.assert_not_called()
    assert "friend_id" in result
    assert result["friend_id"] == 1


# ---------------------------------------------------------------------------
# Cache MISS – full pipeline
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_summarize_cache_miss_runs_full_pipeline(
    mock_cache_service,
    mock_agent_service,
    mock_fact_service,
    mock_friend_api_service,
    mock_chunking_service,
    mock_prompt_service,
    mock_fact_repo,
    mock_mongo_repo,
):
    """Cache miss triggers: Friend API → chunk → LLM summary → validate facts → cache."""
    mock_cache_service.is_summary_cached = AsyncMock(return_value=False)
    mock_friend_api_service.fetch_knowledge_paginated = AsyncMock(
        return_value=[{"id": 1, "fact": "Alice hikes", "importance": 5}]
    )
    mock_friend_api_service.fetch_knowledge_text = AsyncMock(
        return_value="Alice loves hiking and photography."
    )
    mock_mongo_repo.find_many = AsyncMock(return_value=[])  # no pre-existing chunks
    mock_chunking_service.process_knowledge = AsyncMock(return_value=["c1"])
    mock_chunking_service.ensure_embeddings_exist = AsyncMock(return_value=1)
    mock_prompt_service.generate_summary = AsyncMock(
        return_value={"Hobbies": "Hiking", "Job": "Engineer"}
    )
    mock_prompt_service.parse_summary_to_facts = MagicMock(
        return_value=[("Hobbies", "Hiking"), ("Job", "Engineer")]
    )
    mock_fact_service.create_fact_with_references = AsyncMock(
        side_effect=["fact-001", "fact-002"]
    )
    mock_fact_repo.get_friend_summary = AsyncMock(
        return_value={
            "facts": [
                {"fact_id": "fact-001", "key": "Hobbies", "value": "Hiking",
                 "stability_score": 0.9, "validated": True,
                 "created_at": None, "updated_at": None},
            ],
            "last_updated": None,
        }
    )
    mock_fact_service.get_fact_references = AsyncMock(return_value=[])

    svc = _make_knowledge_service(
        agent_service=mock_agent_service,
        fact_service=mock_fact_service,
        chunking_service=mock_chunking_service,
        friend_api_service=mock_friend_api_service,
        cache_service=mock_cache_service,
        prompt_service=mock_prompt_service,
        fact_repository=mock_fact_repo,
        mongo_repo=mock_mongo_repo,
    )

    result = await svc.summarize_friend_knowledge(friend_id=5)

    # Friend API was called
    mock_friend_api_service.fetch_knowledge_paginated.assert_called_once()
    # Facts were validated
    assert mock_fact_service.create_fact_with_references.call_count == 2
    # Result was cached
    mock_cache_service.cache_summary.assert_called_once_with(5)
    assert result["friend_id"] == 5


# ---------------------------------------------------------------------------
# Empty knowledge → no LLM call
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_summarize_empty_knowledge_returns_empty_facts(
    mock_cache_service,
    mock_friend_api_service,
    mock_fact_repo,
    mock_mongo_repo,
):
    mock_cache_service.is_summary_cached = AsyncMock(return_value=False)
    mock_friend_api_service.fetch_knowledge_paginated = AsyncMock(return_value=[])
    mock_fact_repo.create_empty_summary = AsyncMock(return_value=None)

    svc = _make_knowledge_service(
        cache_service=mock_cache_service,
        friend_api_service=mock_friend_api_service,
        fact_repository=mock_fact_repo,
        mongo_repo=mock_mongo_repo,
    )

    result = await svc.summarize_friend_knowledge(friend_id=7)

    assert result["facts"] == []
    assert result["fact_count"] == 0
    mock_fact_repo.create_empty_summary.assert_called_once_with(7)
    mock_cache_service.cache_summary.assert_called_once_with(7)


# ---------------------------------------------------------------------------
# Zero valid facts after LLM parse
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_summarize_no_valid_facts_caches_and_returns_empty(
    mock_cache_service,
    mock_friend_api_service,
    mock_prompt_service,
    mock_fact_repo,
    mock_mongo_repo,
    mock_chunking_service,
    mock_agent_service,
):
    mock_cache_service.is_summary_cached = AsyncMock(return_value=False)
    mock_friend_api_service.fetch_knowledge_paginated = AsyncMock(
        return_value=[{"id": 1, "fact": "x", "importance": 1}]
    )
    mock_friend_api_service.fetch_knowledge_text = AsyncMock(return_value="some text")
    mock_mongo_repo.find_many = AsyncMock(return_value=[])
    mock_chunking_service.process_knowledge = AsyncMock(return_value=["c1"])
    mock_chunking_service.ensure_embeddings_exist = AsyncMock(return_value=0)
    mock_prompt_service.generate_summary = AsyncMock(return_value={})
    mock_prompt_service.parse_summary_to_facts = MagicMock(return_value=[])

    svc = _make_knowledge_service(
        agent_service=mock_agent_service,
        cache_service=mock_cache_service,
        friend_api_service=mock_friend_api_service,
        prompt_service=mock_prompt_service,
        chunking_service=mock_chunking_service,
        fact_repository=mock_fact_repo,
        mongo_repo=mock_mongo_repo,
    )

    result = await svc.summarize_friend_knowledge(friend_id=3)

    assert result["facts"] == []
    mock_cache_service.cache_summary.assert_called_once_with(3)


# ---------------------------------------------------------------------------
# Partial fact validation (3 of 5 pass)
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_summarize_partial_fact_validation(
    mock_cache_service,
    mock_friend_api_service,
    mock_fact_service,
    mock_prompt_service,
    mock_chunking_service,
    mock_agent_service,
    mock_fact_repo,
    mock_mongo_repo,
):
    mock_cache_service.is_summary_cached = AsyncMock(return_value=False)
    mock_friend_api_service.fetch_knowledge_paginated = AsyncMock(
        return_value=[{"id": 1, "fact": "x", "importance": 1}]
    )
    mock_friend_api_service.fetch_knowledge_text = AsyncMock(return_value="text")
    mock_mongo_repo.find_many = AsyncMock(return_value=[])
    mock_chunking_service.process_knowledge = AsyncMock(return_value=["c1"])
    mock_chunking_service.ensure_embeddings_exist = AsyncMock(return_value=0)

    # 5 raw facts, only 3 produce a fact_id (2 discarded)
    facts_5 = [(f"Key{i}", f"Val{i}") for i in range(5)]
    mock_prompt_service.generate_summary = AsyncMock(return_value={})
    mock_prompt_service.parse_summary_to_facts = MagicMock(return_value=facts_5)
    mock_fact_service.create_fact_with_references = AsyncMock(
        side_effect=["id1", "id2", None, "id3", None]
    )

    # Return 3 facts in the summary
    stored_facts = [
        {"fact_id": "id1", "key": "Key0", "value": "Val0",
         "stability_score": 0.9, "validated": True,
         "created_at": None, "updated_at": None},
        {"fact_id": "id2", "key": "Key1", "value": "Val1",
         "stability_score": 0.9, "validated": True,
         "created_at": None, "updated_at": None},
        {"fact_id": "id3", "key": "Key3", "value": "Val3",
         "stability_score": 0.9, "validated": True,
         "created_at": None, "updated_at": None},
    ]
    mock_fact_repo.get_friend_summary = AsyncMock(
        return_value={"facts": stored_facts, "last_updated": None}
    )
    mock_fact_service.get_fact_references = AsyncMock(return_value=[])

    svc = _make_knowledge_service(
        agent_service=mock_agent_service,
        fact_service=mock_fact_service,
        chunking_service=mock_chunking_service,
        friend_api_service=mock_friend_api_service,
        cache_service=mock_cache_service,
        prompt_service=mock_prompt_service,
        fact_repository=mock_fact_repo,
        mongo_repo=mock_mongo_repo,
    )

    result = await svc.summarize_friend_knowledge(friend_id=9)

    assert result["fact_count"] == 3
    assert mock_fact_service.create_fact_with_references.call_count == 5
