# Friend Service — Proto

> **Proto, not a flow.** This maps the *internal wiring* of one service + its **seams** (cross-service edges). End-to-end pipelines that traverse these seams live in the top-level [flows/](../../../../../../flows/) docs and link back down here for mechanics.

Files: FriendController.java, FriendService.java, EmaUpdateService.java, AnalyticsService.java, FriendKnowledgeService.java, WebController.java, Friend.java, EmaProperties.java

## Role

The **core of the CRM**. Owns the `Friend` aggregate (name, birthday, next-contact date, interaction quality) plus its child rows: `FriendKnowledge` (facts), `Analytics` (interaction log), `Social`, `Photos`/`Videos`/`PersonalResource` (media metadata), `FriendPermission`, `GroupMember`. Spring Boot 3 / Java 21 / JPA-Hibernate on shared Postgres. Internal port **8085**, reached only through nginx `/api/friend/` (strips the prefix — see [nginx/FLOWS.md](../../../../../../nginx/FLOWS.md)).

Sibling controllers not expanded here (same pattern): `FriendKnowledgeController`, `FriendAnalyticsController`, `SocialController`, `FileController`, `GroupMemberController`, `FriendPermissionController`. Media write/read lives in `FileWriteService` / `FileMetaDataReadService` and proxies to `fileRepository` (env `FILE_REPOSITORY_SERVICE_URL`).

---

## Routing note (why the paths look "bare")

`FriendController` maps `addFriend`, `talkedToFriend/{id}`, etc. with **no class-level `@RequestMapping`**. nginx `location /api/friend/` proxies to `http://friend:8085/` **with the trailing slash**, so `/api/friend/addFriend` → `friend:8085/addFriend`. The browser always calls `/api/friend/**`; the controller sees `/**`. Change the public prefix in `nginx/nginx.conf`, never here.

`@CrossOrigin(origins = "http://nginx")` on every controller — requests are expected to arrive proxied (nginx sets `Origin: http://nginx`, see the `proxy_set_header Origin` line in nginx.conf). Calling the service directly from a browser origin fails CORS.

---

## Add a friend (`POST /api/friend/addFriend`)

```
UI form submit → nginx /api/friend/addFriend → FriendController.addFriend(@Valid Friend)
  friendService.setMeetingTime(experience, analytics[0].date)   — schedules NEXT contact
     "*"  → date + 1 day     (bad meeting, follow up fast)
     "**" → date + 1 week
     else → date + 1 month   ("***" or anything else)
  friend.setPlannedSpeakingTime(plannedTime)
  friendService.save(friend)                    — cascade ALL persists child rows too
  analyticsService.saveAll(friend)              — per-analytics row → EMA recompute (see below)
  knowledgeService.saveAll(friend.getKnowledge())
  → 201 CREATED "Friend added successfully!"
```

`@Valid` enforces `Friend` bean constraints: name 1–50 chars, `plannedSpeakingTime` NotNull, `experience` NotNull ≤100, `dateOfBirth` `@Past`. A constraint violation is a 400 before the method body runs.
To change the scheduling cadence: `FriendService.setMeetingTime()`.

---

## Log an interaction ("I talked to X") (`PUT /api/friend/talkedToFriend/{id}`)

The single most important write path — this is what the user does after actually meeting someone.

```
PUT /api/friend/talkedToFriend/{id}  body = Friend (experience + new analytics/knowledge)
  setMeetingTime(experience, LocalDate.now())  → plannedSpeakingTime  (reschedule from TODAY)
  friendService.updateFriend(id, friend)       — merge name/experience/dob/plannedSpeakingTime
  analyticsService.saveAll(analytics, id)       — append interaction rows + EMA recompute
  knowledgeService.saveAll(knowledges, id)      — append new facts
  → 200 OK
```

**`updateFriend` merge quirk (bug-prone):** the guard is `if (field != null || dbField == null)` — a non-null incoming value overwrites, but a null incoming value ALSO overwrites when the DB value is null. It never clears an already-set field to null, but partial updates that omit a field still re-set it. It then saves unconditionally (`updated || friendDB != null` is always true) and `flush()`es. To change merge semantics: `FriendService.updateFriend()`.

---

## EMA — the "relationship health" numbers

