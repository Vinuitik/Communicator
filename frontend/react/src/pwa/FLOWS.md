# Offline PWA — Three-Tier Write Path + Read-Through Cache
Files: connectivity.ts, outbox.ts, driveClient.ts, db.ts, crypto.ts, offlineApi.ts,
readCache.ts, drivePull.ts, blobOutbox.ts, shareHandoff.ts, ../../public/manifest.json,
../../public/service-worker.js

Every write from a component (QuickLogModal, AddFriendPage, ProfilePage) goes through
`offlineApi.ts` → `outbox.ts`'s `submit()`, never `friendService.*` directly. Backend
counterpart: `bootstrap/.../MailboxConsumeService.java` (see `bootstrap/FLOWS.md` for the
JVM-side routing this depends on) — server FLOWS split pending, see its own doc comment for now.

This file covers both halves: the WRITE path below (submit/flush/outbox registry,
blobOutbox for binary shares) and the READ path (readCache → drivePull) further down.
Design doc: `docs/designs/offline-pwa-plan.md`.

## submit() — one write, three tiers in order
```
submit()
  → isServerReachable() [connectivity.ts: GET /api/friend/ping, 2.5s timeout]
      true  → sendDirect() → done (queued:false, viaDrive:false)
      false ↓
  → driveClient.refreshBridge() [best-effort, may fail — see keepBridgeWarm below]
  → driveClient.isAvailable() [checks the CACHED bridge in IndexedDB, not the refresh above]
      true  → driveClient.pushBatch([intent]) → done (queued:true, viaDrive:true)
      false ↓
  → db.enqueue(intent) → done (queued:true, viaDrive:false)
```
`isAvailable()` reads whatever bridge is already cached in IndexedDB's `meta` store —
independent of whether the `refreshBridge()` call two lines above just succeeded or failed.
That's the whole point of keepBridgeWarm() below: make sure something's already cached
*before* submit() ever needs it.

