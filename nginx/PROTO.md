# nginx + Orchestration — Proto (the routing spine)

> **Proto, not a flow.** This is the *ingress + wiring map* every end-to-end flow passes through first. Real pipelines live in [flows/](../flows/). Read this to answer "where does a browser request actually go?" and "what talks to what on the docker network?"

Files: nginx/nginx.conf, nginx/Dockerfile, docker-compose.yml, .env (`HOST_TIMEZONE`)

## Role

Single ingress. **The only host-exposed app port is `8090:80`** (nginx). Everything else is `expose`d on the internal docker network only — no other service is reachable from the host except infra debug ports (Postgres 5433, Redis 6379, Embedder 8010, Kafka 9095, Kafka-UI 8089, Ollama 11434 — unused since 2026-07-23). nginx does two jobs at once:

1. **Reverse proxy** `/api/*` → backend services (prefix stripped).
2. **Static web server** for the **legacy multi-page UI** baked into the image (`static/` → `/usr/share/nginx/html`), *and* a proxy to the **React SPA** at `/app/`. Two frontends coexist (see Gotchas).

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
| `/app/` | `react-ui:80/` | SPA, `try_files … /index.html`, no-cache, security headers |

**Static pages served directly by nginx** (legacy MPA, `root /usr/share/nginx/html`, all no-cache):

| Browser path | Serves | Backing static dir |
|---|---|---|
| `/index` , `/` (fallback) | `index.html` | `static/mainPage` |
| `/stats` | `analytics/analytics.html` | analytics dashboard |
| `/social?friendId=N` | `social/social.html` | social links page |
| `/fileUpload/{id}` | `fileUpload/fileUpload.html` | calendar/media upload (numeric-id regex) |
| `/api/groups/createGroup` | `createGroup/createGroup.html` | **static page under an `/api/` path** (footgun) |
| `/groupsView/`,`/groupDetails/`,`/groupKnowledge/`,`/createGroup/` | CSS/JS assets | group MPA assets |
| `/api-test/` | `Test/` (alias) | manual API test harness |
| `= /validation` → 302 `/app/validation` ; `= /react` → 302 `/app/` | redirects into SPA | |
| `= /fileUpload/fileUpload.html` → **404** | deliberately blocked (force the id-based route) | |

To change any public path: edit `nginx/nginx.conf` and rebuild the nginx image (config is **COPY-baked**, not mounted — see Gotchas).

---

## Compose orchestration map

**App services:** friend, group, connections, chrono, backup (all Spring/Java 21) · fileRepository (Flask) · ai-agent + mcp-knowledge-server + embedder (Python) · react-ui (React build → nginx) · nginx (ingress).

**Infra:**
| Service | Image | Purpose | Host port |
|---|---|---|---|
| postgres | `paradedb/paradedb:0.24.3-pg17` | primary DB `my_database` (+pgvector, +pg_search BM25 exts) — shared by the JVM apps AND ai_agent's RAG data (chunks/embeddings/facts/references) since 2026-07-23 | 5433→5432 |
| redis | `redis:7-alpine` | cache (appendonly persist) | 6379 |
| embedder | built from `embedder/Dockerfile` | ONNX EmbeddingGemma embeddings (768-dim), replaces Ollama for this — see [embedder/PROTO.md](../embedder/PROTO.md) | 8010 |
| kafka | `cp-kafka:7.6.0` (KRaft, no ZK) | event bus, 7-day retention, auto-create topics | 9095/9096 |
| kafka-ui | provectuslabs | topic inspection | 8089→8080 |
| ollama | `ollama/ollama` | still runs, **unused** since the embedder swap (2026-07-23) — a privacy-motivated decision about using it for chat/summarize is a separate, not-yet-had conversation | 11434 |

**generatedData (Mongo) retired 2026-07-23** — removed from compose entirely (all 4 collections it held moved to Postgres, confirmed empty before the migration ran). Its `generated-data` volume is declared-but-unmounted in `docker-compose.yml`, not deleted.

**depends_on chains:** nginx depends on friend/group/connections/mcp/ai-agent/react-ui · chrono depends on **friend + nginx** (it calls them) · ai-agent depends on **mcp-knowledge-server + postgres + embedder** · backup depends on postgres + fileRepository.

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

- **Two frontends, one origin.** The legacy vanilla-JS MPA is served *directly by nginx* from baked `static/`; the React SPA is *proxied* at `/app/`. They share `localhost:8090`. Which one you get depends purely on the path. New work is React; the MPA (`mainPage`, `addFriendForm`, `facts`, `analytics`, `social`, `profile`, `groupsView`) is `[LEGACY]` but still live and still the default at `/`.
- **Config is COPY-baked, not mounted.** `Dockerfile` does `COPY nginx.conf …` and `COPY static/`. Editing `nginx.conf` or any static file requires **rebuilding the nginx image** (`docker compose build nginx`) — a plain restart runs the old baked copy. This is the #1 "my change didn't take" trap.
- **CORS is per-location and inconsistent.** groups/mcp/ai add `Access-Control-Allow-Origin *`; friend/connections/fileRepository do not. Meanwhile the Spring controllers pin `@CrossOrigin(origins="http://nginx")`. Since everything is same-origin through nginx in normal use, this rarely bites — but a direct cross-origin call behaves differently per service.
- **`no-store` everywhere** ("development" caching disabled on every static/app route). Every page reload re-fetches. Fine for a personal single-user tool; would hammer bandwidth at scale. The `expires 14d` production lines are commented out, ready to re-enable.
- **Shared Postgres schema across 3 services.** friend/group/connections generate tables into one DB via Hibernate. No migration tool (Flyway/Liquibase). An entity change in one service can conflict with another's tables; startup order + `ddl-auto` decide who wins. Backups are the only safety net (see [backup proto](../backup/PROTO.md)).
- **Kafka auto-creates topics** (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`) — a typo in a producer topic name silently creates a new topic instead of erroring. 3 default partitions, replication 1 (single broker), 7-day retention.
- **`/api/chrono/` is exposed but shouldn't be used** — it's labeled "manual testing only". chrono runs itself on a schedule; hitting this endpoint fires jobs out of band.
- **`/api/groups/createGroup` serves a static HTML page** even though it lives under the `/api/groups/` proxy prefix — an exact-match `location =` intercepts it before the proxy block. Renaming group endpoints near this path can shadow/unshadow it.

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
