---
status: done
branch: master
timestamp: 2026-08-17T19:05:00+01:00
base_commit: c042bd7
completed_commits:
  - 62053ad — MailboxConsumeServiceTest + bootstrap/pom.xml test dep
  - bacf07b — real bug fix: proactive Drive bridge caching (found while building the E2E tests)
  - ba06756 — Playwright E2E suite (e2e/), registered as the last stage in run-all-tests.sh
files_likely_touched:
  - bootstrap/pom.xml (add spring-boot-starter-test, test scope)
  - bootstrap/src/test/java/com/communicator/app/MailboxConsumeServiceTest.java (new)
  - tasks/SYNC_ENGINE_TESTING_HANDOFF.md (this file — update Progress notes as you go)
---

# Handoff: test coverage for the offline-outbox sync engine (Drive-relay half)

This file is written so a fresh Claude Code session can pick this up cold, with
no memory of the conversation that produced it. Read this whole file before
touching code.

## Why this exists

The offline-outbox feature (three-tier write path: direct → Drive relay →
IndexedDB queue) shipped and was live-verified end-to-end in a real browser
this session — see `OFFLINE_OUTBOX_HANDOFF.md` in this same folder for the
full architecture writeup, and commit `c042bd7` for the idempotency-ledger
test coverage that already exists.

That test coverage has a real gap: **`MailboxConsumeService`** — the
server-side job that polls the Drive `_mailbox` folder, decrypts files, and
applies the writes inside them — has **zero automated tests**. Everything
known about its correctness right now comes from one manual live-browser
session (stop backend → submit write → confirm IndexedDB queue → restart
backend → confirm flush + DB row), not from anything that runs in CI or on
`./run-all-tests.sh`. The user explicitly asked for this gap closed before
being "utterly convinced" about the sync engine.

## Where MailboxConsumeService actually lives and what it does

`bootstrap/src/main/java/com/communicator/app/MailboxConsumeService.java`

- Runs on `ApplicationReadyEvent` (`onReady()`) and every 15 min
  (`scheduledConsume()`, `@Scheduled(fixedDelay=15*60*1000)`) — both delegate
  to a `synchronized consumeAll()`.
- `consumeAll()` calls `driveService.listMailboxFiles()` (oldest first, sorted
  by the timestamp baked into the filename by `driveClient.ts`), then per file
  calls `consumeFile(f)`.
- `consumeFile(f)`: downloads raw bytes via `driveService.downloadFile()`,
  decrypts via `EncryptionService.decrypt()` (AES-256-GCM over gzip — must
  match `crypto.ts` exactly), parses JSON into a `MailboxBatch` record
  (`requests: List<MailboxRequest>`) via Jackson.
- Each `MailboxRequest` is dispatched by `kind` string (lines ~114-127) to
  `OutboxWriteService`: `"talkedToFriend"` → `applyTalkedToFriend`,
  `"addFriend"` → `applyAddFriend`, `"addKnowledge"` → `applyAddKnowledge`.
  Unknown kinds are logged and skipped — **confirm from the actual code
  whether "skipped" counts as a failure for the `allCommitted` flag below; don't
  assume, read it.**
- **Partial-failure semantics (lines ~88-112) — this is the important part to
  test**: each request inside a batch file is individually try/caught in a
  loop. If any single request throws, `allCommitted` flips `false` but the
  loop **keeps going** — so a file with 3 requests where request #2 throws
  still applies #1 and #3. The Drive file is deleted
  (`driveService.deleteMailboxFile`) **only if `allCommitted` stayed true**;
  otherwise the whole file is left for the next pass. Re-consuming an
  already-applied request is a safe no-op (the idempotency ledger catches it —
  see `c042bd7`), but a request that fails on *every* pass (e.g. its target
  friend was deleted) retries forever. This is documented in the class's own
  doc comment as accepted-not-fixed — don't try to "fix" it as part of this
  testing pass unless the user asks; just assert the retry-forever behavior is
  what actually happens, since that's the contract other code (and the
  server's own docs) depend on being true.

## What to test

Write `bootstrap/src/test/java/com/communicator/app/MailboxConsumeServiceTest.java`,
mocking `DriveService`, `EncryptionService`, and `OutboxWriteService` (all
constructor-injected — check the real constructor signature, don't guess it).
Follow the existing test style in this repo: plain JUnit5 + Mockito
(`@ExtendWith(MockitoExtension.class)`, `@Mock` fields) + AssertJ assertions —
see `friend/src/test/java/communicate/Friend/FriendService/OutboxWriteServiceTest.java`
(commit `c042bd7`) as the closest sibling example, including its style of
asserting via `verify(...)`/`verifyNoInteractions(...)` rather than just
return values, since a bug that does the wrong thing but still returns
something plausible-looking should still fail the test.

Minimum test cases:

1. **All requests in a batch succeed** → file gets deleted
   (`verify(driveService).deleteMailboxFile(fileId)`).
2. **One request in a batch throws, others succeed** → the successful ones
   still got dispatched to `OutboxWriteService` (verify those specific calls
   happened), but the file is **not** deleted
   (`verify(driveService, never()).deleteMailboxFile(any())`).
3. **Unknown `kind` string** → doesn't crash the batch; confirm (by reading
   the real code first) whether it's treated as success or failure for
   `allCommitted`, then assert whichever it actually does.
4. **Multiple files in the mailbox** → processed in the order
   `listMailboxFiles()` returns them (don't re-sort in the test — assert
   dispatch order matches list order, to catch a future accidental reordering
   bug).
