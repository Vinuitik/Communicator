# Offline Write Sync Engine — Research

**RESEARCH ONLY — nothing here is implemented in Communicator yet.**

This file exists because Communicator's PWA currently has zero offline-write capability:
`react/public/service-worker.js` caches the app shell and friend media (read-only), but its own
header comment says it plainly — *"No offline writes/outbox — Communicator has no queued-write
concept... A capture that happens while offline just fails; retry once back online."* The user
wants that closed: logging an interaction, adding a friend, etc. should queue locally (encrypted)
while offline/unreachable and flush once connectivity returns. Two sister projects already built
this twice, in two different shapes — **habitTracker** (Spring Boot + vanilla JS, no build step)
and **ObsidianOptimizer** (Spring Boot + React/Vite) — so this session ports their design
knowledge into a written plan, without touching any Communicator code. Implementation is a future
session.

---

## Source 1 — habitTracker

`/home/victor/Desktop/habitTracker/habitTracker`. Two upsert-safe writes only: mark a habit
done/undone for a date, set a KPI value for a date. Both idempotent by `(id, date)`, which is
what makes the whole design safe to replay from three different paths.

Files: `db.js`, `crypto.js`, `connectivity.js`, `driveClient.js`, `outbox.js` (client, under
`src/main/resources/static/js/offline/`), `VaultEncryptionService.java`, `SyncController.java`,
`MailboxConsumeService.java`, `DriveOAuthService.java`, `DriveService.java`, `UserSyncSettings*`,
`ConsumedSyncRequest*` (server, under `src/main/java/habitTracker/sync/`).

### `connectivity.js` — the reachability probe

```js
async function isServerReachable(timeoutMs = 2500) {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch('/api/ping', { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    return resp.ok;
  } catch (e) { return false; }
}
```

`navigator.onLine` is used only as a cheap short-circuit — it is **never** trusted alone. The real
signal is a short-timeout `fetch` against a cheap, unauthenticated `GET /api/ping`. Critically,
`resp.ok` is checked, not just "did fetch throw" — behind their Cloudflare tunnel, "origin down"
answers with a real **HTTP 530** (a resolved Response, not a thrown error), so a naive
try/catch-only check would think the server is up when it isn't.

### `outbox.js` — the three-tier dispatcher

```
submit(intent):
  Connectivity.isServerReachable()
    → true  → sendDirect(intent)                 // same endpoints the app always used
    → false → DriveClient.refreshBridge() → DriveClient.isAvailable()?
              → true  → DriveClient.pushBatch([intent])   // encrypted into user's own Drive
              → false → OfflineDB.enqueue(intent)          // pure local IndexedDB queue
```

Every intent carries a client-generated `requestId` (`crypto.randomUUID()`). `submit()` always
"succeeds" from the caller's perspective (worst case: locally queued) — only a genuinely thrown
exception (a real bug) should trigger a UI revert; a non-200 network response does not.
`flush()` (drains the local queue) runs the identical branch logic but batches everything queued
into **one** Drive push instead of one file per intent, and is wired to `window.load`, `online`,
`visibilitychange`, and a 5-minute `setInterval`.

```js
function submitHabitComplete(habitId, completed, date) {
  return submit({
    requestId: crypto.randomUUID(), kind: 'habit-complete', ts: Date.now(),
    payload: { habitId: Number(habitId), completed: !!completed, date: date || null },
  });
}
```

### `db.js` — IndexedDB schema

```
habittracker-offline (v1)
  outbox — keyPath 'requestId'  — queued intents not yet sent anywhere
  meta   — keyPath 'key'        — { deviceId, driveBridge }
```

Minimal hand-rolled wrapper (`open()`, `tx()`), no library. `enqueue`/`remove`/`all`/`count` on
`outbox`; `setMeta`/`getMeta` on `meta`.

### `crypto.js` / `VaultEncryptionService.java` — the encryption scheme

