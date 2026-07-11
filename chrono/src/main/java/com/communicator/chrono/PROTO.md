# Chrono Service — Proto (the cron worker)

> **Proto, not a flow.** The nightly EMA-decay pipeline that stitches chrono↔friend lives in [flows/](../../../../../../flows/). This maps chrono's internals + seams.

Files: ChronoJobService.java, MovingAverageCalculationService.java, FriendServiceClient.java, ChronoController.java, ChronoProperties.java, application.yml, dto/FriendSummary.java, dto/AnalyticsEntry.java, dto/FriendUpdateRequest.java

## Role

A **stateless scheduled worker**. Owns **no database and no entities** — it reaches the friend service over HTTP (through nginx) to keep every friend's EMA "relationship health" numbers decaying when you *don't* interact. Internal port **8087** (container `chronoService`). Depends on `friend` + `nginx` at boot (it calls them via nginx). The only reason it has an HTTP server at all is the manual-trigger + health endpoints.

## Internal wiring

```
@Scheduled(cron "0 0 0 * * ?")  ChronoJobService.applyDailyDecay()   — every midnight
  friendServiceClient.getFriendsCount()                      GET  nginx /api/friend/friends/count
  for each page (size = chrono.friendService.friendPageSize = 500):
    getFriendsPaginated(page,size)                           GET  .../friends/chrono/page/{p}/size/{s}  → List<FriendSummary>(id,name,3 EMAs)
    getFriendsWithInteractionsOnDate(ids, yesterday)         POST .../batch-interaction-check?date=  → List<Integer> (who DID interact)
    for each friend NOT in that list:
      applyDecayToFriend(friend, yesterday):
        decayAlpha = chronoProperties.getDecay("good") = 0.2   ← ALWAYS "good", ignores real rating (see Gotchas)
        newEma = currentEma * (1 - decayAlpha)                 ← pure decay toward 0
        updateFriendAverages(FriendUpdateRequest)            PUT  .../updateAverages
```

`FriendServiceClient` = raw `java.net.http.HttpClient` + Jackson, base URL `http://nginx/api/friend` (config), 30s timeout. All errors are logged and swallowed (returns empty list / false) — a friend-service outage makes the job a silent no-op, no retry.

`ChronoController` (`/chrono/**`, reached via nginx `/api/chrono/` → `.../chrono/`): `POST /trigger-decay` (manual run), `POST /health`.

## Seams

**Outbound** (chrono is almost entirely outbound):

| Callee | Trigger / why | Endpoint |
|---|---|---|
| friend (via nginx) | count friends | `GET /api/friend/friends/count` |
| friend (via nginx) | page friends + current EMA | `GET /api/friend/friends/chrono/page/{p}/size/{s}` |
| friend (via nginx) | who interacted on date | `POST /api/friend/batch-interaction-check?date=` |
| friend (via nginx) | write decayed EMA back | `PUT /api/friend/updateAverages` |
| friend (via nginx) | per-friend analytics history | `GET /api/friend/analyticsList?friendId=&left=&right=` (used only by the *unwired* recompute service) |

**Inbound:**

| Caller | Trigger | Entry point |
|---|---|---|
| operator (manual test) | force a decay run | nginx `/api/chrono/trigger-decay` → `ChronoController` |
| the clock | nightly | `@Scheduled` (internal, no caller) |

**No DB seam** — chrono never touches Postgres directly; friend is its only data source.

## Gotchas / Technology Notes

- **This is the SECOND (and a latent THIRD) EMA implementation.** friend's `EmaUpdateService` computes EMA *up* on every interaction; chrono decays it *down* nightly. Together they're one algorithm split across two services + two config sources → easy to drift. The frontend `analytics.js` is a fourth copy of the same math. **Prime consolidation target** — see the code-reuse report.
- **The nightly job ignores the real experience rating.** `applyDecayToFriend` hardcodes `getDecay("good")` (alpha 0.2) for everyone — the per-rating decay coefficients (`excellent 0.07 / good 0.2 / poor 0.57`) and the whole `getDecayAlpha(lastExperience)` method are **defined but not used by the scheduled path**. A friend you rated "***" decays as fast as one you rated "*".
- **`MovingAverageCalculationService` is built but NOT wired into the cron job.** It's a full replay-from-analytics recompute (mirrors `analytics.js`, uses `getNewDataAlpha`/`getDecayAlpha` + `getFriendAnalytics`) — but `ChronoJobService` only ever calls the simple `applyDecayToFriend`. Dead-ish code / a half-finished "proper recompute" path. `[PARTIALLY IMPLEMENTED]`
- **The `chrono.schedule` YAML property is dead.** The cron is a **hardcoded literal** in `@Scheduled(cron = "0 0 0 * * ?")`, not `${chrono.schedule}`. Editing `application.yml schedule:` changes nothing — you must edit the annotation. Classic footgun.
- **chrono's `getNewDataAlpha` disagrees with friend's.** chrono: `**`=0.3, `*`=0.15. friend `EmaProperties`: `**`=0.7, `*`=0.8. Same-named coefficient, different values, different services. (Only matters if the recompute service ever gets wired.)
- **Calls friend *through nginx*, not directly.** `baseUrl=http://nginx/api/friend` — so a chrono job depends on nginx being up and the route being correct, not just on `friend:8085`. One more hop to debug. Could call `friend:8085` directly; goes through nginx instead.
- **No idempotency / no run log.** If the job runs twice in a day (manual trigger + a restart near midnight), decay is applied twice. Nothing records "already decayed friend X today."

## Change Index

| Thing to change | Where |
|---|---|
| Nightly schedule | `ChronoJobService.@Scheduled(cron=...)` (**NOT** `application.yml`) |
| Decay strength | `application.yml chrono.coefficients.decay.*` — but only `"good"`(0.2) is actually read by the job |
| Make decay respect rating | `ChronoJobService.applyDecayToFriend()` (swap hardcoded `getDecay("good")` → `getDecayAlpha(friend.lastExperience)`) |
| Page size / batch size | `application.yml chrono.friendService.friendPageSize` (500) / `batchSize` (200) |
| Friend service base URL / timeout | `application.yml chrono.friendService.baseUrl` / `timeout` |
| Wire the full recompute | inject + call `MovingAverageCalculationService` from `ChronoJobService` |
| Manual trigger endpoint | `ChronoController.triggerManualDecay()` (nginx `/api/chrono/trigger-decay`) |
| New-data vs decay alpha maps | `ChronoProperties.getNewDataAlpha()` / `getDecayAlpha()` |