5. **Decrypt throws** (bad/corrupted file, or a passphrase mismatch) → that
   file is treated as a failure and left for the next pass, doesn't crash
   `consumeAll()` for the *other* files in the same run.
6. **Empty mailbox** → no-op, no exceptions, `deleteMailboxFile` never called.

## Known blocker: `bootstrap` module has no test infrastructure yet

Checked this session — confirmed via `find bootstrap/src/test -name "*.java"`
(nothing) and `grep spring-boot-starter-test bootstrap/pom.xml` (nothing).
Every other module with tests (`friend`) has this dependency:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
```

Add the equivalent block to `bootstrap/pom.xml` before writing any test code
there, or `./run-all-tests.sh` won't even attempt to run what you write (it
currently reports `[SKIP] ... (no test files)` for every module without
this).

## Optional stretch goal: automate the live E2E flow itself

This session manually verified the *whole* three-tier write path in a real
headless browser (not just MailboxConsumeService in isolation): stopped the
`communicator-app` container, submitted a write via the UI, confirmed it
queued into `communicator-offline` IndexedDB, restarted the container,
confirmed auto-flush drained the queue, and confirmed the row actually landed
in Postgres via the idempotency ledger. That was `gstack browse` driven by
hand, not a repeatable test — ask the user whether they want this scripted
into something re-runnable (e.g. a shell script under `tasks/` or a proper
Playwright/Cypress suite) before spending time on it; it's valuable but is a
different kind of effort than the unit tests above and wasn't explicitly
asked for yet.

If you do this: environment gotchas hit this session, worth knowing up front
rather than re-discovering —
- The local `gstack` browse install was broken (empty `browse/src/`, missing
  build script) and needed a full reclone — if this is still broken, redo
  `~/.claude/skills/gstack-upgrade/SKILL.md`'s "vendored install" fix path
  (fresh `git clone` over the broken dir), don't debug the broken copy in
  place.
- Headless Chromium's sandbox doesn't work in this environment (no
  unprivileged user namespaces) — set `GSTACK_CHROMIUM_NO_SANDBOX=1` before
  starting the browse daemon, or every `goto` fails with "No usable sandbox!".
- If testing via `http://localhost:8090`, **check nothing else on this
  machine has host port 80 bound** (habitTracker's Caddy container did, this
  session, and silently hijacked one hop of a since-fixed nginx redirect
  chain — see commit `8d5110b`). Not related to Communicator, but confusing
  if you hit it cold.

## Progress

- [x] `bootstrap/pom.xml`: add `spring-boot-starter-test`
- [x] `MailboxConsumeServiceTest`: all-succeed → deletes file
- [x] `MailboxConsumeServiceTest`: partial failure → keeps file, applies the ones that succeeded
- [x] `MailboxConsumeServiceTest`: unknown kind handling (confirmed: doesn't throw, counts as
      committed — file still gets deleted)
- [x] `MailboxConsumeServiceTest`: file processing order
- [x] `MailboxConsumeServiceTest`: decrypt failure isolation
- [x] `MailboxConsumeServiceTest`: empty mailbox no-op
- [x] `./run-all-tests.sh -v` green, commit (62053ad)

## Stretch goal: E2E — done, real bug found along the way

Built as `e2e/` (Playwright, run via a `mcr.microsoft.com/playwright` docker container since
this environment has no local Node), registered as the last, sequential stage in
`run-all-tests.sh` — it stops/restarts the real `communicator-app` container, so it can't run
in parallel with anything else and shouldn't surprise-run mid-session for someone using the
live app; it runs last on purpose.

**Real bug found and fixed while building this (not a test-design issue):** the Drive relay
tier could never actually engage on a cold outage. `driveClient.refreshBridge()` — which mints
the Drive access token via `GET /backup/sync/bridge` — was only ever called *after*
`isServerReachable()` already returned false. But that bridge-mint endpoint lives in the same
single monolith container as everything else, so it dies at the exact same instant as the
write endpoint. Net effect: every write during a fresh outage silently fell straight to the
local IndexedDB queue, skipping Drive entirely, even though the architecture doc describes
three tiers. Fixed in `react/src/pwa/outbox.ts` (commit bacf07b): a new `keepBridgeWarm()`
piggybacks onto the existing 60s `wireAutoFlush` timer, refreshing the cached bridge token
whenever the server is confirmed healthy — so a valid token now survives into the next outage.

Two E2E tests cover the two tiers a fresh browser session can genuinely reach:
- **Cold outage** (`e2e/tests/offline-outbox.spec.ts`): server stopped before first
  navigation → no bridge ever cached → write queues in IndexedDB → server restarted → page
  reload triggers `flush()` → write lands via direct replay. Confirmed via IndexedDB
  inspection + `GET /api/friend/allFriends` polling.
- **Warm bridge**: page loaded while server healthy (bridge gets cached) → server stopped →
  write relays through Drive (confirmed via intercepting the `googleapis.com/upload/drive`
  request, and confirming IndexedDB stays empty) → server restarted →
  `MailboxConsumeService.onReady()` drains the mailbox file → confirmed via the same polling.

Both tests clean up their own test-created friend rows via `DELETE /api/friend/deleteFriend/{id}`
once confirmed landed. `test.afterEach` unconditionally restarts `communicator-app` as a safety
net regardless of pass/fail.

Not covered (explicitly out of scope, matches the unit-test handoff's own boundary): direct
`docker exec`/`psql` verification — everything is verified through the app's own HTTP API
instead, which was sufficient and avoided needing DB credentials inside the test container.
