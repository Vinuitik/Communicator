# Communicator — Root Navigation Index

Navigation only. Each service has its own FLOWS.md.

## Services

| Service | Stack | FLOWS.md |
|---|---|---|
| communicator-core | Java / Spring Boot | [communicator-core/FLOWS.md](communicator-core/FLOWS.md) |
| ai_agent | Python / FastAPI / LangGraph | [ai_agent/FLOWS.md](ai_agent/FLOWS.md) |
| resourceRepository | Python / Flask | [resourceRepository/FLOWS.md](resourceRepository/FLOWS.md) |
| knowledgeMCP | Python / MCP | [knowledgeMCP/FLOWS.md](knowledgeMCP/FLOWS.md) |
| nginx | Static JS UI + reverse proxy | no FLOWS.md — JS entry points listed per-domain above |
| data-extraction | Python (scaffolded) | not yet implemented |

## Cross-service topology

```
Browser (nginx/static JS)
  ↓ HTTP/WS
communicator-core :8085
  ↓ HTTP (WebClient)          ↓ HTTP (WebClient)
ai_agent :8000          resourceRepository :5000
  ↓ MCP stdio
knowledgeMCP
  ↓ HTTP (via nginx internal)
communicator-core :8085
```

## Known cross-service issues (as of documentation pass)

- **EMA alpha mismatch**: `analytics.js` and `EmaProperties` use alpha=0.7; `ChronoProperties.getNewDataAlpha()` uses 0.3 — chart preview ≠ nightly job output. Fix: `EmaProperties`, `ChronoProperties`, `analytics.js`
- **File deletion 400**: `mediaDeletion.js` sends `FormData` on DELETE but `friends_files.py` calls `request.get_json()` — always returns `None`. Fix: `friends_files.py` delete handler
- **Group social UI gap**: `social.js` / `SocialAPIService` targets `/api/friend/socials` — no UI page for group social endpoints
- **Connections not implemented**: `ConnectionService`, `ConnectionPermissionService`, `ConnectionKnowledgeService` are empty stubs
- **FAISS index staleness**: `ai_agent` FAISS index is in-memory only; must call `SearchService.clear_index()` after new chunks are added
- **Redis cache no TTL**: knowledge summary cache in `ai_agent` has no expiry — stale summaries persist until explicit invalidation