Each `Friend` carries three exponential moving averages, recomputed **synchronously on every analytics insert** (not by a cron — chrono only reads/backfills them): `averageFrequency`, `averageDuration`, `averageExcitement` (columns `average_*`, default 0.0).

```
AnalyticsService.save / saveAll → EmaUpdateService.updateEmaOnNewAnalytics(friendId, experience, hours, date)
  daysDiff = days between interaction date and today
    < 0  (future)   → skip
    > 12 (too old)  → skip                         — only recent events move the average
  baseAlpha      = EmaProperties.getNewDataAlpha(experience)   — "*"=.8  "**"=.7  "***"=.6
  timeDecay      = e^(-0.1 * daysDiff)             — ~halved by day 7
  effectiveAlpha = baseAlpha * timeDecay
  newValue = effectiveAlpha * (decayedNewValue) + (1 - effectiveAlpha) * currentValue
    frequency  decayedNew = 1.0 * timeDecay        — "a meeting happened"
    duration   decayedNew = hours * timeDecay
    excitement decayedNew = experienceValue(1/2/3) * timeDecay
  friendRepository.save(friend)
  on ANY exception → throw RuntimeException → transaction ROLLBACK (analytics insert is undone too)
```

Note the inverted alpha: a **worse** meeting ("*", alpha .8) moves the average *harder* than a great one (".6") — recent bad experiences dominate faster. To retune: `EmaProperties` (`ema.coefficients.new-data.*` in `application.properties`) + the `0.1` decay constant / `12`-day window in `EmaUpdateService.calculateTimeDecayFactor()`.

`updateMovingAverages()` (`PUT /api/friend/updateAverages`) is the **chrono-service write-back** path — chrono computes batch EMAs offline and pushes them here. See [chrono FLOWS](../../../../../../chrono/src/main/java/FLOWS.md).

---

## "This week" reminder list (`GET /api/friend/thisWeek`)

Drives the home screen — who to contact this week.

```
GET /api/friend/thisWeek → FriendService.findThisWeek()
  monday..sunday of current week
  loads ALL friends (findAll — no query filter), then in-memory keeps a friend if:
    birthday (dob.withYear(thisYear)) falls in [monday,sunday]   OR
    plannedSpeakingTime <= sunday        — due or overdue
  → controller re-flags isBirthdayThisWeek per row → List<FriendDTO>
```

Overdue friends (planned date in the past) always stay in the list — nothing ages them out. To change the window/logic: `FriendService.findThisWeek()` (`isBetween`/`isBefore` helpers).

---

## Pagination surfaces (three different consumers)

| Endpoint | Returns | Consumer |
|---|---|---|
| `GET /api/friend/friends/ui/page/{p}/size/{s}` | `FriendDTO` (full display row) | React UI |
| `GET /api/friend/friends/page/{p}[/size/{s}]` | `MCP_Friend_DTO` (projection) | MCP / AI agent |
| `GET /api/friend/friends/chrono/page/{p}/size/{s}` | `ShortFriendDTO` (id+name+3 EMAs) | chrono batch job |
| `GET /api/friend/friends/count` | `long` | pagination math (all consumers) |

Projections (`MCP_Friend_DTO`, `ShortFriendDTO`) are built in JPQL via `FriendRepository.findAllMCPFriendDTOs(pageable)` — don't fetch full entities for these. To change page size default: `FriendService.getFriendsPaginated(page)` (hardcoded 10).

---

## Server-rendered pages (`WebController` — Thymeleaf)

Legacy multi-page UI still served by this service (the React app is replacing it): `GET /talked/{id}` → `talkedForm`, `GET /profile/{id}` → `profile` (pulls media via `PaginationLogicService` + `FileMetaDataReadService`), `GET /knowledge/{id}` → `facts.html`. These render HTML, not JSON — reached directly, not under `/api/friend/`. `[LEGACY]` — new work goes through React + the JSON endpoints.

---

## Seams (cross-service edges — phase-2 flow glue)

**Inbound** (who calls this service, and why):