**Confirmed: AES-256-GCM, wire format `[12B IV][ciphertext + 16B GCM tag]`, no KDF.** The key is
a real random 256-bit AES key (`KeyGenerator.getInstance("AES").init(256)`), generated **once
server-side per user** at Drive-connect time and handed to the browser through the bridge token
(never derived from a human passphrase — there's no memorized secret in this design). No gzip.

Client (`crypto.js`):
```js
async function encryptJson(base64Key, obj) {
  const key = await importKey(base64Key);           // crypto.subtle.importKey('raw', ..., 'AES-GCM')
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return concat(iv, ciphertext);                      // [12B IV][ct+tag]
}
```
Server (`VaultEncryptionService.java`):
```java
public byte[] encrypt(String base64Key, byte[] plaintext) {
    byte[] iv = new byte[12]; RANDOM.nextBytes(iv);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, keyFrom(base64Key), new GCMParameterSpec(128, iv));
    // wire = iv + ciphertext(+tag)
}
```
Byte-for-byte compatible: FLOWS.md is explicit that any change to the Java wire format must be
mirrored in `crypto.js` exactly or "decryption breaks silently" — there is no version negotiation.

### The Drive-bridge — why the browser never holds a refresh token

`GET /api/sync/status` (`SyncController.status()`) mints a **fresh short-lived Drive access
token** on every call (`DriveService.getAccessTokenWithExpiry`) and returns it plus
`mailboxFolderId` + `encryptionKey`. This bundle is cached in IndexedDB `meta.driveBridge`. It is
the **only** Drive credential the browser ever holds — the durable OAuth refresh token and client
secret stay server-side in `UserSyncSettings`, never transmitted to the phone. `isAvailable()`
just checks the cached expiry with a 60s safety margin
(`driveClient.js EXPIRY_SAFETY_MARGIN_MS`). Practical consequence: direct-to-Drive pushes only
work for roughly an hour after the app last successfully reached the server — beyond that, writes
fall to the local-only queue (safe, just delayed).

Why this shape exists at all (from `sync/FLOWS.md`): *"This sidesteps the open question of
whether a raw refresh_token grant works cross-origin from a browser at all — there is simply no
token-endpoint call from the browser, ever."*

### Server-side drain — `MailboxConsumeService`

```
consumeAll() — @PostConstruct + @Scheduled(every 15 min):
  for each UserSyncSettings row:
    listFiles(mailboxFolderId) → for each file:
      decrypt(own key) → MailboxBatch{deviceId, requests[]}
      per request: ConsumedSyncRequestRepository.existsById(requestId) → skip if already applied
                   dispatch by kind → StructureService.updateHabitCompletionForUser(...) /
                                       KPIService.addKPIDataForUser(...)
                   on success → save to consumed_sync_requests (idempotency ledger)
      ALL requests committed → deleteFile()  — else left for next pass
```

Delete-after-success is the correctness hinge — a file is removed only once *every* request
inside it committed; a partial failure leaves it for the next 15-minute pass, safe because
`requestId`-keyed dedup makes re-consuming a no-op. **`...ForUser(userId, ...)` overloads exist
specifically because this runs on a background scheduled thread with no HTTP `SecurityContext`**
— the normal service methods call `SecurityUtils.getCurrentUserId()` internally, which returns
`null` off-thread and would silently corrupt data or 404 every replayed write.

### Gotchas (verbatim from habitTracker's own FLOWS.md, dated 2026-08-15)

- **v5 bug**: `SHELL_URLS` (the SW's precache list) was missing all six offline-pipeline scripts
  (`db.js`, `crypto.js`, `connectivity.js`, `driveClient.js`, `outbox.js`, `registerSW.js`) — on
  an origin-down test, `Outbox` never loaded and any write attempt **threw** instead of queuing.
  Lesson: every new `offline/*.js` module must be added to the SW precache list in the same
  commit, or offline mode silently loses the entire write path.
- **v6 bug**: the SW cached top-level pages under their static filename (`/habit-table.html`) but
  the browser's navigation request is always the route (`/habits/table`) — `cache.match(request)`
  never matched, so switching pages while offline always silently landed back on the default page
  regardless of which page was tapped. Fixed by precaching under the actual `@GetMapping` route,
  not the filename.
- **Auth 530-vs-401 gate**: `topbar.js checkAuth()` used to redirect to `/login` on *any* non-ok
  response — a tunnel-down 530 sent every page to a login screen the SW never caches, i.e. a raw
  blank error page. Fixed to redirect only on a real `401`/`403`; any other non-ok status keeps
  the session and renders from cache. This is the single most important lesson in the whole
  research pass and recurs identically in ObsidianOptimizer (see below).
- **No offline auth verification**: the session cookie either works or a direct write gets a
  401 (falls through to Drive/queue like any other failure) — there's no persisted "was I logged
  in" flag; a session that expired while offline just means direct sends keep failing until a
  real re-login happens online.
- **No key-rotation path**: rotating a user's encryption key would orphan any already-queued
  Drive files encrypted under the old key — explicitly "not implemented; would need a migration
  path if this becomes necessary."
- **Permanently-failing request loops forever**: if a request in a mailbox file throws every pass
  (e.g. the target row was deleted between queueing and replay), that file is never deleted and
  retries every 15 minutes indefinitely — fine at personal-project scale, flagged as needing a
  retry-cap/dead-letter if it becomes noisy.
- **`navigator.onLine` lies, `fetch()` not throwing lies too** — both signals apps naturally trust
  can be simultaneously "everything's fine" while the origin is actually dead behind a tunnel.

---

## Source 2 — ObsidianOptimizer

`/home/victor/Desktop/ObidianOptimizer`. Substantially larger surface than habitTracker: an
outbox covering *seven* write kinds (grade, capture, captureText, assignment, file, discard,
acknowledge), a passphrase-derived (not server-random) encryption key, and — beyond what the
earlier install/update research pass covered — a **Drive-link mode** where the installed PWA goes
fully server-independent by holding the OAuth client secret + refresh token client-side.

Files (frontend, `frontend/src/pwa/`): `db.js`, `crypto.js`, `connectivity.js`, `outbox.js`,
`offlineApi.js`, `mailbox.js`, `drive.js`, `setup.js`, `drivePull.js`, `autoSync.js`,
`syncOffline.js`, `warmMedia.js`, `FLOWS.md`. Files (backend,
`obsidian_optimizer/obsidian/src/main/java/com/obsidian/obsidian/`): `sync/VaultEncryptionService.java`,
`pwa/PwaController.java`, `pwa/OfflineExportService.java`, `pwa/MailboxConsumeService.java`,
`pwa/ConsumedEventRepository.java`, `pwa/FLOWS.md`. Root: `OFFLINE_FIXES_PORTING.md`,
`architecture_plans/PWA_MOBILE_ARCH.md`.

### `crypto.js` / `VaultEncryptionService.java` — a *different* encryption scheme than habitTracker

**Confirmed: AES-256-GCM, wire format `[12B IV][ciphertext + 16B tag]`, but WITH a KDF** — the
key is derived from a **human-memorized passphrase**, not a random server-generated key:

```
key    = PBKDF2-HMAC-SHA256(passphrase, salt="ObsidianSyncSalt", 310_000 iterations) → 256-bit AES
cipher = AES-256-GCM, 12B IV, 128-bit tag
plain  = gzip'd BEFORE encryption (habitTracker does not gzip)
wire   = [12B IV][GCM ciphertext + 16B tag]
```

Client (`crypto.js`):
```js
export async function deriveKey(passphrase) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 310_000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(key, plainBytes) {
  const compressed = await gzip(plainBytes);   // CompressionStream('gzip') — native WebCrypto-adjacent API
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, compressed);
  return concat(iv, ct);
}
```
Server (`VaultEncryptionService.java`):
```java
private static final byte[] PBKDF2_SALT = "ObsidianSyncSalt".getBytes(UTF_8); // FIXED salt
private static final int PBKDF2_ITERATIONS = 310_000;
KeySpec spec = new PBEKeySpec(effective.toCharArray(), PBKDF2_SALT, PBKDF2_ITERATIONS, 256);
key = new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES");
// encrypt(): gzip(plaintext) → AES/GCM/NoPadding → [iv][ciphertext]
```
**Explicit design note in the Java file itself**: *"Fixed salt — all devices with the same
passphrase derive the same AES key. Acceptable for a personal sync tool; change the passphrase to
rotate."* — i.e. key rotation here just means changing the passphrase (unlike habitTracker where
rotation is unimplemented). The passphrase itself lives in `SettingsRepository` (server-side,
UI-editable) with an env-var fallback (`sync.passphrase`).

**This is the key finding to reconcile with habitTracker before implementing anything**:
habitTracker's design generates a random key server-side and only ever exposes a short-lived
*access-token bridge*, never the raw key/secret, to the browser. ObsidianOptimizer's Drive-link
mode instead hands the phone the **raw OAuth client secret, refresh token, and vault passphrase**
in cleartext, once, over a session-authed endpoint (`PwaController.setup()`), after which the
phone is permanently self-sufficient. The Java doc-comment for that endpoint is unusually candid
about the tradeoff:

> "SECURITY: this returns the OAuth client secret, refresh token, and vault passphrase in clear.
> That is the whole point (the phone must decrypt the vault and refresh its own token) and it is
> the same trust level as the plaintext vault on the laptop — but it is why the endpoint is
> session-gated and only ever called on a device you control."

### `outbox.js` — seven write kinds, per-kind replay logic

```js
export function enqueueGrade(notePath, band)              { return addToOutbox({ kind: 'grade', notePath, band, eventId: newId() }); }
export function enqueueCapture(url)                        { return addToOutbox({ kind: 'capture', url, eventId: newId() }); }
export function enqueueCaptureText(text, title)             { return addToOutbox({ kind: 'captureText', text, title, eventId: newId() }); }
export function enqueueAssignment(assignmentId, notePath, answers) { ... }
export function enqueueFile(path, targetFolder, content)    { ... }
export function enqueueDiscard(path)                        { ... }
export function enqueueAcknowledge(captureId)                { ... }
```

`eventId` (`crypto.randomUUID()`) is the idempotency key, dedup'd server-side against
`consumed_events`. `flush()` iterates the whole outbox, dispatches each item to its own endpoint
(`grade` → `gradeNote()`; `capture`/`captureText` → `POST /api/capture`; `captureFile` → multipart
`POST /api/capture/file`, this one queued by the **service worker itself** when a file share
happens offline), deletes on success, leaves failures queued. **Note**: `outbox.flush()` always
sends server-direct — the Drive mailbox path is a *separate* function (`mailbox.js pushMailbox()`)
that a caller must invoke explicitly; they are not the same call.

### `mailbox.js` — the Drive-bridge equivalent, but push-only and pull-your-own-creds

```js
export async function pushMailbox() {
  const creds = await getCreds();                       // from IndexedDB, set once by linkDevice()
  if (!creds?.driveFolderId) return { pushed: 0 };
  const KINDS = new Set(['grade', 'assignment', 'file', 'discard', 'acknowledge']); // NOT capture/captureText
  const sendable = (await getOutbox()).filter(e => KINDS.has(e.kind));
  const token = await getAccessToken(creds);              // browser refreshes its OWN token, no server bridge call
  const folderId = await findOrCreateFolder(token, '_mailbox', creds.driveFolderId);
  const key = await deriveKey(creds.passphrase);
  const enc = await encryptText(key, JSON.stringify({ deviceId: creds.deviceId, events: sendable.map(...) }));
  const name = `${creds.deviceId}-${Date.now()}-${seq}.enc`;  // name sorts by ts → server replays in order
  await driveCreateFile(token, { name, parents: [folderId], appProperties: { device_id } }, enc);
  for (const e of sendable) await deleteFromOutbox(e.id);
}
```

Two write kinds (`capture`, `captureText`) are **deliberately excluded** from the Drive mailbox —
per `pwa/FLOWS.md`: *"ingestion needs the server/embedder anyway — no Drive mailbox is
warranted."* Not every offline-capable write needs a Drive path; some genuinely require the
origin server regardless, and for those the outbox just waits for reconnect.

`drive.js` is a from-scratch Drive v3 REST client the *browser* runs directly (list/download/
upload/find-or-create-folder), authenticating itself against `oauth2.googleapis.com` with the
credentials handed down by `setup.js linkDevice()`. This is structurally different from
habitTracker's `driveClient.js`, which never calls the Google token endpoint from the browser at
all.

### `offlineApi.js` — the drop-in read/write seam + the `isServerUnreachable` predicate

This is the module every component actually calls (`fetchReviewOffline`, `gradeNoteOffline`,
`captureUrl`, etc.) — a facade over network vs. IndexedDB vs. outbox so leaf components never
branch on connectivity themselves. Its single most important piece of logic, called out
explicitly as *"THE big one"* in `OFFLINE_FIXES_PORTING.md`, is the unreachability predicate:

```js
function isServerUnreachable(e) {
  if (e instanceof TypeError) return true;                 // fetch itself threw — truly offline
  if (e instanceof ApiError)
    return e.status === 530 || [500, 502, 503, 504].includes(e.status); // origin answered but broken
  return false;                                             // 401/403/other 4xx = real error → rethrow
}
```

The documented bug this fixes: an earlier version only checked `instanceof TypeError`, so a 530
(a resolved `ApiError`, not a thrown `TypeError`) was **re-thrown instead of falling through to
the IndexedDB/outbox fallback** — reads crashed, writes errored, instead of degrading gracefully.
This predicate must be applied at *every* network→cache and network→outbox fallback site
consistently, both reads and writes — a partial application (fixing reads but not writes, or vice
versa) reproduces the bug in the unfixed half.

Grade write logic, showing the "401 is real, everything else queues" split:
```js
export async function gradeNoteOffline(notePath, band) {
  if (driveMode) { await enqueueGrade(notePath, band); return { queued: true }; }
  if (isOnline()) {
    try { return await netGradeNote(notePath, band); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) throw e; // let UI prompt login — do NOT queue
      // any other failure → fall through to queue
    }
  }
  await enqueueGrade(notePath, band);
  return { notePath, band, queued: true, due: null };
}
```

### `db.js` — IndexedDB schema (v2, mirrored in the service worker)

```
obsopt-offline (v2)
  reviewNotes  keyPath 'path'     — { path, shortName, content, media, srDue }
  assignments  keyPath 'notePath' — prebuilt offline flashcard tests
  outbox       autoIncrement 'id' — { id, kind, ...payload, eventId, ts }
  meta         keyPath 'key'      — { key, value }  (lastSync, driveCreds, inboxItems, reviewCaps, doneDate)
```

Explicitly flagged as a duplication risk: *"The SW duplicates the IDB outbox schema (it writes
captures while a client may be closed). `public/sw.js openDB()` MUST stay in sync with `db.js` —
bump both together."* — a real, named failure mode of writing IndexedDB access from two separate
JS contexts (page + service worker) that don't share module state.

