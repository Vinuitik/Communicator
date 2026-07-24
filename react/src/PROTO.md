# React UI — Proto `[PARTIALLY REAL — one page ported]`

> **Proto, not a flow.** Pages are being ported from the legacy MPA
> (`nginx/static/`) one at a time, preserving existing behavior/styling —
> the visual redesign is a deliberately separate later pass. See the "Two
> frontends" gotcha in [nginx/PROTO.md](../../nginx/PROTO.md).

Files: App.tsx, index.tsx, services/api/{config,friendService,groupService,connectionService}.ts, hooks/useApi.ts, utils/constants.ts, components/{atoms,molecules,organisms,templates,pages}/*

## Role

The modern SPA meant to replace the legacy MPA. React 18 + TypeScript + react-router-dom v6 + TailwindCSS, built with react-scripts (CRA). Built to static files and served by its **own** nginx (`react-ui:80`, config at `react/nginx.conf`), which the main nginx proxies at **`/app/`** (pure `proxy_pass`; the SPA-fallback `try_files` lives in `react/nginx.conf`, not the main nginx — see nginx/PROTO.md gotcha on why that split matters).

Structured with **atomic design**: `atoms` (Button, Input, Select, Textarea) → `molecules` (FormField, SearchBar) → `organisms` (Header, NavigationBar, KnowledgeEditor, AddFriendForm) → `templates` (PageLayout) → `pages` (Home, Friends, Groups, AddFriend).

## Internal wiring

```
index.tsx → App.tsx → <Router basename="/app"><PageLayout><Routes>
  /             → HomePage    [STUB — still "coming soon"]
  /friends      → FriendsPage [STUB]
  /friends/add  → AddFriendPage [REAL — first ported page]
  /groups       → GroupsPage  [STUB]

PageLayout renders NavigationBar (real brand: "Friends Tracker", brand-purple,
real nav links). Unported nav destinations are plain <a> to the legacy MPA's
absolute path; ported ones are react-router <Link>. Flip each link as its
page gets ported — same policy in AddFriendForm's Cancel button.

services/api/config.ts        — single source of API base paths (mirrors nginx/static/shared/config.js)
services/api/friendService.ts — addFriend() is REAL (POST /api/friend/addFriend); getFriends/removeFriend still stubs, TODO-tagged for the FriendsPage port
services/api/groupService.ts, connectionService.ts — still stubs, untouched
hooks/useApi.ts               — generic fetch hook, unused so far
utils/constants.ts            — ROUTES, TIMEOUTS, DEFAULTS (API_BASE_URL removed — see config.ts)
```

## AddFriendPage — what "ported" means here

`components/pages/AddFriendPage` composes `AddFriendForm` (name/lastSpoken/experience/hours/dob — the 5 legacy fields) and `KnowledgeEditor` (fact/importance list). On submit it builds the exact payload shape `FriendController.addFriend` expects (`types/api.ts` `NewFriendPayload`, mirrored from the Java `Friend`/`FriendKnowledge` entities) and POSTs for real. `KnowledgeEditor` has **no API calls of its own** — matches the legacy behavior on this specific page (knowledgeManager.js only writes to the DOM table here; there's no friend id yet to attach knowledge to). It becomes API-backed when facts.html's equivalent gets ported.

Not yet ported from `addForm.html`: nothing — this page is functionally complete. Untouched: everything else in the nav (Home/friends-list, Stats, Settings, group pages, profile, social, file upload).

## Seams (intended vs actual)

**Outbound:** browser → main nginx `/api/friend/...` → `communicator-app:8080`. Relative `/api/...` is correct since the SPA is always reached through `/app/` on the same nginx origin — see `services/api/config.ts`.

**Real today:** `addFriend()` only. Everything else in `friendService`/`groupService`/`connectionService` is still a placeholder that returns empty arrays / echoes input / logs to console — calling them does nothing real.

## Gotchas / Technology Notes

- **Styles are being ported as Tailwind utility classes, not the legacy CSS files verbatim.** `tailwind.config.js` carries the legacy brand tokens (`brand` = `#6A5ACD`, `surface` = `#f5f5f5`, `font-sans` = Roboto) so ported components look the same without copying 100+ line CSS files in wholesale. If a ported page visibly drifts from the legacy page's look, check the Tailwind classes against the source CSS file in `nginx/static/`, not the other way around.
- **`react-ui` is a baked Docker image**, same trap as the main nginx: editing anything under `react/` (including `react/nginx.conf`) does nothing to the running container until `docker compose build react-ui && docker compose up -d react-ui`.
- **`Router` needs `basename="/app"`.** The browser URL is always `/app/...` (that's what nginx's `location /app/` matches on), but proxy_pass strips the prefix before react-ui ever sees the request — react-ui's own server only ever sees `/`, `/friends/add`, etc. `basename` reconciles this: without it, every route silently fails to match once actually deployed through nginx (this bit the very first page ported — see nginx/PROTO.md's `/app/` gotcha for the matching backend-side bug).
- **CRA detects the `/app/` mount from `package.json`'s `homepage` field** and prefixes built asset URLs accordingly (`/app/static/js/main.*.js`). Don't remove that field.
- **No state manager / data-fetching lib** (no Redux/Zustand/React Query) — just `useApi`, currently unused. Fine while only one page is real; revisit once 2-3 pages need shared server state.

## Change Index

| Thing to change | Where |
|---|---|
| Add/change a backend API prefix | `services/api/config.ts` `API_BASE` |
| Wire a real API call for a stubbed page | `services/api/*.ts` (replace placeholder body) |
| Add a route | `App.tsx` `<Routes>` + `utils/constants.ts` `ROUTES` |
| Port the next legacy page | new `components/pages/<Name>Page/`, reuse existing atoms/molecules/organisms first — check `components/{atoms,molecules,organisms}/index.ts` before writing a new one |
| Brand tokens (color/font) | `tailwind.config.js` `theme.extend` |
| Nav links / branding | `components/organisms/NavigationBar/NavigationBar.tsx` |
| SPA mount path (ingress) | `nginx/nginx.conf` `location /app/` (main nginx) |
| SPA client-route fallback | `react/nginx.conf` (react-ui's own nginx) |
| Build/serve | `react/Dockerfile` (CRA build → nginx:alpine), rebuild `react-ui` image to deploy |