| Caller | Trigger / why | Entry point |
|---|---|---|
| React UI / legacy static | user views week list, adds friend, logs interaction | `GET /thisWeek`, `POST /addFriend`, `PUT /talkedToFriend/{id}`, `GET /friends/ui/page/..` |
| chrono | nightly EMA rebalance write-back | `PUT /updateAverages` → `updateMovingAverages()` |
| chrono | pull friends + current EMA for batch math | `GET /friends/chrono/page/{p}/size/{s}` → `ShortFriendDTO` |
| chrono | did these friends interact on date D? | `POST /batch-interaction-check` → `AnalyticsService.getFriendsWithInteractionsOnDate()` |
| AI agent / MCP | list a friend's knowledge (paginated projection) | `GET /friends/page/{p}` → `MCP_Friend_DTO`; `FriendKnowledgeService.getKnowledgeIdsByFriendId()` |

**Outbound** (who this service calls):

| Callee | Trigger / why | Exit point |
|---|---|---|
| fileRepository | media upload + metadata read for a friend | `FileWriteService` / `FileMetaDataReadService`, env `FILE_REPOSITORY_SERVICE_URL` |
| Postgres (`my_database`) | all persistence (shared DB, no per-service schema) | JPA repositories, env `SPRING_DATASOURCE_URL` |

---

## Technology Notes

- **Swallowed exceptions everywhere.** Most `FriendService`/`AnalyticsService`/`FriendKnowledgeService` methods wrap the body in `try/catch` and `System.out.print` the error, then return empty/null. A failed DB read looks identical to "no data" to the caller — there is no error propagation to the HTTP layer for reads. `EmaUpdateService` is the deliberate exception: it re-throws to force rollback. Debugging a "missing friend" starts with the container **stdout logs**, not an HTTP status.
- **EMA is synchronous inside the request.** Logging an interaction does N `findById`+`save` round-trips (one per analytics row) before returning. Fine at personal scale; a bulk import of analytics would be O(rows) writes on the request thread.
- **`updateFriend` cannot null-out a field** and re-saves on every call (dirty or not) — see the merge quirk above. Any "why did my edit not clear X" bug lives there.
- **`findThisWeek` loads every friend into memory** and filters in Java (no WHERE clause). Fine for a personal contact list (hundreds); would need a query at thousands.
- **No auth.** Every endpoint is open; the only gate is that nginx is the sole ingress and CORS pins `Origin: http://nginx`. Anything on the docker network can call `friend:8085` freely.
- **Cascade ALL + orphanRemoval on all child collections** (`Friend.java`): deleting a friend deletes all their knowledge/analytics/media-metadata rows. Media BYTES in `fileRepository` are NOT cascaded — deleting a friend orphans their files on disk. `@JsonManagedReference` on each collection pairs with `@JsonBackReference` on the child to break the serialization cycle; sending a child without its back-ref set (as `saveAll(list, friendId)` does via a stub `Friend` holding only the id) is the normal insert path.
- **Shared database, no per-service schema.** friend/group/connections all point at the same `my_database` (Hibernate `ddl-auto` generates tables). A column rename in one service's entity can collide with another's view of the same table.

---

## Change Index

| Thing to change | Where |
|---|---|
| Next-contact scheduling cadence (1d/1wk/1mo) | `FriendService.setMeetingTime()` |
| EMA alpha per rating | `EmaProperties.getNewDataAlpha()` / `application.properties ema.coefficients.new-data.*` |
| EMA time-decay constant / stale window | `EmaUpdateService.calculateTimeDecayFactor()` (0.1) + `daysDifference > 12` guard |
| Experience → numeric mapping | `EmaUpdateService.convertExperienceToNumber()` |
| "This week" inclusion rule | `FriendService.findThisWeek()` |
| Friend field merge on update | `FriendService.updateFriend()` |
| Default page size | `FriendService.getFriendsPaginated(int)` (10) |
| Add-friend orchestration | `FriendController.addFriend()` |
| Log-interaction orchestration | `FriendController.talkedToFriend()` (`updateFriend`) |
| chrono EMA write-back | `FriendController.updateFriendAverages()` → `FriendService.updateMovingAverages()` |
| Bean validation rules | `Friend.java` annotations |
| Media backend URL | env `FILE_REPOSITORY_SERVICE_URL` (compose) |
| DB connection | env `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` (compose) |
| Public path prefix | `nginx/nginx.conf` `location /api/friend/` |