### Server side — `PwaController`, `OfflineExportService`, `MailboxConsumeService`

Three-part split, distinct from habitTracker's single `SyncController`:
1. **`GET /api/pwa/setup`** — one-time credential handout (409 if Drive isn't connected or the
   passphrase is unset server-side; also 409 while the Drive folder id is still blank, so a phone
   can never cache an unusable link).
2. **`OfflineExportService`** — writes three singleton `_offline/*.enc` files (review bundle,
   cards, inbox) on `ApplicationReadyEvent`, a nightly cron (`offline.export.cron`, default
   3:30am), and on-demand via `POST /api/pwa/export`. This is the **read** path — pre-built,
   server-authored bundles the phone pulls and decrypts, distinct from the mailbox (**write**)
   path.
3. **`MailboxConsumeService`** — same delete-after-success + idempotency-ledger shape as
   habitTracker's, but dispatches to more kinds (`grade`, `assignment`, `file`, `discard`,
   `acknowledge`) and re-exports the review bundle after every successful consume pass so the
   phone's next pull reflects its own just-applied grades. `capture` is explicitly
   `[NOT IMPLEMENTED]` server-side — an unsupported kind just leaves the file intact (no data
   loss, no crash).

### `OFFLINE_FIXES_PORTING.md` — production bugs, captured as reusable lessons

