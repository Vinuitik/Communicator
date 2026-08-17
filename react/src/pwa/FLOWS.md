# Offline Outbox — Three-Tier Write Path
Files: connectivity.ts, outbox.ts, driveClient.ts, db.ts, crypto.ts, offlineApi.ts

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

## Technology Notes
- **IndexedDB, no `navigator.storage.persist()`** — the browser can evict `communicator-offline`
  under storage pressure like any other site data; queued-but-unflushed writes would be lost
  silently. Not currently guarded against.
- **Drive bridge token is short-lived** (`EXPIRY_SAFETY_MARGIN_MS = 60_000` safety margin in
  `driveClient.ts`) — `keepBridgeWarm()` only refreshes when the cached one is within that
  margin of expiring or absent, so it's a cheap check most ticks, not a refresh every 60s.
- **No proactive retry backoff** — `flush()`'s failures just leave items queued for the next
  timer tick (60s) or the next `online`/visibility trigger; no exponential backoff.

## Change Index
| Want to change… | Where |
|---|---|
| A write's tier-fallback order | `outbox.ts`'s `submit()` |
| How often the Drive token is kept warm | `wireAutoFlush()`'s `setInterval` (outbox.ts) |
| The local-queue drain logic | `outbox.ts`'s `flush()` / `replayDirect()` |
| Encryption wire format | `crypto.ts` (must move with `EncryptionService.java`) |
| Reachability probe / timeout | `connectivity.ts`'s `isServerReachable(timeoutMs)` |
| IndexedDB schema | `db.ts`'s `openDB()` (bump `DB_VERSION` on any store change) |
