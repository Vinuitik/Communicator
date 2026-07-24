# Shared static config

Files: config.js, knowledgeManager.js

## Flow

Page HTML loads `/shared/config.js` (plain global script, not a module) as the
**first** `<script>` tag → sets `window.APP_CONFIG` → every other page script
(module or not) reads `window.APP_CONFIG.FRIEND_BASE` / `GROUPS_BASE` /
`CONNECTIONS_BASE` / `FILES_BASE` / `AI_BASE` / `BACKUP_BASE` instead of
hardcoding the path prefix.

Every value is a same-origin path, not a full URL — nginx (`nginx/nginx.conf`
upstream blocks) reverse-proxies each prefix to the actual backend
(`communicator-app`, `fileRepository`, `ai-agent`). Changing where a service
lives is an nginx.conf change, not a frontend change; `config.js` only needs
to change if the *path prefix itself* changes (e.g. `/api/friend` →
`/api/people`).

`config.js` is included in all 15 HTML entry points: the 9 pages under
`nginx/static/*/​*.html` plus the 6 Spring (Thymeleaf) templates in
`friend/src/main/resources/templates/` and
`group/src/main/resources/templates/groups/` — those templates load the same
JS files served from `nginx/static/`, so they need the same script tag.

To change a backend API prefix: `nginx/static/shared/config.js` (one line)
— every consumer picks it up automatically, no per-file hunting.

## Technology Notes

**Both `nginx` and `communicator-app` are built Docker images, not
bind-mounted volumes.** `nginx/Dockerfile` does `COPY static/
/usr/share/nginx/html/` at build time. This means:
- Editing any file under `nginx/static/` (including `config.js`) does
  **nothing** to the running container until you run
  `docker compose build nginx && docker compose up -d nginx`.
- Editing any Spring template (`friend/.../templates/*.html`,
  `group/.../templates/groups/*.html`) does nothing until
  `docker compose build communicator-app && docker compose up -d communicator-app`
  (a full Maven build — slow unless Docker's build cache is warm).
- Symptom if you forget: the browser/curl response looks unchanged, or
  (worse) an unmatched static path falls through to nginx's SPA fallback
  (`@fallback` → `index.html`), which can look like a 200 OK with completely
  wrong content — this is exactly what happened testing `/shared/config.js`
  before the rebuild, and is worth checking first if a static change
  "doesn't work."

**No env var / build-time swap for API base paths.** All `APP_CONFIG` values
are relative paths, deliberately not full URLs — they resolve against
whatever origin the browser loaded the page from, so no localhost-vs-prod
config split exists (or is needed) for this file specifically.

## Change Index

| Thing | Where |
|---|---|
| Add/change a backend path prefix | `nginx/static/shared/config.js` → `window.APP_CONFIG` |
| Add a prefix to a *new* page | add `<script src="/shared/config.js"></script>` as the first script tag in that page's HTML, before any script that reads `APP_CONFIG` |
| Change which service a prefix routes to | `nginx/nginx.conf` upstream block + matching `location` |
| Rebuild static assets into the running container | `docker compose build nginx && docker compose up -d nginx` |
| Rebuild Spring templates into the running container | `docker compose build communicator-app && docker compose up -d communicator-app` |