This file is literally titled as porting notes for sibling projects, so it's a distilled version
of exactly what this research is for. Verbatim summary of its four fixes:

1. **Auth: never sign out on anything but 401/403.** Same lesson as habitTracker's v5/topbar fix,
   independently rediscovered. `checkAuth()` must branch `401/403 → sign out`, `2xx → authed`,
   `else (530/5xx) → keep session, do nothing`. Also: seed `isAuthenticated` from a **persisted
   flag** (`localStorage`), not `false`, so an offline cold boot isn't walled behind a login it
   can't reach — only clear that flag on a real 401/403.
2. **Data layer: fall back to cache on 5xx/530, not just `TypeError`** — the `isServerUnreachable`
   predicate above; called the single biggest bug of the whole offline layer.
3. **Service worker: cached shell on a non-OK navigation** — `handleNavigate()` must fall back to
   the cached shell on throw, timeout, **and** `res.ok === false`, because a dead tunnel answers
   with a real 5xx Response.
4. **Offline media** — warm images/PDF/video renditions directly from the server during the
   online sync path (not through Drive — that would bloat encrypted payloads), cache-first at
   serve time, evict out-of-scope entries each warm to bound storage. Not directly relevant to
   *write* sync but documents the same "treat non-ok like offline" pattern applied to reads.

