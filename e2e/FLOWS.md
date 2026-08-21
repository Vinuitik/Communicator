# Whole-System E2E — Offline Outbox
Files: docker.ts, wait.ts, playwright.config.ts, tests/offline-outbox.spec.ts

Not a normal frontend test suite — drives a real headless browser against the live
docker-compose stack on `localhost:8090` and stops/restarts the real `communicator-app`
container mid-test to simulate an outage. Complements the unit-level coverage in
`bootstrap/src/test/java/.../MailboxConsumeServiceTest.java` and the client-side flow in
`react/src/pwa/FLOWS.md`.

## Why it's not just `npx playwright test`
No local Node/npm in this dev environment — runs inside a
`mcr.microsoft.com/playwright:v1.48.0-jammy` container instead, launched with
`--network host` (so `localhost:8090` inside the container reaches the real nginx) and
`-v /var/run/docker.sock:/var/run/docker.sock` (so `docker.ts` can stop/start the real
`communicator-app` container via the raw Docker Engine API — no docker CLI installed in the
image, just one `http.request` call over the mounted socket).

## Two tests, two tiers
```
cold outage:
  stop communicator-app → wait down → fill+submit "Add Friend" form
    → no bridge was ever cached (server was never healthy this session)
    → write lands in IndexedDB 'outbox' store (read directly via page.evaluate)
  → start communicator-app → wait up → page.reload() [triggers wireAutoFlush's immediate flush()]
    → poll GET /api/friend/allFriends until the friend appears
    → DELETE /api/friend/deleteFriend/{id}  [cleanup]

warm bridge:
  load app while server healthy → wait for GET /backup/sync/bridge response [proves bridge cached]
  → stop communicator-app → wait down → fill+submit form
    → wait for POST googleapis.com/upload/drive/v3/files response [proves Drive relay, not queue]
    → assert IndexedDB 'outbox' store stayed empty
  → start communicator-app → wait up
    → poll GET /api/friend/allFriends [MailboxConsumeService.onReady() drains it on boot]
    → DELETE /api/friend/deleteFriend/{id}  [cleanup]
```
Both tests navigate through `/app/friends/add` (not bare `/friends/add` — see the SPA basename
gotcha below) and identify their own friend by a `E2E-Cold-${Date.now()}` / `E2E-Warm-${Date.now()}`
name, so reruns never collide and cleanup is a simple name-match delete.

## Gotcha: the SPA is mounted at `/app`, not `/`
`nginx.conf`'s `location /` 302-redirects to `/app/`, dropping any path after it — a bare
`page.goto('/friends/add')` silently loses the path. `playwright.config.ts`'s `baseURL` is set
to `http://localhost:8090/app/` (trailing slash) specifically so relative `goto()` calls (no
leading `/`) resolve correctly under the basename. `To add a new page to this suite: goto()
with a relative path, never a leading slash, or it'll bounce through the root redirect again.`

## Verification is entirely over HTTP — no direct DB access
No `docker exec`/`psql` anywhere in this suite. Every assertion goes through the app's own
`GET /api/friend/allFriends` / `DELETE /api/friend/deleteFriend/{id}` — sufficient to prove the
write actually landed in Postgres, and avoids needing DB credentials inside the test container.

## Technology Notes
- **Runs LAST in `scripts/run-all-tests.sh`, sequentially, never parallel** — it's disruptive (stops
  the real app) and both tests here share that one container, so `playwright.config.ts` also
  sets `workers: 1` to stop them overlapping with each other.
- **`test.afterEach` always restarts `communicator-app`**, regardless of pass/fail — a safety
  net so a failed run doesn't leave the real app down for whoever's using it next.
- **Fixed version pin** (`@playwright/test: "1.48.0"` exact, not `^1.48.0`) — the npm package
  version and the docker image tag (`v1.48.0-jammy`) must match exactly, or Playwright refuses
  to launch (bundled browser binary version mismatch). `To upgrade: bump both together.`
- **`timeout: 180_000`** in `playwright.config.ts` — generous on purpose. A full cycle is a
  real container stop + JVM reboot (+ a live Drive round trip for the warm-bridge case), and
  this suite runs immediately after the full Maven reactor build, which can leave the Docker
  daemon under load. Don't shrink this without re-verifying on a loaded machine.
- **Live Google Drive dependency** (warm-bridge test only) — needs `/backup/status` to report
  `connected:true` in whatever environment this runs in. If Drive OAuth isn't connected, that
  test will fail at the `page.waitForResponse(...backup/sync/bridge...)` step; the cold-outage
  test has no such dependency.

## Change Index
| Want to change… | Where |
|---|---|
| Which container gets stopped/started | `docker.ts`'s `stopContainer`/`startContainer` calls + the `APP_CONTAINER` const in the spec |
| Health-check polling / timeouts | `wait.ts` (`waitForServerUp`/`waitForServerDown`) |
| Add a new offline-write scenario | new `test()` in `tests/offline-outbox.spec.ts`, reuse `fillAndSubmitAddFriendForm`/`readOutboxStore` |
| Docker image / Playwright version | `e2e/package.json`'s exact version **and** the image tag in `scripts/run-all-tests.sh`'s e2e block — must match |
| Suite ordering / disruptiveness | `scripts/run-all-tests.sh`'s `# ── Whole-system E2E ──` block (always last) |
