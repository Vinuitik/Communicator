# Flow: Chat with the AI agent (LangGraph + MCP tools)

Conversational access to your CRM: ask the agent about a friend and it uses **MCP tools** to read/write the friend service, reasoning with Gemini. **UI (WebSocket) → nginx → ai_agent → knowledgeMCP → nginx → friend**.

Protos: [ai_agent](../ai_agent/PROTO.md) · [knowledgeMCP](../knowledgeMCP/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md)

---

## The pipeline (WebSocket path — the real-time one)

```
Browser opens WebSocket  ws://localhost:8090/api/ai/chat/ws
 → nginx location /api/ai/  (Upgrade/Connection headers — the ONLY route with WS)  ─► ai-agent:8001/chat/ws
 → chat.py websocket_endpoint: loop receive_text()
     → AgentService.process_message(text)                              [ai_agent proto §chat]
        → LangGraph create_react_agent(gemini_llm, mcp_tools).ainvoke()
             agent reasons → decides to call a tool →
               MCP tool call ─► mcp-knowledge-server:8000/knowledgeMCP/   (streamable_http)
                 e.g. get_friend_knowledge(fid) ─► http://nginx/api/friend/getKnowledge/...
                                               ─► friend:8085 → Postgres
                 e.g. create_friend_knowledge(fid,fact,importance) ─► POST /api/friend/addKnowledge/{fid}
               tool result → back to agent → Gemini composes answer
     → normalize content (list-or-string → string) → send {type:"ai_response", content}
```

HTTP one-shot alternative: `POST /api/ai/chat/` → same `process_message`, single response. `GET /api/ai/chat/tools` lists the agent's MCP tools.

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
- **No streaming of tokens:** the WS sends one complete `ai_response` per user message (the agent runs to completion first), not incremental tokens.

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| Agent behaviour / model | `AgentService` + `config.yaml llm.*` |
| Available tools | `knowledgeMCP.py @mcp.tool()` functions |
| MCP connection | `config.yaml mcp.server_url` (must hit `mcp-knowledge-server:8000/knowledgeMCP/`) |
| WebSocket routing | `nginx/nginx.conf location /api/ai/` (Upgrade headers) |
| External MCP exposure | `nginx/nginx.conf location /api/mcp/knowledge/` |
