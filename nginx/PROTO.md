# nginx + Orchestration — Proto (the routing spine)

> **Proto, not a flow.** This is the *ingress + wiring map* every end-to-end flow passes through first. Real pipelines live in [flows/](../flows/). Read this to answer "where does a browser request actually go?" and "what talks to what on the docker network?"

Files: nginx/nginx.conf, nginx/Dockerfile, docker-compose.yml, .env (`HOST_TIMEZONE`)

## Role

Single ingress. **The only host-exposed app port is `8090:80`** (nginx). Everything else is `expose`d on the internal docker network only — no other service is reachable from the host except infra debug ports (Postgres 5433, Redis 6379, Embedder 8010, Kafka 9095, Kafka-UI 8089, Ollama 11434 — unused since 2026-07-23). nginx does two jobs:

1. **Reverse proxy** `/api/*` → backend services (prefix preserved — see `PathPrefixConfig` in the friend/group/connections monolith).
2. **Proxy to the React SPA** at `/app/` — the *only* frontend now (see below).

**The legacy multi-page UI is gone (removed 2026-07-24).** `static/` used to be baked into this image and served directly at `/` (plus a scattering of Thymeleaf-rendered pages proxied through to the backend); once all 13 of its pages had a real React equivalent (see [react/PROTO.md](../react/PROTO.md)), the static tree, the Thymeleaf templates, and the two view-returning controllers that rendered them (`friend`'s `WebController`, `group`'s `GroupWebController`) were all deleted in one pass — fully recoverable from git history (`git log --diff-filter=D -- nginx/static friend/.../templates group/.../templates`), not a soft-delete. `nginx/static/` is kept as an empty directory (`.gitkeep`) purely because `Dockerfile`'s `COPY static/ /usr/share/nginx/html/` needs the source path to exist.

**Root `/` now redirects (302) to `/app/`** — this is an interim cutover, not the final state. React is still mounted under the `/app/` prefix (CRA's `homepage` field, react-router's `basename="/app"`), so the redirect just bounces traffic there rather than serving the SPA natively at `/`. A follow-up pass should drop the `/app/` prefix end-to-end (CRA `homepage`, router `basename`, this redirect) so React really is the root, not one bounce away from it.

---

## Upstreams (service name : internal port)

| Upstream block | Container (compose `container_name`) | Port |
|---|---|---|
| `friend_service` | `friend` | 8085 |
| `group_service` | `groupService` | 8086 |
| `connection_service` | `connectionService` | 8088 |
| `chrono_service` | `chronoService` | 8087 |
| `media_service` | `fileRepository` | 5000 |
| `mcp_knowledge_service` | `mcp-knowledge-server` | 8000 |
| `ai_agent_service` | `ai-agent` | 8001 |
| `react_ui_service` | `react-ui` | 80 |

Note the upstream names use the **compose `container_name`** (e.g. `groupService`), NOT the compose *service key* (`group`). Docker DNS resolves container_name on the default network. Changing a `container_name` in compose silently breaks the matching `upstream` here.

---

## Route table (browser path → destination)

**API proxies** (trailing slash on `proxy_pass` strips the location prefix):

| Browser path | → | Notes |
|---|---|---|
| `/api/friend/` | `friend:8085/` | 300s timeouts, `proxy_request_buffering off` (large uploads) |
| `/api/groups/` | `groupService:8086/` | full CORS + OPTIONS preflight 204 |
| `/api/connections/` | `connectionService:8088/` | |
| `/api/fileRepository/` | `fileRepository:5000/` | media bytes |
| `/api/mcp/knowledge/` | `mcp-knowledge-server:8000/` | CORS + preflight |
| `/api/chrono/` | `chronoService:8087/chrono/` | **manual test only** — chrono normally self-triggers |
| `/api/ai/` | `ai-agent:8001/` | **WebSocket upgrade headers** + CORS |
| `/app/` | `react-ui:80/` | SPA, pure proxy_pass, no-cache, security headers. SPA fallback for client-side routes lives in `react-ui`'s *own* nginx (`react/nginx.conf`), not here — see Gotchas. |

**Everything else** (no static MPA left as of 2026-07-24 — see Role):