Named gotchas at the end of the file, verbatim-worthy:
- **Stale service worker**: the app runs the cached SW's JS until it re-fetches `sw.js` once
  online; every deploy needs one online refresh to take effect.
- **Cached manifest fields** (e.g. `orientation`) are read at **install** time — changing them
  needs a PWA reinstall, a refresh will not do it.
- **Standalone PWAs disable pinch-zoom** on iOS + Android regardless of viewport meta — orthogonal
  to sync, but a real gotcha for any offline-installed app.

### `pwa/FLOWS.md` (backend) — additional named risks

- **`_offline/` and `_mailbox/` are NOT vault paths** — explicitly excluded from the regular Drive
  listing/janitor sweep so the write-sync machinery never collides with the user's real synced
  data.
- **Mailbox files are hard-deleted, not trashed** — they're transient events, not data, unlike
  vault tombstones which use a soft-trash.
- **Scheduled triggers assume the laptop is up** — the on-boot listener is what actually matters
  for a frequently-off server; the cron is a top-up, not the primary trigger.
- Same **"a permanently-failing event loops forever, file never deletes"** risk as habitTracker,
  independently flagged with the same "fine at personal-project scale, needs a retry cap if it
  bites" verdict.

### `architecture_plans/PWA_MOBILE_ARCH.md` — storage design + explicit tradeoffs

§4 (Storage design): Cache Storage for the app shell + binary media; IndexedDB for structured data
(review queue, outbox); `navigator.storage.persist()` requested on install, may still be refused
by the browser under pressure — no guarantee.

§14 (inherited decision): *"Conflict artifacts, if ever needed, are `_conflicts/` files —
Obsidian-compatible, human-resolvable. v1 avoids conflicts structurally instead: offline writes
are append-only events, not note edits."* This is the project's explicit statement of **no real
conflict resolution** — it's dodged by construction (grade/capture/file/discard are all
op-log-style appends against server-owned state, never client-side merges of a mutable resource),
not solved.

