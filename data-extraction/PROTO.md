# Data Extraction — Proto  `[PROTOTYPE / DETACHED]`

> **Proto, not a flow.** And no flow reaches it: this service is **not in `docker-compose.yml`**, not behind nginx, and not called by any other service. It's a standalone experiment.

Files: app/main.py (everything else — routers/, services/, repositories/, models/, prompts/, config/ — is empty `__init__.py` scaffolding)

## Role (intended)

A FastAPI microservice to **extract text from web pages** (and presumably other sources) to feed the knowledge pipeline. Uses **LlamaIndex** (`SimpleWebPageReader`).

## What actually exists

`app/main.py` only:
- `GET /` , `GET /health` — liveness stubs.
- `GET /extract/web?url=` → `SimpleWebPageReader().load_data([url])` → returns the page text + a 500-char preview.
- `prototype()` / `main()` — a CLI demo scraping a hardcoded LlamaIndex docs URL.

The layered structure (`routers`, `services`, `repositories`, `models`, `prompts`) is **empty scaffolding** — the intended shape of a real service, none of it filled in. Run locally via `run.sh` / `dev.sh` / `make start` (see README); there is no container in the compose stack.

## Seams

- **None wired.** Intended future seam: extracted documents → `ai_agent` knowledge-generation pipeline (embeddings + fact extraction). Today nothing calls `/extract/web` and it calls nothing back.

## Gotchas / Technology Notes

- **Detached from the running system.** Bringing it online means adding a compose service + an nginx route, then wiring its output into `ai_agent`. Until then it's dev-only.
- **`SimpleWebPageReader` fetches arbitrary URLs server-side** — an SSRF vector if ever exposed without allow-listing.
- Overlaps conceptually with `ai_agent`'s ingestion — decide which service owns "get raw text in" before building both.

## Change Index

| Thing | Where |
|---|---|
| Web extraction logic | `app/main.py extract_web_data()` |
| Wire into the stack | add compose service + nginx route; call from `ai_agent` |
| Implement real layers | fill `app/routers`, `app/services`, `app/repositories` |