| Browser path | Behavior |
|---|---|
| `= /validation` | 302 → `/app/validation` |
| `= /react` | 302 → `/app/` |
| `/` (catch-all — anything not matched above) | 302 → `/app/` |

All the old exact-match static routes (`/index`, `/stats`, `/social`, `/fileUpload/{id}`, `/api/groups/createGroup`, `/groupsView/`, `/groupDetails/`, `/groupKnowledge/`, `/createGroup/`, `/api-test/`) are gone along with the files they served — hitting any of them now just falls through to the catch-all redirect above, same as any other unmatched path.

To change any public path: edit `nginx/nginx.conf` and rebuild the nginx image (config is **COPY-baked**, not mounted — see Gotchas).

---

## Compose orchestration map

**App services:** friend, group, connections, chrono, backup (all Spring/Java 21, one JVM) · fileRepository (Flask) · ai-agent + embedder + host-wrapper (Python) · react-ui (React build → nginx) · nginx (ingress). (No `mcp-knowledge-server` — knowledgeMCP runs in-process inside ai-agent as a stdio subprocess, not a container, since 2026-07-13.)

**Infra:**
| Service | Image | Purpose | Host port |
|---|---|---|---|
| postgres | `paradedb/paradedb:0.24.3-pg17` | primary DB `my_database` (+pgvector, +pg_search BM25 exts) — shared by the JVM apps AND ai_agent's RAG + LLM-settings data since 2026-07-23 | 5433→5432 |
| redis | `redis:7-alpine` | cache (appendonly persist) | 6379 |
| embedder | built from `embedder/Dockerfile` | ONNX EmbeddingGemma embeddings (768-dim), replaces Ollama for this — see [embedder/PROTO.md](../embedder/PROTO.md) | 8010 |
| ollama | `ollama/ollama` | local chat LLM (`llama3.2:3b`) — active again as of 2026-07-23, used when `llm_settings.mode='ollama'` (default) | 11434 |
| host-wrapper | built from `host-wrapper/Dockerfile` | cloud LLM gateway (gemini/github/mistral/groq/deepseek/anthropic, failover) — containerized + wired into ai_agent 2026-07-23, used when `mode='cloud'` — see [host-wrapper/PROTO.md](../host-wrapper/PROTO.md) | 5011 |
| kafka | `cp-kafka:7.6.0` (KRaft, no ZK) | event bus, 7-day retention, auto-create topics | 9095/9096 |
| kafka-ui | provectuslabs | topic inspection | 8089→8080 |

**generatedData (Mongo) retired 2026-07-23** — removed from compose entirely (all 4 collections it held moved to Postgres, confirmed empty before the migration ran). Its `generated-data` volume is declared-but-unmounted in `docker-compose.yml`, not deleted.