§15 (freshness): a four-layer "belt and suspenders" strategy for keeping *reads* fresh (refresh on
every online focus; best-effort Periodic Background Sync, Chrome/Android-only and ~12h-throttled;
a staleness banner as the "honesty backstop" when both of the above lapse; over-fetch a few days
of buffer). Not directly about writes, but relevant context: the outbox already survives arbitrary
server downtime for writes — the harder unsolved problem in this whole design is *reads* going
stale, not writes going missing.

§16 (Drive as read-fallback, explicitly deferred): three options considered for the "laptop off
for days" case — (A) do nothing extra and rely on staleness banners, (B) full Drive read-fallback
in the PWA (what actually got built, described above), (C) a now-superseded "laptop-mediated
outbox" design. Recorded as a real decision point with tradeoffs already argued through, useful as
a template for how Communicator's equivalent decision should be framed (see below).

---

## Cross-project recipe

Distilling the two implementations into one reusable pattern (mirrors the style of the earlier
install/update-mechanics cross-project comparison):

1. **Never trust `navigator.onLine` or "fetch didn't throw" alone.** Both projects independently
   hit the same production bug: behind a reverse-proxy/tunnel, "origin down" is a *resolved* HTTP
   response (habitTracker: Cloudflare 530; OO: the same 530 plus generic 502/503/504), not a
   thrown network error. Any reachability/unreachability check must treat non-ok 5xx exactly like
   a thrown error. A real, timed `fetch` to a cheap unauthenticated endpoint (habitTracker's
   `/api/ping`) is the only trustworthy signal; `navigator.onLine` is at best a short-circuit to
   skip an obviously-pointless fetch.
2. **Sign-out only on a real 401/403.** Both projects independently discovered and fixed the same
   bug: gating logout on "response not ok" instead of "response is 401/403" sends every offline
   user to a login screen the service worker can't serve from cache — a hard failure that looks
   like a crash. Persist the auth flag (localStorage) and seed it on cold boot instead of
   defaulting to logged-out.
3. **Client-generated idempotency IDs + a server-side consumed-ledger.** `requestId`/`eventId`
   (UUID, generated at enqueue time) plus a dedup table (`consumed_sync_requests` /
   `consumed_events`) is what makes replaying a batch multiple times safe. Both projects apply
   this uniformly to every offline-capable write kind — there is no write kind that lacks an ID.
4. **Writes are pure upserts / append-only events, never merges.** Both projects sidestep real
   conflict resolution by construction: every offline-capable write is either an idempotent upsert
   keyed by `(entity, date)` (habitTracker) or an append-only event against server-owned state
   (OO's grade/file/discard/acknowledge). Neither project has a general-purpose CRDT or three-way
   merge; both explicitly flag this as a chosen simplification, not an oversight.
5. **Delete-after-all-committed, not delete-after-any-committed.** The mailbox/batch file is
   removed only when every item inside it succeeded; a partial failure leaves the whole file for
   the next pass, safe because of (3)'s idempotency.
6. **Three tiers, cheapest-first, worst case always "queue locally, never lose the write."**
   direct server write → (optional) an encrypted relay while the server is reachable-adjacent →
   pure local IndexedDB queue as the unconditional fallback. The relay tier is optional — it only
   exists because both source projects already had a Google Drive integration to piggyback on.
7. **Crypto only matters if the relay tier exists.** Both use AES-256-GCM with a 12-byte IV
   prepended to the ciphertext+tag — that much is identical. Everything about *where the key comes
   from* differs (random server-generated key handed via a short-lived bridge vs. a
   passphrase-derived key handed to the device once, permanently) and is a real architectural
   choice, not a detail — see the open decision below.
8. **The service worker's precache list is a live liability, not a one-time list.** Both projects
   documented a real production bug where a new offline-pipeline script (or a new page route) was
   added to the app but not to the SW's precache/routing list — the asset then failed uncached
   the next time the origin was actually down. Any new file that participates in the offline write
   path needs a same-commit SW update, every time.
9. **Read staleness and write durability are different problems with different fixes.** The outbox
   pattern solves "don't lose a write while offline" unconditionally. It does nothing for "the
   locally cached data to read/act on is stale" — that needs its own refresh cadence (foreground
   triggers, a staleness banner, optionally Periodic Background Sync as a throttled bonus, never a
   guarantee).

---

## What this would mean for Communicator

### Confirmed: zero existing offline-write infrastructure
- `grep -ril "indexeddb\|idb\b" react/src` → no hits outside `PROTO.md`'s own description of the
  gap. `react/src/pwa/` currently contains only `installPrompt.ts` and `registerSW.ts` — no
  `db.ts`, `outbox.ts`, `crypto.ts`, or `connectivity.ts` exist yet.
