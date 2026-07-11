# React UI — Proto  `[SCAFFOLD / PARTIALLY IMPLEMENTED]`

> **Proto, not a flow.** And be careful: **the React app is NOT the live UI yet** — its API layer is placeholder stubs. The working user flows today run through the **legacy static MPA** baked into nginx (`nginx/static/`), documented in the [nginx proto](../../nginx/PROTO.md). See "Two frontends" there.

Files: App.tsx, index.tsx, services/api/{friendService,groupService,connectionService}.ts, hooks/useApi.ts, utils/constants.ts, components/{atoms,molecules,organisms,templates,pages}/*

## Role (intended)

The modern SPA meant to replace the legacy MPA. React 18 + TypeScript + react-router-dom v6 + TailwindCSS, built with react-scripts (CRA). Built to static files and served by its **own** nginx (`react-ui:80`), which the main nginx proxies at **`/app/`** (`try_files … /index.html` for client-side routing).

Structured with **atomic design**: `atoms` (Button, Input) → `molecules` (FormField, SearchBar) → `organisms` (Header, NavigationBar) → `templates` (PageLayout) → `pages` (Home, Friends, Groups).

## Internal wiring

```
index.tsx → App.tsx → <Router><PageLayout><Routes>
  /        → HomePage
  /friends → FriendsPage
  /groups  → GroupsPage
services/api/friendService.ts, groupService.ts, connectionService.ts  — the backend seam (STUBBED)
hooks/useApi.ts                                                       — generic fetch hook
utils/constants.ts                                                    — API_BASE_URL, ROUTES, DEFAULTS
```

## Seams (intended vs actual)

**Outbound (intended):** browser → main nginx `/api/friend|groups|connections/...` → Spring services. Relative `/api/...` is correct **when served at `/app/`** so it shares the nginx origin.

**Actual today:** essentially none wired.
- `services/api/friendService.ts` — `getFriends()` returns `[]`, `addFriend()` echoes input, `removeFriend()` just `console.log`s. **Placeholder implementations**, not real fetches.
- `utils/constants.ts` — `API_BASE_URL = 'http://localhost:8090/api'` is **hardcoded to the host port** (won't work from inside the served app / other origins; should be the relative `/api`). `friendService` uses a *different* base (`/api/friend`) than this constant — inconsistent.

## Gotchas / Technology Notes

- **This app does not talk to the backend yet.** Any "React flow" is aspirational. The real, working flows (add friend, this-week list, facts, analytics, social, media upload) are the **vanilla-JS pages in `nginx/static/`** served directly by nginx. Don't debug a live issue here expecting it to be the running UI.
- **Two conflicting API base URLs.** `constants.API_BASE_URL` (`http://localhost:8090/api`, absolute host) vs `friendService.API_URL` (`/api/friend`, relative). Pick the relative form (works behind `/app/` through nginx) before wiring real calls.
- **CRA/react-scripts + Node 18 build** → static files served by a second nginx. So there are **two nginx containers** in play: `react-ui` (serves the SPA build) and the main `nginx` (ingress that proxies `/app/` to it). Editing the SPA requires a rebuild of the `react-ui` image (static build baked in), same trap as the main nginx.
- **No state manager / data-fetching lib** (no Redux/Zustand/React Query) — just `useApi`. Fine now; will need one once real data flows.
- **Routes in `constants.ROUTES` reference legacy paths** (`/social`, `/api/groups/createGroup`, `/fileUpload`) that are served by the *legacy MPA*, not React routes — a sign the two frontends are meant to interoperate during migration.

## Change Index

| Thing to change | Where |
|---|---|
| Wire real API calls | `src/services/api/*.ts` (replace placeholder bodies) |
| API base URL | `src/utils/constants.ts API_BASE_URL` (make it relative `/api`) — reconcile with `friendService.API_URL` |
| Routes | `src/App.tsx` `<Routes>` + `src/utils/constants.ts ROUTES` |
| Generic fetch behaviour | `src/hooks/useApi.ts` |
| SPA mount path (ingress) | `nginx/nginx.conf location /app/` |
| Build/serve | `react/Dockerfile` (CRA build → nginx:alpine), rebuild `react-ui` image to deploy |
| Design tokens | Tailwind (`tailwind.config.js`) + `src/styles/*` |
