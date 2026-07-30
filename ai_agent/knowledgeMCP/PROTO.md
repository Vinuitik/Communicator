# Knowledge MCP Server — Proto

> **Proto, not a flow.** How the AI agent gets its tools. Flows that use these tools are in [flows/](../flows/).

Files: knowledgeMCP.py, Dockerfile

## Role

A **FastMCP** server that exposes the friend service's knowledge/analytics as **MCP tools** the AI agent (or any MCP client, e.g. Claude) can call. Internal port **8000** (container `mcp-knowledge-server`), MCP endpoint path **`/knowledgeMCP/`**, transport **streamable-http**. Reached two ways: ai_agent connects **directly** (`mcp-knowledge-server:8000`); external clients can reach it via nginx `/api/mcp/knowledge/`.

Pure passthrough — **no database, no state**. Every tool is a thin `requests` wrapper around `http://nginx/api/friend/...` (it calls friend *through nginx*).

## Tools (all → friend service via nginx)

| Tool | Calls | Purpose |
|---|---|---|
| `get_friend_knowledge(fid,page,size)` | `GET /api/friend/getKnowledge/{fid}/page/{p}/size/{s}` | paginated facts |
| `create_friend_knowledge(fid,fact,importance)` | `POST /api/friend/addKnowledge/{fid}` | add a fact (`fact`→text, `importance`→priority via `@JsonProperty`) |
| `update_friend_knowledge(kid,fact,importance)` | `GET /getKnowledgeById/{kid}` then `PUT /updateKnowledge` | edit a fact (read-modify-write) |
| `get_friend_analytics(fid,days_back)` | `GET /api/friend/analyticsList` | interaction history |
| `calculate_friend_moving_averages(fid,days_back)` | `GET /shortList` + `/analyticsList` | **recomputes EMAs in Python** (see Gotchas) |
| `get_friends_list(page,size)` | `GET /api/friend/friends/page/{p}/size/{s}` | list friends |

Entry: `mcp.run(transport="streamable-http", host=0.0.0.0, port=8000, path="/knowledgeMCP/")`.

## Seams

**Inbound:**

| Caller | Trigger | How |
|---|---|---|
| ai_agent | agent builds its toolset at startup | `MCPService` → `mcp-knowledge-server:8000` (direct, streamable_http) — must match `ai_agent config.yaml mcp.server_url` incl. the `/knowledgeMCP/` path |
| external MCP client (e.g. Claude.ai) | use Communicator as a tool provider | nginx `/api/mcp/knowledge/` → `mcp-knowledge-server:8000` |

**Outbound:**

| Callee | Why | How |
|---|---|---|
| friend (via **nginx** `http://nginx/api/friend`) | all tool data | `requests` calls |

## Gotchas / Technology Notes

- **FOURTH EMA reimplementation.** `calculate_friend_moving_averages` computes moving averages **again, in Python**, from `/analyticsList`. The same algorithm now lives in: friend `EmaUpdateService` (Java, real-time), chrono `ChronoJobService`+`MovingAverageCalculationService` (Java, nightly), frontend `analytics.js` (JS), and here (Python). Four copies, guaranteed to drift. **The headline code-reuse finding.**
- **Calls friend through nginx** (like chrono) — but ai_agent's own `FriendApiService` calls friend *directly*. So the SAME friend endpoints are reached via two different paths depending on which service asks. One more inconsistency to hold in your head when debugging.
- **Field-name contract is fragile.** Tools send `{"fact":..., "importance":...}` relying on friend's `@JsonProperty("fact")`/`@JsonProperty("importance")` aliases mapping to `text`/`priority`. Rename those JSON aliases in friend and every MCP write breaks silently (returns friend's error text as a string).
- **Depended on at ai-agent startup.** If this server is down past ai_agent's MCP retry budget, **ai-agent won't start** (see ai_agent proto).
- **No auth on the tools.** Anything that can reach the MCP endpoint (internally, or via nginx `/api/mcp/knowledge/`) can read/write a friend's knowledge. nginx adds permissive CORS but no token.
- **The MCP path matters.** `/knowledgeMCP/` is the MCP mount; nginx maps `/api/mcp/knowledge/` → `mcp-knowledge-server:8000/` (root). A client must hit the right path or get 404 — verify `ai_agent`'s `mcp.server_url` includes `/knowledgeMCP/`.

## Tool Surface Audit

All 6 tools operate on **friend** data only — none call `connections` or `group`.

| Tool | Single friend_id scoped? |
|---|---|
| `get_friend_knowledge(friend_id,...)` | Yes |
| `create_friend_knowledge(friend_id,...)` | Yes |
| `update_friend_knowledge(knowledge_id,...)` | Indirect — takes `knowledge_id`, not `friend_id`, but the row belongs to exactly one friend |
| `get_friend_analytics(friend_id,...)` | Yes |
| `calculate_friend_moving_averages(friend_id,...)` | Yes (pulls friend's own `shortList` entry) |
| `get_friends_list(page,size)` | **No** — returns all friends, not scoped to one |

**Group data the agent cannot reach at all** (no tool calls the `group` service):
- Group existence/listing — no way to list groups or fetch a `SocialGroup` (`GET /list`, `GET /{id}`)
- Group membership — `GroupPermission` rows (which friends belong to a group, and their permission level) are the group's member list; no tool exposes this
- Group knowledge — `GroupKnowledge` (group-level facts, analogous to friend knowledge but scoped to the whole group)
- Group socials/files — `GroupSocial`, `GroupResource`/`GroupPhoto`/`GroupVideo`, primary photo

**Connection data the agent cannot reach at all** (no tool calls the `connections` service):
- Person↔person relationships — `Connection` (friend1Id, friend2Id, description) is never listed or fetched, so the agent has no way to know two friends are connected or how
- Connection knowledge — `ConnectionsKnowledge`, facts specific to a *pair* of friends (distinct from single-friend knowledge)
- Connection permissions — `ConnectionPermission`, visibility/permission level on a connection

Net effect: the agent can answer "what do I know about friend X" but not "who is friend X connected to," "what group is friend X in," or "what do I know about the group/relationship itself."

## Change Index

| Thing to change | Where |
|---|---|
| Add/modify a tool | `knowledgeMCP.py` `@mcp.tool()` functions |
| Friend base URL (through nginx) | hardcoded `http://nginx/api/friend/...` in each tool |
| MCP transport / port / path | `knowledgeMCP.py mcp.run(...)` (`8000`, `/knowledgeMCP/`) |
| The Python EMA copy | `calculate_friend_moving_averages()` (consolidate with friend/chrono) |
| External exposure | `nginx/nginx.conf location /api/mcp/knowledge/` |
| ai_agent connection URL | `ai_agent config.yaml mcp.server_url` (must reach `:8000/knowledgeMCP/`) |