- `react/public/service-worker.js`'s own header comment states this directly: *"No offline
  writes/outbox — Communicator has no queued-write concept... A capture that happens while
  offline just fails; retry once back online."* It caches the app shell (network-first-ish shell,
  stale-while-revalidate for hashed CRA assets, cache-first for `/api/fileRepository/...` media)
  but has no write path at all.
- `PROTO.md` (top-level SPA doc) independently documents the same gap in the same words — this
  is a known, already-flagged hole, not a surprise finding.

### Candidate writes for offline queueing
From `react/src/services/api/friendService.ts` (read in full):
- **`talkedToFriend(friendId, payload)`** (`PUT /api/friend/talkedToFriend/{id}`) — the core
  "log an interaction" action; closest analogue to habitTracker's `habit-complete` upsert
  (arguably even simpler: it's a single mutable row per friend, not a per-date log).
- **`addFriend(payload)`** (`POST /api/friend/addFriend`) — creates a new row; NOT idempotent by
  default the way habitTracker's writes are (no natural `(id, date)` key — a retried queue item
  after a flaky "did it actually land" would create a duplicate friend unless a client-generated
  idempotency key is added server-side, mirroring `requestId`/`eventId`).
- **`addFriendKnowledgeItem(friendId, fact, importance)`** — append-only fact addition; naturally
  idempotency-key-able the same way.
- **`createFriendSocial` / `updateFriendSocial` / `deleteFriendSocial`** — plausible candidates,
  lower priority (less likely to be used away from network than a quick "talked to" log).
- **`addFriendToGroups` / `addFriendsToGroup` / `removeFriendFromGroup`** — set-membership
  operations, naturally idempotent (add/remove semantics are safe to replay).
- Explicitly **not** good candidates without design work: `uploadFriendFiles` /
  `setPrimaryPhoto` / `deleteFriendMedia` (multipart file uploads — queuing a `File`/`Blob`
  object in IndexedDB is possible, as OO's `captureFile` outbox kind does, but is a materially
  bigger scope than JSON-payload writes and should be a separate decision).
- **`getOutreachDraft`** is a read that hits an LLM — not a write, out of scope for this engine
  entirely.

### What's genuinely missing (confirmed by inspection, not assumed)
1. **No IndexedDB layer at all** — nothing to build on; `db.ts`/`outbox.ts`/`crypto.ts`/
   `connectivity.ts` would all be new files.
2. **No Drive-bridge or Drive-link integration for user *data* sync.** Communicator's only
   existing Google Drive touchpoint is the `backup` module
   (`backup/src/main/java/communicate/backup/drive/{DriveService,BackupOAuthService}.java`,
   `backup/src/main/java/communicate/backup/crypto/EncryptionService.java`) — **nightly full
   database/file backups**, a fundamentally different shape from a per-user Drive-mailbox relay:
   it's a scheduled bulk export/import, not a real-time bidirectional per-user event channel with
   an idempotency ledger. It is a **possible seam** (OAuth client credentials, a `DriveService`
   pattern to imitate, an `EncryptionService` that may already do AES-GCM worth checking for
   reuse) but reusing it for the outbox's relay tier is a nontrivial redesign, not a drop-in — do
   not assume it's reusable without a dedicated look at `backup/src/main/java/communicate/backup/`
   in a future session.
3. **No `/api/ping`-equivalent cheap reachability endpoint** confirmed absent from a quick look at
   `friendService.ts`/`config.ts` — would need to be added (trivial, but not free) for a
   habitTracker-style `Connectivity.isServerReachable()` port.
4. **No client-generated idempotency-ID convention anywhere in the API layer** — every mutating
   call in `friendService.ts` is a plain fetch with no request ID, so the server side has nothing
   to dedup against yet. This must exist before any replay-safe outbox is meaningful, independent
   of which architecture is chosen.

### Open decisions — explicit options, no pick made here

> Per this project's decision-escalation convention: these are architecture calls, not syntax
> calls. Listed as options with tradeoffs; a human should choose before implementation.

