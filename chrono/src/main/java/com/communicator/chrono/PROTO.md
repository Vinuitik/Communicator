# Chrono Service — Proto (the cron worker)

> **Proto, not a flow.** The nightly EMA-decay pipeline that stitches chrono↔friend lives in [flows/](../../../../../../flows/). This maps chrono's internals + seams.

Files: ChronoJobService.java, ChronoController.java, ChronoProperties.java, application.yml

## Role

A **stateless scheduled worker**. Owns no JPA entities of its own — it reaches friend's data through `FriendService`/`AnalyticsService` Spring beans (direct in-process call, `chrono` module depends on `friend` in `pom.xml`) to keep every friend's EMA "relationship health" numbers decaying when you *don't* interact. Runs inside the single `communicator-app` JVM (see [bootstrap FLOWS](../../../../../../bootstrap/FLOWS.md)) — no network hop to friend. The only reason chrono has its own controller at all is the manual-trigger + health endpoints.

Since 2026-08-21 it also does own a direct DB seam (see below): a nightly reconciliation query against `group_knowledge`/`connections_knowledge`/`knowledge_chunks` via a plain `JdbcTemplate` — not JPA entities (chrono has none of its own and doesn't depend on group/connections), and `knowledge_chunks` isn't a JPA table on this side at all (it's ai_agent's, same Postgres instance).

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

**Also in the same nightly slot (2026-08-21): `reconcileMissingKnowledgeChunks()`.** Wrapped in its own try/catch after the EMA/FSRS/flashcard blocks, so a failure here never blocks or is blocked by them.

```
ChronoJobService.reconcileMissingKnowledgeChunks()   — same @Scheduled run as applyDailyDecay()
  jdbcTemplate.queryForList("SELECT ... FROM group_knowledge gk
      WHERE NOT EXISTS (SELECT 1 FROM knowledge_chunks kc
                         WHERE kc.knowledge_id = gk.id AND kc.source_type = 'GROUP')")
  jdbcTemplate.queryForList(  same shape for connections_knowledge / source_type = 'CONNECTION' )
  for each row found:
    knowledgeChunkTriggerClient.triggerChunk(new KnowledgeChunkTriggerEvent(...))
       — same RabbitMQ publish path (knowledge-core) a normal knowledge save uses
```

Exists to close the one gap RabbitMQ's own durability can't: the JVM process crashing between a knowledge-save DB commit and `KnowledgeChunkTriggerClient` successfully publishing to the queue (commit and publish aren't atomic — see `knowledge-core/PROTO.md` and [flows/knowledge-rag.md](../../../../../../flows/knowledge-rag.md#eager-multi-entity-chunking)). Friend knowledge is deliberately excluded — it self-heals via `KnowledgeService.summarize_friend_knowledge()`'s lazy `_ensure_knowledge_chunked()` on the ai_agent side, so it doesn't need this backstop.

`ChronoController` (`/chrono/**`, reached via nginx `/api/chrono/` → `.../chrono/`): `POST /trigger-decay` (manual run), `POST /health`.

## Seams

**Outbound:**

| Callee | Trigger / why | Call |
|---|---|---|
| `FriendService` (bean) | count friends | `getFriendsCount()` |
| `FriendService` (bean) | page friends + current EMA + experience | `getFriendsPaginatedForChrono(page,size)` |
| `AnalyticsService` (bean) | who interacted on date | `getFriendsWithInteractionsOnDate(ids, date)` |
| `FriendService` (bean) | write decayed EMA back | `updateMovingAverages(id, freq, dur, excitement)` |
| `JdbcTemplate` (Postgres, same instance ai_agent uses) | find Group/Connection knowledge rows with zero `knowledge_chunks` | `reconcileMissingKnowledgeChunks()` — raw SQL, no JPA entity for the ai_agent-owned `knowledge_chunks` table |
| `KnowledgeChunkTriggerClient` (bean, `knowledge-core` module) | republish a missing chunk-trigger event | `triggerChunk(event)` — same RabbitMQ path a live knowledge save uses |

**Inbound:**

| Caller | Trigger | Entry point |
|---|---|---|
| operator (manual test) | force a decay run | nginx `/api/chrono/trigger-decay` → `ChronoController` |
| the clock | nightly | `@Scheduled` (internal, no caller) |

**DB seam (new, 2026-08-21):** `reconcileMissingKnowledgeChunks()` reads Postgres directly via `JdbcTemplate` (auto-configured, pulled in transitively once `chrono/pom.xml` added a `knowledge-core` dependency — same mechanism `backup/DbBackupService` already relies on for its own `JdbcTemplate` injection). Every other chrono flow still goes through friend's JPA-backed beans, not raw SQL.

## Gotchas / Technology Notes

- **This is the SECOND EMA implementation.** friend's `EmaUpdateService` computes EMA *up* on every interaction; chrono decays it *down* nightly, respecting the friend's last rating via `ChronoProperties.getDecayAlpha()`. Two services, two config sources for the same algorithm family — still a drift risk if either's coefficients change without the other. See the code-reuse report §1 (frontend `analyticsMath.ts` is a third, separate copy used for chart timeseries — flagged, not yet fixed).
- **The `chrono.schedule` YAML property is dead.** The cron is a **hardcoded literal** in `@Scheduled(cron = "0 0 0 * * ?")`, not `${chrono.schedule}`. Editing `application.yml schedule:` changes nothing — you must edit the annotation. Classic footgun.
- **No idempotency / no run log.** If the job runs twice in a day (manual trigger + a restart near midnight), decay is applied twice. Nothing records "already decayed friend X today."
- **`chrono.friendService.batchSize` is unread.** Defined in `ChronoProperties.FriendService` and documented in `application.yml`, but no code path uses it — `friendPageSize` alone drives batching. Pre-existing dead config, not touched.
- **Reconciliation query table/column names aren't enforced by any compile-time check.** `group_knowledge`/`connections_knowledge` are Hibernate's default-naming tables for `GroupKnowledge`/`ConnectionsKnowledge` (`knowledge-core` module) — if either entity ever gets an explicit `@Table` rename, or `knowledge_chunks`'s shape changes on the ai_agent/Python side, this raw SQL breaks silently (caught only by its own try/catch → a `log.error`, not a startup failure). No test-container in this repo to catch it against a real Postgres; `ChronoJobServiceReconciliationTest` mocks `JdbcTemplate` instead.
- **Republished events don't distinguish "still being retried by RabbitMQ" from "already in the DLQ."** If a knowledge-chunk trigger genuinely failed 3 times and landed in `knowledge.chunk.trigger.dlq`, this sweep still finds its knowledge row (still zero chunks) and republishes it as a brand-new attempt — it doesn't check the DLQ. Acceptable for now (a stuck DLQ message usually means a real bug worth re-trying anyway, not a permanent failure), but means an operator inspecting the DLQ via RabbitMQ's management UI shouldn't assume "still in the DLQ" means "chrono hasn't already tried again."

## Change Index

| Thing to change | Where |
|---|---|
| Nightly schedule | `ChronoJobService.@Scheduled(cron=...)` (**NOT** `application.yml`) |
| Decay strength per rating | `application.yml chrono.coefficients.decay.*` (excellent/good/poor) |
| Page size | `application.yml chrono.friendService.friendPageSize` (500) |
| Manual trigger endpoint | `ChronoController.triggerManualDecay()` (nginx `/api/chrono/trigger-decay`) |
| Decay alpha lookup | `ChronoProperties.getDecayAlpha(lastExperience)` |
| Call friend directly vs via HTTP | `ChronoJobService` injects `FriendService`/`AnalyticsService` beans — no client class to swap |
| Knowledge-chunk reconciliation query/scope | `ChronoJobService.reconcileMissingKnowledgeChunks()` (same `@Scheduled` slot as `applyDailyDecay()`, own try/catch) |
| Reconciliation republish path | `KnowledgeChunkTriggerClient.triggerChunk()` (`knowledge-core` module) — see [flows/knowledge-rag.md](../../../../../../flows/knowledge-rag.md#eager-multi-entity-chunking) |