**depends_on chains:** nginx depends on **communicator-app + ai-agent + react-ui** · chrono depends on **friend + nginx** (it calls them) · ai-agent depends on **postgres + embedder + host-wrapper** (host-wrapper is start-order only — ai-agent still works if it's down and mode=ollama) · backup depends on postgres + fileRepository.

**Shared DB:** friend, group, connections all use the SAME `SPRING_DATASOURCE_URL=jdbc:postgresql://postgresDB:5432/my_database`, user `myapp_user` / pass `example`. Hibernate `ddl-auto` auto-generates tables into one schema (see Gotchas). ai_agent shares this same database/instance too now (`databases.postgres.dsn` in its own `config.yaml`) — its tables are applied idempotently at its own startup via `ai_agent/db/schema.sql`, not through Hibernate.

**Named volumes:** `postgres-data`, `redis-data`, `kafka-data`, `generated-data` (unmounted), `ollama-data`, `embedder-models`, per-media `file-repo-*` (photos/videos/voice/personal/groups/connections), per-service maven caches, `npm-cache`.

---

## Seams (this IS the seam layer for the whole system)

- **Every inbound user request** enters here. UI → `nginx:8090` → one upstream. Flows start at this table.
- **Timezone:** every service gets `TZ=${HOST_TIMEZONE:-UTC}` from `.env`. Cron schedules + `LocalDate.now()` in friend/chrono depend on this being right.
- **AI WebSocket:** only `/api/ai/` carries `Upgrade`/`Connection` headers — the AI agent streams; other upstreams are request/response.
- **cross-cutting env seeds:** ai-agent loads `./ai_agent/.env` (secrets, model config); root `.env` holds only `HOST_TIMEZONE`. `config.json` (untracked, repo root) — check before assuming a value.

---

## Gotchas / Technology Notes

- **One frontend now (was two).** Until 2026-07-24 the legacy vanilla-JS MPA was served *directly by nginx* from baked `static/` at `/`, alongside the React SPA *proxied* at `/app/` — which one you got depended purely on the path. All 13 legacy pages now have a real React equivalent (see [react/PROTO.md](../react/PROTO.md)), so the static tree, the Thymeleaf templates, and their view-controllers (`WebController`, `GroupWebController`) were deleted and `/` now just redirects to `/app/`. Fully recoverable from git history if something was missed.
- **`/app/` was silently broken until 2026-07-24.** The location mixed `proxy_pass` with `try_files $uri $uri/ /index.html;`. `try_files` needs a `root` to check against, which this location never had, so it always missed and fell through to nginx's catch-all `location /`, serving the *legacy* `index.html` — proxy_pass was never reached. curl looked fine (200 OK) because the wrong response was still a valid page. Fixed by making `/app/` pure `proxy_pass` and moving SPA-fallback (`try_files $uri /index.html`) into react-ui's own nginx config (`react/nginx.conf`) instead.
- **Config is COPY-baked, not mounted.** `Dockerfile` does `COPY nginx.conf …` and `COPY static/`. Editing `nginx.conf` or any static file requires **rebuilding the nginx image** (`docker compose build nginx`) — a plain restart runs the old baked copy. This is the #1 "my change didn't take" trap.
- **CORS is per-location and inconsistent.** groups/mcp/ai add `Access-Control-Allow-Origin *`; friend/connections/fileRepository do not. Meanwhile the Spring controllers pin `@CrossOrigin(origins="http://nginx")`. Since everything is same-origin through nginx in normal use, this rarely bites — but a direct cross-origin call behaves differently per service.
- **`no-store` everywhere** ("development" caching disabled on every static/app route). Every page reload re-fetches. Fine for a personal single-user tool; would hammer bandwidth at scale. The `expires 14d` production lines are commented out, ready to re-enable.
- **Shared Postgres schema across 3 services.** friend/group/connections generate tables into one DB via Hibernate. No migration tool (Flyway/Liquibase). An entity change in one service can conflict with another's tables; startup order + `ddl-auto` decide who wins. Backups are the only safety net (see [backup proto](../backup/PROTO.md)).
- **Kafka auto-creates topics** (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`) — a typo in a producer topic name silently creates a new topic instead of erroring. 3 default partitions, replication 1 (single broker), 7-day retention.
- **`/api/chrono/` is exposed but shouldn't be used** — it's labeled "manual testing only". chrono runs itself on a schedule; hitting this endpoint fires jobs out of band.

---

## Change Index

| Thing to change | Where |
|---|---|
| Public port | `docker-compose.yml` nginx `ports: 8090:80` |
| Add/edit an API route | `nginx/nginx.conf` `location /api/...` + rebuild nginx image |
| Add/edit a static page route | `nginx/nginx.conf` `location = /...` + `static/...` + rebuild |
| Upstream target (service moved/renamed) | `nginx.conf` `upstream {}` block (uses `container_name`) |
| Upload size / timeouts | `nginx.conf` `client_max_body_size` (100M), `proxy_*_timeout` (300s) |
| React SPA mount path | `nginx.conf` `location /app/` |
| Timezone for all services | `.env` `HOST_TIMEZONE` |
| DB credentials/URL (all Spring services) | `docker-compose.yml` `SPRING_DATASOURCE_*` |
| AI agent secrets/model | `ai_agent/.env` |
| Kafka retention / partitions | `docker-compose.yml` kafka `KAFKA_LOG_RETENTION_HOURS`, `KAFKA_NUM_PARTITIONS` |
| Embedding model | `embedder` service env vars (`EMBED_MODEL` etc.) — see [embedder/PROTO.md](../embedder/PROTO.md) |
| Which services block nginx start | `docker-compose.yml` nginx `depends_on` |
