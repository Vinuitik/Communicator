# Offline PWA — Three-Tier Write Path + Read-Through Cache
Files: connectivity.ts, outbox.ts, driveClient.ts, db.ts, crypto.ts, offlineApi.ts,
readCache.ts, drivePull.ts, blobOutbox.ts

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

## Encryption — must match the server byte-for-byte
`crypto.ts`'s `encryptJson()`: gzip → AES-256-GCM (random 12B IV) → `[IV][ciphertext+tag]`.
Must exactly match `backup/.../EncryptionService.java`'s `decrypt()` — no version negotiation,
a mismatch fails silently server-side. `To change the wire format: both files move together.`

## Idempotency
Every write carries a client-generated `crypto.randomUUID()` as `requestId`, sent as
`Idempotency-Key` (direct path) or embedded in the mailbox batch (Drive path). Deliberately
*not* a content hash — see `OFFLINE_OUTBOX_HANDOFF.md`/`tasks/` for why. Ledger lives server-side
(`ConsumedWriteRequestService`), checked by both the HTTP controllers and `MailboxConsumeService`.

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
| Add a new page's cached read | `readCache.ts`'s `readThrough(cacheKey, fetchFn)` — call from the owning page, pick a cacheKey convention |
| Cache tier order (server/local/Drive) | `readCache.ts`'s `readThrough()` |
| Drive bundle filename / folder | `driveClient.ts`'s `BUNDLE_FILE_NAME` / `pullBundle()` |
| Drive bundle JSON shape / cacheKey→entity mapping | `drivePull.ts`'s `OfflineBundle` interface + `resolveFromBundle()`; backend counterpart `BundleExportService` (services/backup) |
| Queue a binary file for the share-target flow | `blobOutbox.ts`'s `enqueue(blob, {friendId, requestId})` |
| Binary upload replay logic | `blobOutbox.ts`'s `flush()` (uses `friendService.uploadFriendFiles`) |
| Eviction-loss detection for queued blobs | `blobOutbox.ts`'s `flush()`'s `lost` array + `db.ts`'s `getBlobOutboxIndex`/`setBlobOutboxIndex` |
| Storage-eviction risk reduction | `blobOutbox.ts`'s `requestPersistence()` (`navigator.storage.persist()`) |