**Decision 1 — Is there a relay tier at all, or just direct-write + local queue (two tiers, not
three)?**
- *Option A — Two-tier (direct → local IndexedDB queue only), no Drive/relay path.* Simplest to
  build; matches how `backup`'s existing Drive integration is scoped (admin-configured nightly
  backup, not a per-write live relay) — no new OAuth surface, no new encryption-key distribution
  problem, no new per-user Drive folder concept for Communicator (which today doesn't have one).
  Cost: a write made while the origin is fully down stays local-only until the phone/browser
  itself reconnects to the *same* server — no bridge to shorten that window.
- *Option B — Three-tier, mirroring habitTracker (random server-generated key + short-lived
  access-token bridge, never exposes the refresh token).* Closer to "production-grade," but
  requires building a **new**, per-user Google Drive OAuth connect flow for live data sync
  (distinct from the existing nightly-backup Drive integration, which is not per-user in the same
  way) — real new scope: consent flow, folder-per-user, a bridge-token endpoint, a mailbox-consume
  scheduled job, an idempotency ledger table.
- *Option C — Three-tier, mirroring ObsidianOptimizer (passphrase-derived key, client holds the
  raw OAuth client secret + refresh token after a one-time handshake).* Lower server-side
  ongoing cost (no per-call token-minting endpoint) but a materially different trust model — the
  client permanently holds credentials that can talk to Google as the OAuth app itself. OO's own
  code comments flag this as intentional but noteworthy; Communicator has no
  currently-established rationale for accepting that tradeoff (it wasn't chosen for the nightly
  backup design), so adopting it here is a fresh decision, not a "match the existing pattern" one.

**Decision 2 — What idempotency-key convention, and does it need a schema migration?**
Every candidate write needs a client-generated ID and a server-side dedup mechanism before
replay-safety is real. Options: (a) a new dedicated `consumed_requests` table mirroring both
source projects' pattern exactly; (b) reuse an existing `id`/`uuid` column if one already exists
on the relevant entities (needs checking — out of scope for this research pass); (c) rely on
natural upsert keys only where they exist (e.g. `talkedToFriend` might already be safely
re-callable if the backend logic is a pure upsert — needs backend inspection, not assumed here).

**Decision 3 — Which write kinds ship first?**
Options: (a) start with `talkedToFriend` only (single highest-value, most natural upsert,
smallest surface — closest to habitTracker's proven two-write-kind scope); (b) `talkedToFriend` +
`addFriend` together (covers the two most common "I'm at an event, no signal" actions); (c) build
the generic outbox/dispatch machinery first with zero write kinds wired, then add kinds
incrementally (lowest risk per commit, slowest to first visible value).

**Decision 4 — Does file/media upload (photos) ever get offline-queued, or is it explicitly
out of scope?** OO's `captureFile` outbox kind (queuing a `Blob` from the service worker itself)
is proof it's possible, but it's a materially different and larger problem (blob storage limits
in IndexedDB, `navigator.storage.persist()` reliability, multipart replay) than JSON-payload
writes. Recommend treating this as an explicit non-goal for v1 unless there's a strong stated
need, but this is a call for the user, not assumed here.

---

## Change Index — anticipated new files (if/when implemented)

Nothing below exists yet; this models the eventual touch-list on habitTracker's naming
convention, adapted to Communicator's `.ts`-typed React codebase.

| What | Anticipated file | Modeled on |
|---|---|---|
| IndexedDB wrapper (outbox + meta stores) | `react/src/pwa/db.ts` | habitTracker `db.js` / OO `db.js` |
| Client-side AES-256-GCM encrypt/decrypt (relay tier only — moot under Decision 1 Option A) | `react/src/pwa/crypto.ts` | habitTracker `crypto.js` (no KDF) or OO `crypto.js` (PBKDF2) — depends on Decision 1 |
| Reachability probe (`isServerReachable`) | `react/src/pwa/connectivity.ts` | habitTracker `connectivity.js` |
| Write dispatcher — submit/flush, tier decision logic | `react/src/pwa/outbox.ts` | habitTracker `outbox.js` / OO `outbox.js` |
| Offline-aware wrapper over `friendService.ts` calls (drop-in seam for components) | `react/src/pwa/offlineApi.ts` | OO `offlineApi.js` |
| Drive relay client (ONLY if Decision 1 picks B or C) | `react/src/pwa/driveClient.ts` | habitTracker `driveClient.js` / OO `drive.js`+`mailbox.js` |
| New cheap unauthenticated reachability endpoint | backend, e.g. `PingController` in the app module | habitTracker `habitTracker.PingController` |
| Client-generated idempotency ID + server dedup ledger | new entity/table, e.g. `ConsumedWriteRequest` + repository | habitTracker `ConsumedSyncRequest` / OO `ConsumedEventRepository` |
| Server-side relay drain job (ONLY if Decision 1 picks B or C) | new scheduled service, e.g. `MailboxConsumeService` | habitTracker/OO same name |
| Per-write dispatch: which existing service method a queued write replays to, with a userId-explicit overload if it can run off a background thread | edits inside the existing friend/knowledge/group services | habitTracker's `...ForUser(userId, ...)` pattern |
| SW precache list update (once any new `pwa/*.ts` file exists) | `react/public/service-worker.js` `SHELL_URLS` + bump `VERSION` | habitTracker's v5 bug — mandatory same-commit discipline |
| FLOWS.md for the new subsystem | `react/src/pwa/FLOWS.md` (new) | this repo's own convention |
