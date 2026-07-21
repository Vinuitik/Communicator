# Flow: Chat with the AI agent (LangGraph + MCP tools)

Conversational access to your CRM: ask the agent about a friend and it uses **MCP tools** to read/write the friend service, reasoning with Gemini. **UI (WebSocket) → nginx → ai_agent → (in-process knowledgeMCP stdio) → nginx → friend**. (knowledgeMCP runs inside ai_agent as of 2026-07-13 — no separate container.)

Protos: [ai_agent](../ai_agent/PROTO.md) · [knowledgeMCP](../knowledgeMCP/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md)

---

## The pipeline (WebSocket path — the real-time one)

```
Browser opens WebSocket  ws://localhost:8090/api/ai/chat/ws
 → nginx location /api/ai/  (Upgrade/Connection headers — the ONLY route with WS)  ─► ai-agent:8001/chat/ws
 → chat.py websocket_endpoint: loop receive_text()   (STATELESS — no server memory)
     → client sends {type:'chat', friendId, messages:[{role,content}...]}  ← FULL transcript
        (the browser owns it in sessionStorage; server never stores it)
     → _build_messages(payload): normalize + _cap_history (≤50) + stamp
        `[Active friend_id=N]` on the latest user turn (NOT the raw JSON)
     → AgentService.stream_message(messages)   ← replayed each turn = the "memory"
        → LangGraph create_react_agent(gemini_llm, mcp_tools).astream_events(v2)
             per event → WS frame (state machine, not one blob):
               on_chat_model_start  → {type:"thinking"}
               on_chat_model_stream → {type:"token", content:delta}  (+ {type:"trace"} on tool decision)
               on_tool_start        → {type:"tool_call",  name, data:args}
                 MCP tool call ─► in-process knowledgeMCP (stdio subprocess of ai_agent)
                   e.g. get_friend_knowledge(fid) ─► http://nginx/api/friend/getKnowledge/...
                                                 ─► communicator-app:8080 → Postgres
                   e.g. create_friend_knowledge(fid,fact,importance) ─► POST /api/friend/addKnowledge/{fid}
               on_tool_end          → {type:"tool_result", name, data:result}
             stream end → {type:"ai_response", content: full answer}   (careful extraction: last
                          model turn's content, NOT messages[-1]); on failure → {type:"error"}
```

Every event is also logged server-side as a `TRACE …` line (see the LLM's thoughts / tool decisions). HTTP one-shot alternative: `POST /api/ai/chat/` → still `process_message` (single blob, unchanged). `GET /api/ai/chat/tools` lists the agent's MCP tools.

---

## The tool surface (what the agent can actually do)

From [knowledgeMCP](../knowledgeMCP/PROTO.md) — all proxy to friend via nginx:
`get_friend_knowledge` · `create_friend_knowledge` · `update_friend_knowledge` · `get_friend_analytics` · `calculate_friend_moving_averages` · `get_friends_list`.

**Achieves:** natural-language CRUD over friends' knowledge + analytics, with the LLM choosing tools. Writes done here (e.g. `create_friend_knowledge`) land as real knowledge rows — which then feed the [knowledge-RAG flow](knowledge-rag.md).

---

## Notes (from protos)

- **Startup coupling:** ai_agent builds its toolset from knowledgeMCP at boot with retries; if MCP is down past the budget, **ai_agent won't start**. So this flow's availability gates the whole ai_agent service.
- **Two hops to friend, mixed conventions:** agent → MCP → **nginx** → friend. But ai_agent's *own* knowledge pipeline calls friend **directly**. Same backend, two routes.
- **External clients:** the same MCP server is reachable at nginx `/api/mcp/knowledge/`, so an outside MCP client (e.g. Claude.ai) can drive these tools too — **no auth gate**.
- **WS now streams a state machine** (2026-07-21): `thinking → tool_call/tool_result → token… → ai_response` (or `error`), plus `trace` frames carrying the agent's tool-call decisions. Token streaming is live (`astream_events` v2). The HTTP one-shot path (`process_message`) is still a single blob. **The client used to feed the raw JSON envelope to the LLM** — now `_parse_envelope` extracts `.message` and injects `friend_id`.
- **Conversation memory** (2026-07-21): the LangGraph graph is **stateless** — before this, every message started from scratch (no memory of the chat). Fixed **client-side**: the browser stores the transcript in **sessionStorage** (`AiChat` in `aiChat.js`) and replays the full `messages` array each turn; the server just re-runs the agent over it. Deliberately simple (no summarizer/window model) — this agent is chit-chat.
- **Debug traces:** server logs every step as `TRACE …`; the UI shows tool calls + LLM thoughts as grey lines when `AiChat.debug` (default on). Set `AiChat.debug = false` to hide the trace lines (still console-logged).

## Technology Notes
- **Chat memory lives in the browser's sessionStorage, keyed `frm_chat:<friendId>`.** Lifecycle is deliberately the sessionStorage contract: **survives page reload**, **wiped by the browser on tab close**, and `dropOtherFriendChats()` clears other friends' keys on open (so opening a new friend drops the old chat). Consequences: NOT durable across tab close, NOT synced across tabs/devices, ~5 MB cap, string-only. If durable/cross-device memory is ever wanted, persist the transcript to Postgres (a `conversation` table) — do NOT reach for IndexedDB just to "keep on close", that fights the chosen lifecycle.
- **Server is stateless / client-authoritative.** The browser replays the whole transcript each turn; the WS handler holds no memory, so reconnects (tab refocus, network blips, ai_agent restart) lose nothing as long as the tab lives. `friend_id` is stamped onto the latest user turn server-side (`_build_messages`).
- **Whole transcript is re-sent to Gemini every turn** — cost/latency grow linearly with turn count. Capped at `MAX_HISTORY=50` (`_cap_history`, keeps first turn + most recent) as a runaway guard, not a real context-window strategy.
- **Only user/assistant text is remembered, not tool calls.** Intermediate `tool_call`/`tool_result` steps are streamed to the UI but never stored; each turn the agent re-decides tools fresh from the visible Q&A. It won't "remember" a specific tool result unless it surfaced in its answer.

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| Agent behaviour / model | `AgentService` + `config.yaml llm.*` |
| WS state events / streaming | `AgentService.stream_message` (astream_events v2) + `routers/chat.py` |
| Client envelope → message | `routers/chat.py _parse_envelope` |
| Chat transcript store / lifecycle | `aiChat.js` sessionStorage (`STORE_PREFIX`, `persist`, `dropOtherFriendChats`) |
| Transcript → agent messages / cap | `routers/chat.py _build_messages` + `_cap_history` (`MAX_HISTORY`) |
| Which states the UI renders | `aiChat.handleMessage` + `aiChatUI` stream/trace methods |
| Show/hide thought traces | `AiChat.debug` (aiChat.js) |
| Available tools | `knowledgeMCP.py @mcp.tool()` functions |
| MCP connection | in-process stdio — `mcp_service.py` spawns `knowledgeMCP/knowledgeMCP.py` (no `server_url`/HTTP) |
| WebSocket routing | `nginx/nginx.conf location /api/ai/` (Upgrade headers) |
| External MCP exposure | `nginx/nginx.conf location /api/mcp/knowledge/` |