## The bug that was here: bridge only ever requested after the server was already down
`GET /backup/sync/bridge` (mints the Drive access token) lives in the same single monolith
container as the write endpoints (`bootstrap/FLOWS.md`'s whole point). Before the fix,
`refreshBridge()` was only ever called from inside `submit()`/`flush()`'s already-degraded
branches — i.e. only after the app already knew the server was down, at which point the
bridge-mint endpoint was down too. Net effect: Drive relay could never activate on a *cold*
outage, only on a second outage after some earlier partial blip happened to cache a token.

Fixed by `keepBridgeWarm()` (outbox.ts) — piggybacks onto `wireAutoFlush`'s existing 60s
interval (plus the `online` event, `visibilitychange`, and once immediately on load): whenever
`isServerReachable()` is true and no unexpired bridge is cached, refresh it. `To change the
warm-cadence: wireAutoFlush()'s setInterval — currently 60_000ms, shared with the flush() timer.`

## wireAutoFlush() — called once from index.tsx
```
online event         → keepBridgeWarm() + flush()
visibilitychange      → keepBridgeWarm() + flush()  (only when tab becomes visible)
setInterval(60s)      → keepBridgeWarm() + flush()
on load (immediate)   → keepBridgeWarm() + flush()
```
`flush()` drains the local IndexedDB queue only (not a Drive-cached one) — if server's up,
replays each queued intent directly one at a time; if server's still down, batches everything
into one Drive push (same `pushBatch()` as submit()'s degraded branch).

## Kind dispatch is registry-based, not a closed union + switch
`QueuedIntent['kind']` (db.ts) is a plain `string`, not `'talkedToFriend' | 'addFriend' |
'addKnowledge'` — that union + a hardcoded switch in `replayDirect()` used to be the single
highest-risk merge-conflict point: every new page's offline-write kind would force an edit
to shared `outbox.ts`. Now:
```
registerIntentHandler(kind: string, handler: (payload, {friendId, requestId}) => Promise<void>)
```
Each page module calls this once (module load) for its own kind — `outbox.ts` never imports
`meetingService`/etc. The 3 pre-existing kinds are re-registered at the bottom of `outbox.ts`
with their unchanged prior logic (was the switch's 3 cases).

`replayDirect()` looks the kind up in the registry; if nothing's registered (e.g. a
lazy-loaded page hasn't mounted this session and so hasn't called `registerIntentHandler`
yet), it throws — caught by `flush()`'s per-item `catch`, so the intent **stays queued**,
it doesn't crash the drain or get dropped. `To add a new write kind: call
registerIntentHandler(kind, handler) from that page's module — never edit outbox.ts.`

Note: `submit()`'s tier-1 direct call (the *first* attempt, before anything is queued) was
already generic — each page's `submitXxx()` passes its own `sendDirect` closure. Only the
*replay* path (flush(), used for already-queued intents) needed the registry.

## blobOutbox.ts — binary file queue (ShareLandingPage's share-target flow)
Mirrors `outbox`'s shape but can't reuse it: `crypto.ts`'s `encryptJson()` is JSON-only, a
`Blob` can't round-trip through `JSON.stringify`. Separate IndexedDB store (`blobOutbox`,
keyPath `requestId`, holds the raw `Blob` + `{friendId, requestId, queuedAt}`).
```
blobOutbox.enqueue(blob, {friendId, requestId})
  → navigator.storage.persist() [best-effort, once per session — see Technology Notes]
  → db.enqueueBlob(...)
  → db.setBlobOutboxIndex([...tracked ids, requestId])   // see eviction guard below

blobOutbox.flush()
  → for each row still in the `blobOutbox` store: friendService.uploadFriendFiles(friendId, [blob])
      success → db.removeFromBlobOutbox(requestId)  → reported in result.succeeded
      failure → left queued, retried next flush()    → reported in result.failed
  → any requestId that was TRACKED (meta store index) but missing from the `blobOutbox`
    store itself → reported in result.lost — evicted between enqueue and flush, gone for
    good. `To surface this: check flush()'s result.lost in the calling page/UI and show a
    visible re-share prompt — do not treat it the same as result.failed (which will retry).`
```
No Drive-relay tier for blobs — the mailbox/bundle Drive artifacts are JSON-only too, so a
blob that can't reach the server direct just stays queued until it can.

## readCache.ts — generic read-through cache (server → local cache → Drive-pull)
One IndexedDB store (`cache`, keyPath `cacheKey`) for every entity type, not one store per
type. `cacheKey` is an OPAQUE string the caller builds — never assumed to be a single
entity id: `'friend:42'` (single), `'friends:list'` (collection), or
`'meetings:2026-08-18..2026-08-24'` (range) are all valid, `readCache.ts` never parses them.
```
readThrough(cacheKey, fetchFn)
  → isServerReachable() [connectivity.ts]
      true  → fetchFn() → db.putCache(cacheKey, data) → return data
              (fetchFn throws → falls through, same handling as unreachable)
      false ↓
  → db.getCache(cacheKey) → hit? return cached.data
      miss ↓
  → drivePull.pullFromDrive(cacheKey) → hit? db.putCache(cacheKey, data) → return data
      miss → throw (caller catches, renders empty state)
```
`To add a new page's read: call readThrough('yourKey:...', () => yourService.fetch(...))` —
no edits to readCache.ts itself, same "callers own their kind" philosophy as the write side.

## drivePull.ts — Drive-pull read tier (fresh device / evicted storage only)
Only reached when BOTH server AND local `cache` miss. Reads the encrypted snapshot bundle
`BundleExportService` (`services/backup`, backend, scheduled job) writes to the SAME Drive
folder as the write-path mailbox (`bridge.mailboxFolderId`), different filename
(`offline-bundle.json.enc`, see `driveClient.ts`'s `pullBundle()`) so the two never collide.
```
pullFromDrive(cacheKey)
  → driveClient.refreshBridge() [best-effort]
  → driveClient.pullBundle() → Drive files.list by name+parent, then files/{id}?alt=media
      null → return undefined (miss)
  → crypto.decryptJson(bridge.encryptionKeyBase64, bytes)  [inverse of encryptJson(), same
      wire format — throws on any mismatch, caught here and treated as a miss, not a crash]
  → resolveFromBundle(bundle, cacheKey)
      'friend:42'    → entities.friends.find(r => r.id === 42).data
      'friends:list' → entities.friends.map(r => r.data)
      non-numeric id part (range keys, 'list') → whole collection — the bundle has no
        range filter, caller filters client-side
      'settings'     → entities.settings.data
```
`readCache.ts` (not `pullFromDrive` itself) is what writes the result into the `cache`
store on a hit — keeps drivePull.ts a pure "fetch + parse", no caching side effect of its
own. `To change the bundle shape: both this file's OfflineBundle interface AND
BundleExportService (services/backup) move together — see docs/designs/offline-pwa-plan.md's
T0 section for the agreed JSON shape.`

## Flow — update detection + click-to-apply (registerSW.ts)
Files: `registerSW.ts`, `../../public/service-worker.js` (`message` listener),
`components/organisms/NavigationBar/NavigationBar.tsx`, `components/pages/GetAppPage/GetAppPage.tsx`.

**A new SW version never takes over on its own.** Every version through `v4` called
`self.skipWaiting()` unconditionally in `install` — the instant a new version finished
downloading, it silently activated on EVERY open tab, mid-session, with zero user
say in it. Combined with `NavigationBar`'s `checkForUpdate()` polling on every
tab-focus, a user could get silently switched to a new version just by alt-tabbing
back. Confirmed failure mode: a tab got taken over right as an unrelated deploy had
the backend mid-restart, the newly-active SW's next navigation hit a dead origin
with nothing useful cached, and the user saw a blank white page with zero
explanation. `v5` removed the unconditional `skipWaiting()` — updates now download
and sit **waiting**, same UX contract as most real software (download in background,
apply on click).

```
registerServiceWorker() [index.tsx, on every page load]
  → navigator.serviceWorker.register(...)
  → checks registration.waiting immediately (another tab may have already
    finished a download while this tab was closed) → notify if present
  → watches registration.installing / 'updatefound' → tracks the installing
    worker's statechange → 'installed' AND navigator.serviceWorker.controller
    already exists (i.e. NOT the very first install) → onUpdateAvailable fires

NavigationBar / GetAppPage subscribe via onUpdateAvailable()
  → pulsing refresh icon / "Refresh to update" button appears
  → user clicks → applyUpdate()
      → registration.waiting.postMessage({type:'SKIP_WAITING'})
      → service-worker.js's 'message' listener → self.skipWaiting()
      → activate → clients.claim() → controllerchange fires
      → applyUpdate()'s one-time controllerchange listener → window.location.reload()
```
`To add a new update-UI surface: subscribe to onUpdateAvailable(cb), call
applyUpdate() on click — never reloadApp() for this (that's a plain unconditional
reload with no update semantics, kept for other troubleshooting call sites only).`

`checkForUpdate()` (still proactive, unchanged) only forces `registration.update()`
— re-fetches `service-worker.js` and starts a download if the bytes differ. It never
applies anything; that's still gated entirely behind a user's `applyUpdate()` click.

## Encryption — must match the server byte-for-byte
`crypto.ts`'s `encryptJson()`: gzip → AES-256-GCM (random 12B IV) → `[IV][ciphertext+tag]`.
Must exactly match `backup/.../EncryptionService.java`'s `decrypt()` — no version negotiation,
a mismatch fails silently server-side. `To change the wire format: both files move together.`

## Idempotency
Every write carries a client-generated `crypto.randomUUID()` as `requestId`, sent as
`Idempotency-Key` (direct path) or embedded in the mailbox batch (Drive path). Deliberately
*not* a content hash — see `OFFLINE_OUTBOX_HANDOFF.md`/`tasks/` for why. Ledger lives server-side
(`ConsumedWriteRequestService`), checked by both the HTTP controllers and `MailboxConsumeService`.

## Flow — share_target (OS share sheet → friend picker)
Files: `../../public/manifest.json` (`share_target`), `../../public/service-worker.js`
(`handleShareTarget()`), `shareHandoff.ts`, `components/pages/ShareLandingPage/ShareLandingPage.tsx`.

A user shares a photo/video from their phone's OS share sheet into the installed app. This is
the OS-share half of the feature — deliberately NOT a general capture inbox like
ObsidianOptimizer's `/capture` (that project POSTs straight to a backend `/api/capture/file`
from the service worker itself). Communicator has no such endpoint: a shared photo/video is
meant to land on a specific FRIEND, and only the user — via a friend-picker UI — knows which
one. So the service worker's job stops at "get the file out of the browser and into the app";
the actual upload happens later, from React, once a friend is chosen.

```
OS share sheet (image/video)
  → POST /app/share-target  (manifest.json share_target: method POST, enctype
    multipart/form-data, field name 'media')
  → service-worker.js handleShareTarget()
      - form.getAll('media') → File[] (filters out zero-byte entries)
      - writes { id, files:[{name,type,blob}], title, text, ts } into a
        DEDICATED IndexedDB: 'communicator-share-handoff' / store 'pendingShares'
        (NOT db.ts's 'communicator-offline' — kept separate on purpose, see
        Technology Notes below)
      - 303 redirect → /app/share?shared=1&shareId=<id>
  → React app boots/routes to ShareLandingPage (components/pages/ShareLandingPage,
    registered at ROUTES.SHARE = '/share' → full path /app/share, matching the
    SW's redirect target)
  → ShareLandingPage mount effect: reads `shareId` off the URL query,
    calls shareHandoff.ts's takePendingShare(shareId) ONCE
      - resolves { files, title, text, ts } and DELETES the IndexedDB record
        in the same transaction — this is a one-time hand-off, not a cache
      - null → no record (e.g. stale/reloaded link) → page shows an
        "expired or already used" empty state, no retry
  → user picks a friend (FriendPicker, variant="list" searchable — the same
    component CreateConnectionForm/MeetingEditModal use, single-select mode)
  → handleShare(): for each shared file, blobOutbox.enqueue(blob,
    {friendId, requestId: crypto.randomUUID()}) → one immediate best-effort
    blobOutbox.flush() (offline/failure just leaves it queued for
    wireAutoFlush's next trigger, same as any other offline write) → toast +
    navigate(ROUTES.HOME)
```
`wireAutoFlush()` (outbox.ts, called once from index.tsx) now also drains
`blobOutbox` on every trigger (online/visibilitychange/60s interval/immediate) —
without this, a share queued while offline would never retry, since
ShareLandingPage has already navigated away by the time connectivity returns.

**The hand-off contract** (what the ShareLandingPage lane needs to know):
- DB name: `communicator-share-handoff`, version `1`, object store `pendingShares`, `keyPath: 'id'`.
- Record shape: `{ id: string, files: {name:string, type:string, blob:Blob}[], title:string, text:string, ts:number }`.
- Read API: `shareHandoff.ts`'s `takePendingShare(id): Promise<PendingShare | null>` — call it exactly
  once per `shareId`; it deletes the record as it reads it.
- The SW's `handleShareTarget()` duplicates this schema inline (own `openShareHandoffDB`/
  `putPendingShare`) since it's a plain file with no build step and can't import `shareHandoff.ts`.
  **Bump both files' DB version together** if the schema ever changes — mirrors how
  `public/sw.js`'s `openDB()` in ObsidianOptimizer must stay in sync with its `db.js`.

