# Chrono Service — Proto (the cron worker)

> **Proto, not a flow.** The nightly EMA-decay pipeline that stitches chrono↔friend lives in [flows/](../../../../../../flows/). This maps chrono's internals + seams.

Files: ChronoJobService.java, ChronoController.java, ChronoProperties.java, application.yml

## Role

A **stateless scheduled worker**. Owns **no database and no entities** — it reaches friend's data through `FriendService`/`AnalyticsService` Spring beans (direct in-process call, `chrono` module depends on `friend` in `pom.xml`) to keep every friend's EMA "relationship health" numbers decaying when you *don't* interact. Runs inside the single `communicator-app` JVM (see [bootstrap FLOWS](../../../../../../bootstrap/FLOWS.md)) — no network hop to friend. The only reason chrono has its own controller at all is the manual-trigger + health endpoints.

## Internal wiring

```
@Scheduled(cron "0 0 0 * * ?")  ChronoJobService.applyDailyDecay()   — every midnight
  friendService.getFriendsCount()                             (bean call)
  for each page (size = chrono.friendService.friendPageSize = 500):
    friendService.getFriendsPaginatedForChrono(page,size)     (bean call) → List<ShortFriendDTO>(id,name,3 EMAs,experience)
    analyticsService.getFriendsWithInteractionsOnDate(ids, yesterday)  (bean call) → List<Integer> (who DID interact)
    for each friend NOT in that list:
      applyDecayToFriend(friend, yesterday):
        decayAlpha = chronoProperties.getDecayAlpha(friend.experience())   ← respects the friend's last rating (***/**/*)
        newEma = currentEma * (1 - decayAlpha)                             ← pure decay toward 0
        friendService.updateMovingAverages(id, freq, dur, excitement)     (bean call)
```

All bean-call failures are caught per-friend and logged (`log.warn`) rather than aborting the whole page — a bad friend ID doesn't stop the batch, but there's no retry either.

`ChronoController` (`/chrono/**`, reached via nginx `/api/chrono/` → `.../chrono/`): `POST /trigger-decay` (manual run), `POST /health`.

## Seams

**Outbound:**

| Callee | Trigger / why | Call |
|---|---|---|
| `FriendService` (bean) | count friends | `getFriendsCount()` |
| `FriendService` (bean) | page friends + current EMA + experience | `getFriendsPaginatedForChrono(page,size)` |
| `AnalyticsService` (bean) | who interacted on date | `getFriendsWithInteractionsOnDate(ids, date)` |
| `FriendService` (bean) | write decayed EMA back | `updateMovingAverages(id, freq, dur, excitement)` |

**Inbound:**

| Caller | Trigger | Entry point |
|---|---|---|
| operator (manual test) | force a decay run | nginx `/api/chrono/trigger-decay` → `ChronoController` |
| the clock | nightly | `@Scheduled` (internal, no caller) |

**No DB seam** — chrono never touches Postgres directly; friend is its only data source.

## Gotchas / Technology Notes

- **This is the SECOND EMA implementation.** friend's `EmaUpdateService` computes EMA *up* on every interaction; chrono decays it *down* nightly, respecting the friend's last rating via `ChronoProperties.getDecayAlpha()`. Two services, two config sources for the same algorithm family — still a drift risk if either's coefficients change without the other. See the code-reuse report §1 (frontend `analyticsMath.ts` is a third, separate copy used for chart timeseries — flagged, not yet fixed).
- **The `chrono.schedule` YAML property is dead.** The cron is a **hardcoded literal** in `@Scheduled(cron = "0 0 0 * * ?")`, not `${chrono.schedule}`. Editing `application.yml schedule:` changes nothing — you must edit the annotation. Classic footgun.
- **No idempotency / no run log.** If the job runs twice in a day (manual trigger + a restart near midnight), decay is applied twice. Nothing records "already decayed friend X today."
- **`chrono.friendService.batchSize` is unread.** Defined in `ChronoProperties.FriendService` and documented in `application.yml`, but no code path uses it — `friendPageSize` alone drives batching. Pre-existing dead config, not touched.

## Change Index

| Thing to change | Where |
|---|---|
| Nightly schedule | `ChronoJobService.@Scheduled(cron=...)` (**NOT** `application.yml`) |
| Decay strength per rating | `application.yml chrono.coefficients.decay.*` (excellent/good/poor) |
| Page size | `application.yml chrono.friendService.friendPageSize` (500) |
| Manual trigger endpoint | `ChronoController.triggerManualDecay()` (nginx `/api/chrono/trigger-decay`) |
| Decay alpha lookup | `ChronoProperties.getDecayAlpha(lastExperience)` |
| Call friend directly vs via HTTP | `ChronoJobService` injects `FriendService`/`AnalyticsService` beans — no client class to swap |
