# Browser Extension — Proto

> **Proto, not a flow.** Covers the MV3 "Quick Capture" extension end to end:
> what each file does, how a capture reaches the backend, and what changed
> when this was rewritten from its ported-but-nonfunctional first pass.

Files: manifest.json, config.js, background.js, popup.html, popup.js, popup.css, onboarding.html, package.sh

## Role

A right-click-to-save tool: highlight text, a link, or an image anywhere in the
browser and attach it to a friend's profile in Communicator, without
switching tabs. Distributed as a zip (`extension/package.sh` → served by
nginx at `/downloads/communicator-extension.zip`, linked from the React
app's `/get-app` page — see [react/src/PROTO.md](../react/src/PROTO.md)),
loaded unpacked via `chrome://extensions` — not on the Chrome Web Store.

**History:** this was ported from a different project (ObsidianOptimizer)
2026-07-30, but only the API host was repointed — the actual calls
(`/login`, `/me`, `/workspace/upload`, an `/agent-ws` tool-use bridge) target
endpoints that don't exist in Communicator (no auth system, no
ingest/review-queue concept). It would have failed on every action. Rewritten
same day to call the two things Communicator's backend actually has: adding a
knowledge-base note to a friend, and uploading a file to a friend. No video
download, no auto-summarize, no agent bridge — those require backend
machinery this app doesn't have and doesn't need for its CRM use case.

## Flow

```
config.js        → apiBase (default https://communicator.work/api) + lastFriendId/Name,
                    persisted in chrome.storage.local. No auth — see Gotchas.
background.js     → all network calls (MV3 service worker; runs with host_permissions,
                    not the page's CORS/CSP)
  ├─ listFriends()      GET  {apiBase}/friend/shortList            → [{id, name}]
  ├─ saveNote(...)      POST {apiBase}/friend/addKnowledge/{id}    [{fact, importance:5}]
  └─ saveFile(...)      POST {apiBase}/fileRepository/files/upload multipart{files,friendId}

Context menu (right-click):
  "Add to <lastFriendName>"     — one click, saves selection/link/page-title to whoever was
                                   used last. Only exists once a friend has been used once.
  "Add note to a friend…"       — opens popup.html as a small chrome.windows.create popup,
                                   prefilled with the captured text (via a transient
                                   storage.local.pendingCapture handoff, cleared on read)
  "Save image" (image context)  — quick-saves to lastFriendId directly; no picker (fetches
                                   the image, converts to base64, same saveFile path)

popup.html/js      → same UI serves BOTH the toolbar default_popup AND the picker window
                      above. Friend <select> (from listFriends), note textarea, file
                      drop-zone. Writing a note or uploading a file updates lastFriendId,
                      which background.js's storage.onChanged listener uses to rebuild the
                      context menu titles.
```

To add a new capture context (e.g. right-click on a video): add a `contexts: [...]` entry
in `background.js`'s `installMenus()`, and a branch in the `contextMenus.onClicked`
listener.

## Seams

- **Outbound only, no auth.** Every call goes straight to `apiBase` (Cloudflare
  tunnel domain by default, overridable to `http://localhost:8090/api` in
  Settings for same-machine dev) — same paths the React app's
  `friendService.ts` calls. See [[communicator-delivery-model]] for why
  there's nothing to authenticate against (single-tenant, local).
- **`host_permissions`** in `manifest.json` gate which origins `fetch()` can
  hit from the background service worker: `localhost:8090`, `communicator.work`,
  `my.communicator.work`. Adding a new deploy domain means adding it here too.

## Technology Notes

- **MV3 service worker can be killed and restarted by the browser at any
  time** — `background.js` holds no meaningful in-memory state between
  events; everything that needs to survive is in `chrome.storage.local`
  (config, `lastFriendId`/`Name`). Don't add module-level mutable state here
  expecting it to persist.
- **`chrome.action.openPopup()` isn't used** — it's unreliable from a
  context-menu click across Chrome versions and unsupported in Firefox. The
  picker flow instead opens `popup.html` in a real `chrome.windows.create`
  popup window, which works identically to the toolbar popup (same file, same
  script) and is supported everywhere.
- **`browser ?? chrome`** (`config.js`'s `api` export) is the only
  cross-browser shim needed — both expose promise-based APIs under MV3, so no
  polyfill library is pulled in.
- **`activeTab` + a context-menu click together satisfy the "user gesture"
  requirement** for reading `tab.title`/`tab.url` in the `contextMenus.onClicked`
  handler — no `"tabs"` permission needed (dropped from `manifest.json` in the
  rewrite; only `"agent-ws"`-era code used `chrome.tabs.query` more broadly).
- **Icons are unbranded** (a plain purple diamond, `extension/icons/*.png`) —
  no text baked in, so they didn't need regenerating when this was rebranded
  from Obsidian Optimizer.
- **The zip is checked into git**, not generated at Docker build time —
  `nginx/Dockerfile`'s build context is `./nginx`, which can't reach
  `../extension`. Any change under `extension/` needs `extension/package.sh`
  re-run and the resulting `nginx/static/downloads/communicator-extension.zip`
  committed, or the download silently serves stale code.

## Change Index

| Thing to change | Where |
|---|---|
| Backend base URL / last-used friend | `config.js` (`DEFAULTS.apiBase`, `getConfig`/`setConfig`/`setLastFriend`) |
| What a capture calls (note vs. file, endpoint shape) | `background.js` (`saveNote`, `saveFile`, `apiFetch`) |
| Right-click menu items / contexts | `background.js` (`installMenus`, `contextMenus.onClicked` listener) |
| Popup UI (friend picker, note form, drop zone) | `popup.html`, `popup.js`, `popup.css` |
| First-run instructions | `onboarding.html` (opened once via `runtime.onInstalled`) |
| Permissions / allowed backend hosts | `manifest.json` (`permissions`, `host_permissions`) |
| Rebuild the downloadable zip | `extension/package.sh` → commit the updated `nginx/static/downloads/communicator-extension.zip` |
| Where the zip is served / linked | `nginx/nginx.conf` `/downloads/` (see [nginx/PROTO.md](../nginx/PROTO.md)), `react/src/components/pages/GetAppPage` |