**Testing:** `shareHandoff.test.ts` unit-tests `buildPendingShare()` (the pure FormData→record
logic — no IndexedDB, this repo has no `fake-indexeddb` dependency and jsdom has no native
IndexedDB, so the actual `takePendingShare`/SW `putPendingShare` round trip isn't unit-testable
here; same gap exists for `db.ts`/`outbox.ts` already). Manual/integration verification of the
full round trip:
1. `npm run build` the React app, serve it over HTTPS or `localhost` (SW requires a secure
   context) so the service worker registers.
2. Chrome DevTools → Application panel → Manifest → confirm a "Share Target" section appears
   under `share_target`, with a **Test** button (chrome://inspect and recent Chrome/Edge expose
   this without needing an actual OS share). Pick an image/video file and submit — it drives a
   real POST to `/app/share-target` through the installed SW.
3. Alternative without the DevTools button — open the installed app, then in its console:
   ```js
   const fd = new FormData();
   fd.append('media', new File(['x'], 'test.jpg', { type: 'image/jpeg' }));
   fd.append('title', 'test share');
   fetch('/app/share-target', { method: 'POST', body: fd });
   ```
   Confirm: (a) the response redirects to `/app/share?shared=1&shareId=...`, (b) DevTools →
   Application → IndexedDB → `communicator-share-handoff` → `pendingShares` shows the record
   until ShareLandingPage consumes it, (c) after ShareLandingPage mounts, the record is gone.
