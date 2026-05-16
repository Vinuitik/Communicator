# knowledgeMCP FLOWS

Files: knowledgeMCP.py, ../ai_agent/services/mcp_service.py, ../ai_agent/config/config.yaml

---

## Service Wiring

`knowledgeMCP.py` → `FastMCP("KnowledgeMCP")` → listens on `0.0.0.0:8000`, path `/knowledgeMCP/`, transport `streamable-http`

nginx upstream: `mcp-knowledge-server:8000`; public path: `/api/mcp/knowledge/` (proxied to `http://mcp_knowledge_service/`)

ai_agent connection: `MCPService._setup_mcp_client()` → `MultiServerMCPClient({"my_mcp": {"transport": "streamable_http", "url": settings.mcp_server_url}})` → `mcp_server_url` read from `config.yaml` → `http://mcp-knowledge-server:8000/knowledgeMCP/`

All tool HTTP calls inside `knowledgeMCP.py` go to `http://nginx/api/friend/...` (i.e., back through nginx → `communicator-core:8085`).

To change MCP listen port: `mcp.run(port=...)` in `knowledgeMCP.py`
To change MCP path: `mcp.run(path=...)` in `knowledgeMCP.py`
To change ai_agent → MCP URL: `config.yaml` → `mcp.server_url`

---

## AI Agent Initialization Flow

`MCPService.initialize()` → `_setup_mcp_client()` (retries up to `settings.mcp_retry_attempts` times, delay `settings.mcp_connection_retry_delay` seconds) → `MultiServerMCPClient.get_tools()` → stores tool list in `self.tools`

`MCPService.get_tools()` → returns all LangChain tool objects (passed directly to LLM/agent)
`MCPService.get_tool_by_name(name)` → linear scan of `self.tools` list
`MCPService.refresh_tools()` → re-fetches from server without reconnecting
`MCPService.cleanup()` → nulls client and tools, resets `_initialized`

To change retry count: `config.yaml` → `mcp.retry_attempts`
To change retry delay: `settings.mcp_connection_retry_delay` (or `config.yaml` equivalent)

---

## Exposed MCP Tools

### `get_friend_knowledge(friend_id, page=0, size=50)`

`GET http://nginx/api/friend/getKnowledge/<friend_id>/page/<page>/size/<size>` → returns paginated JSON: `{content[], totalElements, totalPages, hasNext, hasPrevious, ...}`

Knowledge items sorted by importance/priority descending (done server-side by `communicator-core`).

To change page size default: `get_friend_knowledge()` signature default `size=50`

---

### `create_friend_knowledge(friend_id, fact, importance)`

Builds `[{"fact": fact, "importance": int(importance)}]` → `POST http://nginx/api/friend/addKnowledge/<friend_id>` (JSON body) → returns created entry IDs

Note: field names `fact` and `importance` map to server-side `text` and `priority` via `@JsonProperty` on the `communicator-core` DTO.

To change field mapping: `create_friend_knowledge()` dict construction in `knowledgeMCP.py`

---

### `update_friend_knowledge(knowledge_id, fact=None, importance=None)`

`GET http://nginx/api/friend/getKnowledgeById/<knowledge_id>` → fetch existing → merge with provided args → `PUT http://nginx/api/friend/updateKnowledge` (JSON body `{id, fact, importance}`) → returns `"Knowledge updated successfully"`

To change partial-update merge logic: `update_friend_knowledge()` in `knowledgeMCP.py`

---

### `get_friend_analytics(friend_id, days_back=30)`

Computes `start_date = today - days_back`, `end_date = today` → `GET http://nginx/api/friend/analyticsList?friendId=<id>&left=<iso>&right=<iso>` → returns list of `{date, experience, hours}` entries

To change default lookback window: `get_friend_analytics()` signature default `days_back=30`

---

### `calculate_friend_moving_averages(friend_id, days_back=30)`

Two calls in parallel path:
1. `GET http://nginx/api/friend/shortList` → all friends → linear scan for `friend['id'] == friend_id`
2. (if `days_back > 0`) `GET http://nginx/api/friend/analyticsList?...` → computes in-function summary stats

Returns assembled dict: `{friend_id, friend_name, pre_calculated_averages: {frequency_ema, intensity_ema, duration_ema}, raw_analytics_summary: {period_days, total_meetings, total_hours, average_duration_per_meeting, experience_breakdown}}`

Pre-calculated EMAs sourced from `friend['averageFrequency']`, `friend['averageExcitement']`, `friend['averageDuration']` — these are updated daily by `communicator-core` chrono service, not computed here.

To change EMA field names: `calculate_friend_moving_averages()` dict access keys
To change summary stat calculations: `calculate_friend_moving_averages()` in-function arithmetic

---

### `get_friends_list(page=0, size=20)`

`GET http://nginx/api/friend/friends/page/<page>/size/<size>` → returns paginated list `{id, name, dateOfBirth}`

Used by AI agent to resolve friend names to IDs before calling other tools.

---

## Tool Call Routing Summary

| MCP Tool | Method | Upstream endpoint |
|---|---|---|
| `get_friend_knowledge` | GET | `/api/friend/getKnowledge/<id>/page/<p>/size/<s>` |
| `create_friend_knowledge` | POST | `/api/friend/addKnowledge/<id>` |
| `update_friend_knowledge` | GET + PUT | `/api/friend/getKnowledgeById/<id>`, `/api/friend/updateKnowledge` |
| `get_friend_analytics` | GET | `/api/friend/analyticsList` |
| `calculate_friend_moving_averages` | GET + GET | `/api/friend/shortList`, `/api/friend/analyticsList` |
| `get_friends_list` | GET | `/api/friend/friends/page/<p>/size/<s>` |

All upstream calls go through `http://nginx` → stripped to `communicator-core:8085`.

---

## Error Handling

All tools wrap `requests` calls in try/except `requests.exceptions.RequestException` → return error string (not raise). The LLM receives the error string as the tool result.

`update_friend_knowledge` additionally catches general `Exception` from the GET-then-PUT merge step.

To change error response format: each tool's `except` block return value in `knowledgeMCP.py`

---

## Change Index

| Behaviour | Touch point |
|---|---|
| MCP listen address/port/path | `mcp.run()` in `knowledgeMCP.py` |
| ai_agent → MCP server URL | `config.yaml` → `mcp.server_url` → `settings.mcp_server_url` |
| MCP connection retry count | `config.yaml` → `mcp.retry_attempts` → `settings.mcp_retry_attempts` |
| MCP connection retry delay | `settings.mcp_connection_retry_delay` |
| Tool discovery + refresh | `MCPService.get_tools()`, `MCPService.refresh_tools()` |
| Tool lookup by name | `MCPService.get_tool_by_name()` |
| Knowledge pagination defaults | `get_friend_knowledge()` params `page`, `size` |
| Knowledge field name mapping | `create_friend_knowledge()` and `update_friend_knowledge()` dict keys (`fact`, `importance`) |
| Analytics date range default | `get_friend_analytics()` param `days_back` |
| Moving average field names | `calculate_friend_moving_averages()` `averageFrequency`, `averageExcitement`, `averageDuration` |
| Friends list page size default | `get_friends_list()` param `size` |
| nginx proxy for MCP | `nginx.conf` → `location /api/mcp/knowledge/` → `upstream mcp_knowledge_service` |
| Upstream API host (all tools) | `http://nginx` hardcoded in each tool in `knowledgeMCP.py` |
