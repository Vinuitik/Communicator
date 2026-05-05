"""Integration tests: FactService pipeline.

SearchService, FactValidationService, FriendApiService, FactRepository,
and MongoRepository are all replaced with mocks so no infra is needed.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.fact_service import FactService


def _make_fact_service(
    search_service=None,
    validation_service=None,
    friend_api_service=None,
    fact_repo=None,
    mongo_repo=None,
    *,
    max_refs=3,
    discard_no_refs=True,
):
    search_service = search_service or AsyncMock()
    validation_service = validation_service or AsyncMock()
    friend_api_service = friend_api_service or AsyncMock()
    fact_repo = fact_repo or AsyncMock()
    mongo_repo = mongo_repo or AsyncMock()

    with patch("services.fact_service.settings") as s:
        s.max_references_per_fact = max_refs
        s.discard_if_no_references = discard_no_refs

        return FactService(
            search_service=search_service,
            validation_service=validation_service,
            friend_api_service=friend_api_service,
            fact_repository=fact_repo,
            mongo_repo=mongo_repo,
        )


# ---------------------------------------------------------------------------
# create_fact_with_references – happy path
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_create_fact_full_happy_path(
    mock_search_service,
    mock_validation_service,
    mock_friend_api_service,
    mock_fact_repo,
    mock_mongo_repo,
):
    """Complete pipeline: search → fetch texts → validate → store fact + refs."""
    mock_search_service.search = AsyncMock(
        return_value=[("chunk_1_0_abc", 0.92), ("chunk_2_0_def", 0.85)]
    )
    mock_mongo_repo.find_many = AsyncMock(
        return_value=[
            {"chunk_id": "chunk_1_0_abc", "knowledge_id": 1},
            {"chunk_id": "chunk_2_0_def", "knowledge_id": 2},
        ]
    )
    mock_friend_api_service.fetch_knowledge_texts_batch = AsyncMock(
        return_value={1: "Alice loves hiking.", 2: "Alice photographs landscapes."}
    )
    mock_validation_service.validate_fact = AsyncMock(
        return_value=(True, 0.9, "Supported by text.")
    )
    mock_validation_service.meets_threshold = MagicMock(return_value=True)
    mock_validation_service.get_min_confidence = MagicMock(return_value=0.8)

    svc = _make_fact_service(
        mock_search_service, mock_validation_service,
        mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
    )
    fact_id = await svc.create_fact_with_references(
        friend_id=1, fact_key="Hobbies", fact_value="Hiking"
    )

    assert fact_id is not None
    mock_fact_repo.save_fact.assert_called_once()
    mock_mongo_repo.insert_many.assert_called_once()


# ---------------------------------------------------------------------------
# create_fact_with_references – discard cases
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_create_fact_no_search_results_discards(
    mock_search_service, mock_validation_service,
    mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
):
    mock_search_service.search = AsyncMock(return_value=[])
    svc = _make_fact_service(
        mock_search_service, mock_validation_service,
        mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
        discard_no_refs=True,
    )
    result = await svc.create_fact_with_references(1, "Key", "Value")
    assert result is None
    mock_fact_repo.save_fact.assert_not_called()


@pytest.mark.integration
async def test_create_fact_validation_fails_returns_none(
    mock_search_service, mock_validation_service,
    mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
):
    mock_search_service.search = AsyncMock(return_value=[("c1", 0.9)])
    mock_mongo_repo.find_many = AsyncMock(return_value=[{"chunk_id": "c1", "knowledge_id": 1}])
    mock_friend_api_service.fetch_knowledge_texts_batch = AsyncMock(
        return_value={1: "Some text."}
    )
    mock_validation_service.validate_fact = AsyncMock(
        return_value=(False, 0.1, "Not supported.")
    )
    mock_validation_service.meets_threshold = MagicMock(return_value=False)
    mock_validation_service.get_min_confidence = MagicMock(return_value=0.8)

    svc = _make_fact_service(
        mock_search_service, mock_validation_service,
        mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
    )
    result = await svc.create_fact_with_references(1, "Key", "Value")
    assert result is None


@pytest.mark.integration
async def test_create_fact_below_confidence_threshold_returns_none(
    mock_search_service, mock_validation_service,
    mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
):
    mock_search_service.search = AsyncMock(return_value=[("c1", 0.9)])
    mock_mongo_repo.find_many = AsyncMock(return_value=[{"chunk_id": "c1", "knowledge_id": 1}])
    mock_friend_api_service.fetch_knowledge_texts_batch = AsyncMock(
        return_value={1: "Some text."}
    )
    # is_valid=True but confidence too low
    mock_validation_service.validate_fact = AsyncMock(
        return_value=(True, 0.3, "Marginal support.")
    )
    mock_validation_service.meets_threshold = MagicMock(return_value=False)
    mock_validation_service.get_min_confidence = MagicMock(return_value=0.8)

    svc = _make_fact_service(
        mock_search_service, mock_validation_service,
        mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
    )
    result = await svc.create_fact_with_references(1, "Key", "Value")
    assert result is None


@pytest.mark.integration
async def test_create_fact_knowledge_fetch_fails_auto_validates(
    mock_search_service, mock_validation_service,
    mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
):
    """When knowledge texts can't be fetched, fact is auto-validated with 0.5 confidence."""
    mock_search_service.search = AsyncMock(return_value=[("c1", 0.9)])
    mock_mongo_repo.find_many = AsyncMock(return_value=[{"chunk_id": "c1", "knowledge_id": 1}])
    mock_friend_api_service.fetch_knowledge_texts_batch = AsyncMock(return_value={})
    mock_validation_service.meets_threshold = MagicMock(return_value=True)
    mock_validation_service.get_min_confidence = MagicMock(return_value=0.0)

    svc = _make_fact_service(
        mock_search_service, mock_validation_service,
        mock_friend_api_service, mock_fact_repo, mock_mongo_repo,
    )
    fact_id = await svc.create_fact_with_references(1, "Key", "Value")
    # Should be saved with auto-confidence=0.5
    assert fact_id is not None
    mock_validation_service.validate_fact.assert_not_called()


# ---------------------------------------------------------------------------
# get_fact_references – ordering
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_get_fact_references_sorted_by_rank(mock_mongo_repo):
    mock_mongo_repo.find_many = AsyncMock(
        return_value=[
            {"fact_id": "f1", "chunk_id": "c3", "rank": 3},
            {"fact_id": "f1", "chunk_id": "c1", "rank": 1},
            {"fact_id": "f1", "chunk_id": "c2", "rank": 2},
        ]
    )
    svc = _make_fact_service(mongo_repo=mock_mongo_repo)
    refs = await svc.get_fact_references("f1")
    assert [r["rank"] for r in refs] == [1, 2, 3]


# ---------------------------------------------------------------------------
# delete_fact
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_delete_fact_removes_fact_and_references(
    mock_fact_repo, mock_mongo_repo
):
    svc = _make_fact_service(fact_repo=mock_fact_repo, mongo_repo=mock_mongo_repo)
    result = await svc.delete_fact(friend_id=1, fact_id="fact-abc")
    assert result is True
    mock_fact_repo.delete_fact.assert_called_once_with(1, "fact-abc")
    mock_mongo_repo.delete_many.assert_called_once()