4. On an actual Android phone with the PWA installed: share a photo from the OS Photos app →
   "Communicator" should appear in the share sheet (needs `share_target` + the app installed,
   not just bookmarked) → confirm it lands on the friend picker with the photo attached.

## Technology Notes
- **IndexedDB persistence is now PARTIAL, not absent.** `blobOutbox.enqueue()` calls
  `navigator.storage.persist()` on first use each session — reduces eviction risk for
  queued *file shares* specifically. The JSON `outbox` store (talkedToFriend/addFriend/etc.)
  still has NO persist() call — queued-but-unflushed JSON writes can still be evicted
  silently under storage pressure. Not fixed in this pass; if it needs the same guard, call
  `navigator.storage.persist()` from `outbox.ts`'s `enqueue()` path too (it's idempotent to
  call from both places).
- **blobOutbox eviction detection is best-effort, not complete.** The `meta`-store tracked
  index (`getBlobOutboxIndex`/`setBlobOutboxIndex` in db.ts) lets `flush()` notice "a
  tracked id's row vanished from the `blobOutbox` store" (partial eviction) and report it
  as `lost` rather than silently returning nothing. It does NOT protect against a full
  origin wipe — the index lives in the same IndexedDB database and would vanish too.
  `persist()` above is the actual defense against that case, not this index.
