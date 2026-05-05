"""Integration tests: HTTP and WebSocket endpoints via FastAPI TestClient.

Services are replaced with mocks using app.dependency_overrides so no real
infra (Redis, Mongo, LLM) is required.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from main import app
from dependencies.deps import get_agent_service, get_knowledge_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_agent(process_result=None, tools=None, raise_on_process=None):
    svc = AsyncMock()
    if raise_on_process:
        svc.process_message = AsyncMock(side_effect=raise_on_process)
    else:
        content = process_result or "Hello from agent."
        svc.process_message = AsyncMock(
            return_value={"messages": [MagicMock(content=content)]}
        )
    svc.list_available_tools = MagicMock(return_value=tools or ["tool_a", "tool_b"])
    return svc


def _mock_knowledge(summary_result=None, raise_on_summarize=None):
    svc = AsyncMock()
    if raise_on_summarize:
        svc.summarize_friend_knowledge = AsyncMock(side_effect=raise_on_summarize)
    else:
        svc.summarize_friend_knowledge = AsyncMock(
            return_value=summary_result or {
                "friend_id": 1,
                "facts": [],
                "fact_count": 0,
                "last_updated": None,
            }
        )
    svc.list_available_tools = MagicMock(return_value=["knowledge_tool"])
    return svc


# ---------------------------------------------------------------------------
# Health / root
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_health_endpoint_returns_200():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.integration
def test_root_endpoint_returns_200():
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert "status" in response.json()


# ---------------------------------------------------------------------------
# POST /chat/
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_chat_post_success():
    agent = _mock_agent(process_result="I can help!")

    async def override():
        return agent

    app.dependency_overrides[get_agent_service] = override
    try:
        with TestClient(app) as client:
            resp = client.post("/chat/", json={"message": "Hello"})
        assert resp.status_code == 200
        assert "response" in resp.json()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.integration
def test_chat_post_agent_error_returns_500():
    agent = _mock_agent(raise_on_process=RuntimeError("agent down"))

    async def override():
        return agent

    app.dependency_overrides[get_agent_service] = override
    try:
        with TestClient(app) as client:
            resp = client.post("/chat/", json={"message": "Hello"})
        assert resp.status_code == 500
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /chat/tools
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_chat_tools_endpoint_returns_tool_list():
    agent = _mock_agent(tools=["search_knowledge", "get_facts"])

    async def override():
        return agent

    app.dependency_overrides[get_agent_service] = override
    try:
        with TestClient(app) as client:
            resp = client.get("/chat/tools")
        assert resp.status_code == 200
        assert resp.json()["tools"] == ["search_knowledge", "get_facts"]
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# WebSocket /chat/ws
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_websocket_receives_ai_response():
    agent = _mock_agent(process_result="Great question!")

    async def override():
        return agent

    app.dependency_overrides[get_agent_service] = override
    try:
        with TestClient(app) as client:
            with client.websocket_connect("/chat/ws") as ws:
                ws.send_text("What is the meaning of life?")
                data = ws.receive_json()
        assert data["type"] == "ai_response"
        assert "Great question!" in data["content"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.integration
def test_websocket_error_returns_error_message():
    agent = _mock_agent(raise_on_process=ValueError("something broke"))

    async def override():
        return agent

    app.dependency_overrides[get_agent_service] = override
    try:
        with TestClient(app) as client:
            with client.websocket_connect("/chat/ws") as ws:
                ws.send_text("trigger error")
                data = ws.receive_json()
        assert data["type"] == "error"
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /knowledge/summarize
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_knowledge_summarize_success():
    ks = _mock_knowledge(summary_result={
        "friend_id": 42,
        "facts": [{"fact_id": "f1", "key": "Hobbies", "value": "Hiking"}],
        "fact_count": 1,
        "last_updated": None,
    })

    async def override():
        return ks

    app.dependency_overrides[get_knowledge_service] = override
    try:
        with TestClient(app) as client:
            resp = client.post("/knowledge/summarize", json={"friend_id": 42})
        assert resp.status_code == 200
        body = resp.json()
        assert body["friend_id"] == 42
        assert body["fact_count"] == 1
    finally:
        app.dependency_overrides.clear()


@pytest.mark.integration
def test_knowledge_summarize_value_error_returns_404():
    ks = _mock_knowledge(raise_on_summarize=ValueError("friend not found"))

    async def override():
        return ks

    app.dependency_overrides[get_knowledge_service] = override
    try:
        with TestClient(app) as client:
            resp = client.post("/knowledge/summarize", json={"friend_id": 999})
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


@pytest.mark.integration
def test_knowledge_summarize_runtime_error_returns_500():
    ks = _mock_knowledge(raise_on_summarize=RuntimeError("DB connection lost"))

    async def override():
        return ks

    app.dependency_overrides[get_knowledge_service] = override
    try:
        with TestClient(app) as client:
            resp = client.post("/knowledge/summarize", json={"friend_id": 1})
        assert resp.status_code == 500
    finally:
        app.dependency_overrides.clear()
