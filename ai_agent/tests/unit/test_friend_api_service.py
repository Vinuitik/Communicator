"""Unit tests for FriendApiService.

All HTTP calls are intercepted by aioresponses.
"""
import pytest
from aioresponses import aioresponses
from unittest.mock import patch

from services.friend_api_service import FriendApiService


BASE = "http://friend:8085"


def _make_service():
    with patch("services.friend_api_service.settings") as s:
        s.friend_service_url = BASE
        s.friend_service_timeout = 5
        return FriendApiService()


# ---------------------------------------------------------------------------
# fetch_knowledge_paginated
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_fetch_knowledge_paginated_success():
    svc = _make_service()
    payload = [{"id": 1, "fact": "Alice hikes", "importance": 5}]
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledge/1/page/0/size/30", payload=payload)
        result = await svc.fetch_knowledge_paginated(friend_id=1, page=0, size=30)
    assert result == payload


@pytest.mark.unit
async def test_fetch_knowledge_paginated_404_returns_empty():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledge/99/page/0/size/30", status=404)
        result = await svc.fetch_knowledge_paginated(friend_id=99, page=0, size=30)
    assert result == []


@pytest.mark.unit
async def test_fetch_knowledge_paginated_server_error_returns_empty():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledge/1/page/0/size/30", status=500, body="Internal error")
        result = await svc.fetch_knowledge_paginated(friend_id=1, page=0, size=30)
    assert result == []


@pytest.mark.unit
async def test_fetch_knowledge_paginated_network_error_returns_empty():
    import aiohttp
    svc = _make_service()
    with aioresponses() as m:
        m.get(
            f"{BASE}/getKnowledge/1/page/0/size/30",
            exception=aiohttp.ClientConnectionError("refused"),
        )
        result = await svc.fetch_knowledge_paginated(friend_id=1, page=0, size=30)
    assert result == []


# ---------------------------------------------------------------------------
# fetch_knowledge_text
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_fetch_knowledge_text_success():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeText/42", payload={"id": "42", "text": "Alice loves cats."})
        result = await svc.fetch_knowledge_text(42)
    assert result == "Alice loves cats."


@pytest.mark.unit
async def test_fetch_knowledge_text_not_found_returns_none():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeText/404", status=404)
        result = await svc.fetch_knowledge_text(404)
    assert result is None


@pytest.mark.unit
async def test_fetch_knowledge_text_missing_text_field_returns_none():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeText/1", payload={"id": "1"})  # no "text" key
        result = await svc.fetch_knowledge_text(1)
    assert result is None


# ---------------------------------------------------------------------------
# fetch_knowledge_texts_batch
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_fetch_knowledge_texts_batch_returns_dict():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeText/1", payload={"id": "1", "text": "Text one."})
        m.get(f"{BASE}/getKnowledgeText/2", payload={"id": "2", "text": "Text two."})
        m.get(f"{BASE}/getKnowledgeText/3", payload={"id": "3", "text": "Text three."})
        result = await svc.fetch_knowledge_texts_batch([1, 2, 3])
    assert len(result) == 3
    assert result[1] == "Text one."
    assert result[2] == "Text two."
    assert result[3] == "Text three."


@pytest.mark.unit
async def test_fetch_knowledge_texts_batch_partial_failure():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeText/1", payload={"id": "1", "text": "Good text."})
        m.get(f"{BASE}/getKnowledgeText/2", status=404)
        result = await svc.fetch_knowledge_texts_batch([1, 2])
    assert 1 in result
    assert 2 not in result


# ---------------------------------------------------------------------------
# fetch_knowledge_ids_for_friend
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_fetch_knowledge_ids_for_friend_success():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeIds/7", payload=[101, 102, 103])
        result = await svc.fetch_knowledge_ids_for_friend(friend_id=7)
    assert result == [101, 102, 103]


@pytest.mark.unit
async def test_fetch_knowledge_ids_for_friend_404_returns_empty():
    svc = _make_service()
    with aioresponses() as m:
        m.get(f"{BASE}/getKnowledgeIds/99", status=404)
        result = await svc.fetch_knowledge_ids_for_friend(friend_id=99)
    assert result == []