- **`MEDIA_CACHE` (service-worker.js) has no eviction — confirmed root cause of a real
  outage.** Friend photos/videos are cached-first, forever, with no size cap or LRU
  pruning. A live user hit `caches.open()` throwing (almost certainly quota exceeded)
  inside `handleNavigate()`, and — because that call sat OUTSIDE the function's
  try/catch — the whole `/app/` navigation failed with Chrome's generic "ServiceWorker
  intercepted the request and encountered an unexpected error," which also explains
  why `beforeinstallprompt` never fires for them (Chrome won't consider a site
  installable if its own SW errors on the start_url). Fixed defensively in `v3`:
  `handleNavigate()`'s entire body is now try/caught, any Cache Storage failure falls
  back to a live network fetch or a minimal inline offline page instead of an unhandled
  rejection, and every branch `console.error`/`console.warn`s so this is diagnosable
  from DevTools instead of a mystery. **This does NOT fix the underlying quota growth**
  — `MEDIA_CACHE` still has no cap. See TODOS.md.
- **`readCache.ts`'s Drive-pull tier is the oldest data you'll ever render** — the bundle is
  only as fresh as `BundleExportService`'s last scheduled run (backend, services/backup),
  not the live server state. No staleness UI ships with this pass (T4b in the design doc is
  the follow-up) — a Drive-pull hit currently looks identical to a fresh server hit to the
  caller.
- **Drive bridge token is short-lived** (`EXPIRY_SAFETY_MARGIN_MS = 60_000` safety margin in
  `driveClient.ts`) — `keepBridgeWarm()` only refreshes when the cached one is within that
  margin of expiring or absent, so it's a cheap check most ticks, not a refresh every 60s.
  `drivePull.ts`'s `pullFromDrive()` also calls `refreshBridge()` itself (best-effort) since
  it can be reached on a cold start where `keepBridgeWarm()` never got a chance to run.
- **No proactive retry backoff** — `flush()`'s failures (both `outbox.ts` and
  `blobOutbox.ts`) just leave items queued for the next timer tick (60s) or the next
  `online`/visibility trigger; no exponential backoff.
- **`readThrough()`'s server-tier failure handling is a deliberate addition beyond the
  original spec**: if `isServerReachable()` says true but `fetchFn()` itself throws (a
  transient 5xx, say), it falls through to cache/Drive rather than rejecting — mirrors
  `outbox.ts`'s `submit()` treating a failed direct call the same as an unreachable server.
- **Share hand-off uses its own IndexedDB, deliberately not `db.ts`'s `communicator-offline`.**
  Sharing a version/schema with the outbox/cache/blobOutbox stores would mean this lane's DB
  writes and the pwa-foundation lane's `DB_VERSION` bumps could collide in the same
  `onupgradeneeded` transaction — a real merge-conflict risk across parallel worktrees. Kept
  separate (`communicator-share-handoff`, own version counter) so the two lanes never need to
  coordinate schema changes.
- **The share-target record is a one-time hand-off, not a cache.** `takePendingShare()` deletes
  as it reads. If ShareLandingPage never mounts (user backgrounds the share, browser killed,
  etc.) the record is simply orphaned in IndexedDB forever — there's no TTL/sweep. Low-stakes
  (a few KB of blob per abandoned share) but worth knowing if this ever needs a cleanup job.
