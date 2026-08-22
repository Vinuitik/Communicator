# Offline Outbox — Three-Tier Write Path
Files: connectivity.ts, outbox.ts, driveClient.ts, db.ts, crypto.ts, offlineApi.ts, shareHandoff.ts, ../../public/manifest.json, ../../public/service-worker.js

Every write from a component (QuickLogModal, AddFriendPage, ProfilePage) goes through
`offlineApi.ts` → `outbox.ts`'s `submit()`, never `friendService.*` directly. Backend
counterpart: `bootstrap/.../MailboxConsumeService.java` (see `bootstrap/FLOWS.md` for the
JVM-side routing this depends on) — server FLOWS split pending, see its own doc comment for now.

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
(`handleShareTarget()`), `shareHandoff.ts`, `components/pages/ShareLandingPage` (owned by a
different lane — not covered here, see its own FLOWS entry once that PR lands).

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
  → React app boots/routes to ShareLandingPage (registers ROUTES.SHARE = '/share'
    → full path /app/share, matching the SW's redirect target — that route
    registration belongs to the ShareLandingPage lane, not this one)
  → ShareLandingPage mount effect: reads `shareId` off the URL query,
    calls shareHandoff.ts's takePendingShare(shareId) ONCE
      - resolves { files, title, text, ts } and DELETES the IndexedDB record
        in the same transaction — this is a one-time hand-off, not a cache
      - null → no record (e.g. stale/reloaded link) → page should show an
        empty/error state, not retry
  → user picks a friend (FriendPicker, built by a different lane)
  → ShareLandingPage hands the file(s) to blobOutbox for the actual upload
    (blobOutbox is pwa-foundation's binary queue — out of scope here)
```

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
- **IndexedDB, no `navigator.storage.persist()`** — the browser can evict `communicator-offline`
  under storage pressure like any other site data; queued-but-unflushed writes would be lost
  silently. Not currently guarded against.
- **Drive bridge token is short-lived** (`EXPIRY_SAFETY_MARGIN_MS = 60_000` safety margin in
  `driveClient.ts`) — `keepBridgeWarm()` only refreshes when the cached one is within that
  margin of expiring or absent, so it's a cheap check most ticks, not a refresh every 60s.
- **No proactive retry backoff** — `flush()`'s failures just leave items queued for the next
  timer tick (60s) or the next `online`/visibility trigger; no exponential backoff.
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
| Encryption wire format | `crypto.ts` (must move with `EncryptionService.java`) |
| Reachability probe / timeout | `connectivity.ts`'s `isServerReachable(timeoutMs)` |
| IndexedDB schema | `db.ts`'s `openDB()` (bump `DB_VERSION` on any store change) |
| Share-target manifest entry (action/method/accept types) | `../../public/manifest.json` `share_target` |
| Share-target SW handler (extract file, redirect) | `../../public/service-worker.js` `handleShareTarget()`, field name `'media'` must match manifest |
| Share hand-off DB schema (SW side, no build step) | `../../public/service-worker.js` `openShareHandoffDB()`/`putPendingShare()` — mirrors `shareHandoff.ts`, bump both together |
| Share hand-off read/consume (React side) | `shareHandoff.ts`'s `takePendingShare(id)` |
| Share hand-off record shape (pure builder, unit-tested) | `shareHandoff.ts`'s `buildPendingShare(form, id)` |
| SW cache-bust after any SW logic change | `../../public/service-worker.js` `VERSION` const |
