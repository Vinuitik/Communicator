"""Unit tests for MCPService."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.mcp_service import MCPService


def _make_service(*, retry_attempts=3, retry_delay=0):
    with patch("services.mcp_service.settings") as s:
        s.mcp_retry_attempts = retry_attempts
        s.mcp_server_url = "http://mcp-server:8000/knowledgeMCP/"
        s.mcp_connection_retry_delay = retry_delay
        return MCPService()


# ---------------------------------------------------------------------------
# initialize
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_initialize_success_first_attempt():
    svc = _make_service()
    fake_tool = MagicMock()
    fake_tool.name = "search_knowledge"

    with (
        patch("services.mcp_service.MultiServerMCPClient") as MockClient,
        patch("services.mcp_service.asyncio.sleep", new_callable=AsyncMock),
    ):
        mock_client = AsyncMock()
        MockClient.return_value = mock_client
        mock_client.get_tools = AsyncMock(return_value=[fake_tool])

        await svc.initialize()

    assert svc._initialized is True
    assert len(svc.tools) == 1


@pytest.mark.unit
async def test_initialize_idempotent():
    svc = _make_service()
    svc._initialized = True
    with patch("services.mcp_service.MultiServerMCPClient") as MockClient:
        await svc.initialize()
        MockClient.assert_not_called()


@pytest.mark.unit
async def test_initialize_retries_on_failure_then_succeeds():
    svc = _make_service(retry_attempts=2, retry_delay=0)
    fake_tool = MagicMock()
    fake_tool.name = "tool_x"

    call_count = 0

    async def mock_get_tools():
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise ConnectionError("not yet")
        return [fake_tool]

    with (
        patch("services.mcp_service.MultiServerMCPClient") as MockClient,
        patch("services.mcp_service.asyncio.sleep", new_callable=AsyncMock),
    ):
        mock_client = AsyncMock()
        MockClient.return_value = mock_client
        mock_client.get_tools = mock_get_tools

        await svc.initialize()

    assert svc._initialized is True


@pytest.mark.unit
async def test_initialize_max_retries_exceeded_raises():
    svc = _make_service(retry_attempts=2, retry_delay=0)

    with (
        patch("services.mcp_service.MultiServerMCPClient") as MockClient,
        patch("services.mcp_service.asyncio.sleep", new_callable=AsyncMock),
    ):
        mock_client = AsyncMock()
        MockClient.return_value = mock_client
        mock_client.get_tools = AsyncMock(side_effect=ConnectionError("always fails"))

        with pytest.raises(Exception):
            await svc.initialize()

    assert svc._initialized is False


# ---------------------------------------------------------------------------
# get_tool_by_name
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_get_tool_by_name_found():
    svc = _make_service()
    tool = MagicMock()
    tool.name = "search_knowledge"
    svc.tools = [tool]
    result = svc.get_tool_by_name("search_knowledge")
    assert result is tool


@pytest.mark.unit
def test_get_tool_by_name_not_found():
    svc = _make_service()
    tool = MagicMock()
    tool.name = "other_tool"
    svc.tools = [tool]
    assert svc.get_tool_by_name("nonexistent") is None


@pytest.mark.unit
def test_get_tool_by_name_when_uninitialized():
    svc = _make_service()
    svc.tools = None
    assert svc.get_tool_by_name("any") is None


# ---------------------------------------------------------------------------
# list_available_tools / get_tools
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_list_available_tools_returns_names():
    svc = _make_service()
    t1, t2 = MagicMock(), MagicMock()
    t1.name = "tool_a"
    t2.name = "tool_b"
    svc.tools = [t1, t2]
    assert svc.list_available_tools() == ["tool_a", "tool_b"]


@pytest.mark.unit
def test_list_available_tools_empty_when_no_tools():
    svc = _make_service()
    svc.tools = None
    assert svc.list_available_tools() == []


@pytest.mark.unit
def test_get_tools_returns_all():
    svc = _make_service()
    tools = [MagicMock(), MagicMock()]
    svc.tools = tools
    assert svc.get_tools() == tools


# ---------------------------------------------------------------------------
# refresh_tools
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_refresh_tools_updates_list():
    svc = _make_service()
    new_tool = MagicMock()
    mock_client = AsyncMock()
    mock_client.get_tools = AsyncMock(return_value=[new_tool])
    svc.mcp_client = mock_client
    svc.tools = []

    await svc.refresh_tools()
    assert svc.tools == [new_tool]


@pytest.mark.unit
async def test_refresh_tools_no_client_raises():
    svc = _make_service()
    svc.mcp_client = None
    with pytest.raises(RuntimeError, match="not initialized"):
        await svc.refresh_tools()