- **Multi-file share works, but ShareLandingPage decides what to do with >1 file** — the manifest
  declares a single `files` param entry but the browser can still attach multiple files to one
  `media` field on a multi-select share; `buildPendingShare`/`handleShareTarget` collect all of
  them into `files: [...]`, not just the first.

## Change Index
| Want to change… | Where |
|---|---|
| A write's tier-fallback order | `outbox.ts`'s `submit()` |
| How often the Drive token is kept warm | `wireAutoFlush()`'s `setInterval` (outbox.ts) |
| The local-queue drain logic | `outbox.ts`'s `flush()` / `replayDirect()` |
| Add a new offline-write kind | `registerIntentHandler(kind, handler)` — call from the owning page module, never edit outbox.ts |
| Encryption wire format (write) | `crypto.ts`'s `encryptJson()` (must move with `EncryptionService.java`) |
| Decryption wire format (read) | `crypto.ts`'s `decryptJson()` — same wire format, inverse direction |
| Reachability probe / timeout | `connectivity.ts`'s `isServerReachable(timeoutMs)` |
| IndexedDB schema | `db.ts`'s `openDB()` (bump `DB_VERSION` on any store change) |
| Navigate-fetch fallback chain (network → shell cache → offline page) | `service-worker.js`'s `handleNavigate()` — bump `VERSION` after any change |
| SW diagnostic logging | `service-worker.js`'s `console.error`/`console.warn` calls in `handleNavigate()` |
| Add a new page's cached read | `readCache.ts`'s `readThrough(cacheKey, fetchFn)` — call from the owning page, pick a cacheKey convention |
| Cache tier order (server/local/Drive) | `readCache.ts`'s `readThrough()` |
| Drive bundle filename / folder | `driveClient.ts`'s `BUNDLE_FILE_NAME` / `pullBundle()` |
| Drive bundle JSON shape / cacheKey→entity mapping | `drivePull.ts`'s `OfflineBundle` interface + `resolveFromBundle()`; backend counterpart `BundleExportService` (services/bootstrap) |
| Queue a binary file for the share-target flow | `blobOutbox.ts`'s `enqueue(blob, {friendId, requestId})` |
| Binary upload replay logic | `blobOutbox.ts`'s `flush()` (uses `friendService.uploadFriendFiles`) |
| Eviction-loss detection for queued blobs | `blobOutbox.ts`'s `flush()`'s `lost` array + `db.ts`'s `getBlobOutboxIndex`/`setBlobOutboxIndex` |
| Storage-eviction risk reduction | `blobOutbox.ts`'s `requestPersistence()` (`navigator.storage.persist()`) |
| Share-target manifest entry (action/method/accept types) | `../../public/manifest.json` `share_target` |
| Share-target SW handler (extract file, redirect) | `../../public/service-worker.js` `handleShareTarget()`, field name `'media'` must match manifest |
| Share hand-off DB schema (SW side, no build step) | `../../public/service-worker.js` `openShareHandoffDB()`/`putPendingShare()` — mirrors `shareHandoff.ts`, bump both together |
| Share hand-off read/consume (React side) | `shareHandoff.ts`'s `takePendingShare(id)` |
| Share hand-off record shape (pure builder, unit-tested) | `shareHandoff.ts`'s `buildPendingShare(form, id)` |
| SW cache-bust after any SW logic change | `../../public/service-worker.js` `VERSION` const |
| Share landing page UI / friend-picker step | `components/pages/ShareLandingPage/ShareLandingPage.tsx` |
| blobOutbox drained on reconnect/focus/interval | `outbox.ts`'s `wireAutoFlush()` (calls `blobOutbox.flush()` alongside the JSON outbox's `flush()`) |
| Whether a new SW auto-activates or waits for a click | `service-worker.js`'s `install` handler (no `self.skipWaiting()`) + `message` listener |
| Apply a waiting update (user-click only, never proactive) | `registerSW.ts`'s `applyUpdate()` |
| Update-available detection | `registerSW.ts`'s `watchForWaitingWorker()` / `registerServiceWorker()`'s `updatefound` handling |
| Update-check polling (download only, doesn't apply) | `NavigationBar.tsx`'s `visibilitychange` → `checkForUpdate()` |
