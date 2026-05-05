"""Unit tests for AgentService."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.agent_service import AgentService


def _make_service():
    return AgentService()


# ---------------------------------------------------------------------------
# initialize
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_initialize_sets_initialized_flag():
    svc = _make_service()
    with (
        patch("services.agent_service.MCPService") as MockMCP,
        patch("services.agent_service.ChatVertexAI") as MockLLM,
        patch("services.agent_service.create_react_agent") as mock_create,
        patch("services.agent_service.settings"),
    ):
        mock_mcp = AsyncMock()
        MockMCP.return_value = mock_mcp
        MockLLM.return_value = MagicMock()
        mock_create.return_value = MagicMock()
        mock_mcp.get_tools.return_value = []

        await svc.initialize()

    assert svc._initialized is True
    mock_mcp.initialize.assert_called_once()


@pytest.mark.unit
async def test_initialize_idempotent():
    svc = _make_service()
    svc._initialized = True
    with patch("services.agent_service.MCPService") as MockMCP:
        await svc.initialize()
        MockMCP.assert_not_called()


@pytest.mark.unit
async def test_initialize_mcp_failure_keeps_uninitialized():
    svc = _make_service()
    with (
        patch("services.agent_service.MCPService") as MockMCP,
        patch("services.agent_service.settings"),
    ):
        mock_mcp = AsyncMock()
        MockMCP.return_value = mock_mcp
        mock_mcp.initialize.side_effect = RuntimeError("MCP unavailable")

        with pytest.raises(RuntimeError):
            await svc.initialize()

    assert svc._initialized is False


# ---------------------------------------------------------------------------
# process_message
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_process_message_not_initialized_raises():
    svc = _make_service()
    with pytest.raises(RuntimeError, match="not initialized"):
        await svc.process_message("Hello")


@pytest.mark.unit
async def test_process_message_returns_agent_result():
    svc = _make_service()
    svc._initialized = True
    expected = {"messages": [MagicMock(content="Hi there!")]}
    svc.agent = AsyncMock()
    svc.agent.ainvoke = AsyncMock(return_value=expected)

    result = await svc.process_message("Hello")

    svc.agent.ainvoke.assert_called_once()
    assert result == expected


# ---------------------------------------------------------------------------
# generate_response
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_generate_response_not_initialized_raises():
    svc = _make_service()
    with pytest.raises(RuntimeError, match="not initialized"):
        await svc.generate_response("system", "user")


@pytest.mark.unit
async def test_generate_response_returns_content_string():
    svc = _make_service()
    svc._initialized = True
    mock_response = MagicMock()
    mock_response.content = "The answer is 42."
    svc.llm = AsyncMock()
    svc.llm.ainvoke = AsyncMock(return_value=mock_response)

    result = await svc.generate_response("You are helpful.", "What is the answer?")

    assert result == "The answer is 42."


# ---------------------------------------------------------------------------
# list_available_tools / get_tool_by_name
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_list_available_tools_delegates_to_mcp():
    svc = _make_service()
    svc.mcp_service = MagicMock()
    svc.mcp_service.list_available_tools.return_value = ["tool_x", "tool_y"]
    assert svc.list_available_tools() == ["tool_x", "tool_y"]


@pytest.mark.unit
def test_get_tool_by_name_delegates_to_mcp():
    svc = _make_service()
    fake_tool = MagicMock(name="my_tool")
    svc.mcp_service = MagicMock()
    svc.mcp_service.get_tool_by_name.return_value = fake_tool
    assert svc.get_tool_by_name("my_tool") == fake_tool


# ---------------------------------------------------------------------------
# is_initialized property
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_is_initialized_false_by_default():
    svc = _make_service()
    assert svc.is_initialized is False


@pytest.mark.unit
def test_is_initialized_true_after_set():
    svc = _make_service()
    svc._initialized = True
    assert svc.is_initialized is True
