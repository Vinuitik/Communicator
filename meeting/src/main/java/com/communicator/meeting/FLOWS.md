# Meeting Module

Files: Meeting.java, MeetingAttendee.java, MeetingSource.java, MeetingStatus.java, ConnectionOutcome.java, MeetingRepository.java, MeetingAttendeeRepository.java, MeetingService.java, GroupMeetingService.java, ConnectionMeetingService.java, MeetingQueryService.java, BirthdayMeetingScheduler.java, MeetingBackfillRunner.java, MeetingController.java, dtos/*.java

Base package `com.communicator.meeting`. This is the one module in the app allowed to depend on `friend`, `group`, and `connections` simultaneously (`meeting/pom.xml`'s module-level comment) — those three never depend on each other or on this module. A `Meeting` row has exactly one subject via real `@ManyToOne` FKs (`friend_id`, `group_id`, or a two-column composite FK into `Connection`'s embedded `ConnectionId` key: `connection_friend1_id`/`connection_friend2_id`) — not a polymorphic subject_type/subject_id pair. Enforced in `Meeting.validateExactlyOneSubject()` (`@PrePersist`/`@PreUpdate`), not a DB CHECK constraint — this repo has no migration tooling beyond Hibernate `ddl-auto: update`.

For the FSRS/bandit scheduling math that produces the dates this module stores, see [friend/.../FriendService/FLOWS.md](../../../../../../../friend/src/main/java/communicate/Friend/FriendService/FLOWS.md) — not re-explained here.

## Three sources, one entity

```
MeetingSource: FSRS_PROPOSED | BIRTHDAY | MANUAL
MeetingStatus: PROPOSED | DONE | CANCELLED     — no CONFIRMED, single-user local app
```

- **FSRS_PROPOSED** — auto-managed, one open row per friend, upserted by `MeetingService.upsertFsrsProposed()`.
- **BIRTHDAY** — auto-managed, one row per friend with a `dateOfBirth`, rolled forward yearly by `MeetingService.ensureBirthdayMeeting()`.
- **MANUAL** — everything user-initiated: `GroupMeetingService.createManual()` (Friend or Group, scheduled ahead) and `ConnectionMeetingService.logConnectionMeeting()` (Connection, logged already-`DONE` after the fact — Connections have no scheduling state, see below).

## The Friend → Meeting bridge (no message broker involved)

`friend` cannot call into this module directly — `meeting` depends on `friend` for the FK, so the reverse call would be circular. The bridge is `FriendRescheduledEvent` (`friend/.../FriendService/FriendRescheduledEvent.java`), a plain Spring `ApplicationEventPublisher` event published from `friend`'s `OutboxWriteService` whenever `ReviewService` computes a new due date. `MeetingService.onFriendRescheduled()` listens via `@TransactionalEventListener(phase = AFTER_COMMIT)`.

```
OutboxWriteService.applyTalkedToFriend() / applyAddFriend()
  → ReviewService.reviewInteraction() computes due date, saves friend
  → publishes FriendRescheduledEvent(friendId, dueDate)
  → (friend's own DB transaction commits)
  → MeetingService.onFriendRescheduled()  [AFTER_COMMIT, separate try/catch per branch]
       1. upsertFsrsProposed(friendId, dueDate)
       2. friendService.getFriendById(friendId) → ensureBirthdayMeeting(friend)
```

**This is in-process pub/sub within one JVM, not RabbitMQ or any durable queue.** No persistence, no retry, no redelivery. If the JVM crashes between the publish and the `AFTER_COMMIT` handler running, the event is gone — the friend's row is already saved (that transaction already committed), but the corresponding Meeting row silently never gets created/updated. Nothing detects this happened. The only recovery path is indirect: the next `FriendRescheduledEvent` for that friend will upsert correctly, or `MeetingBackfillRunner`/`BirthdayMeetingScheduler`'s nightly pass will eventually catch a birthday row, but a missed FSRS_PROPOSED upsert has no dedicated catch-up — it just stays stale until the friend's next logged interaction. Each of the two branches (FSRS upsert, birthday ensure) is wrapped in its own try/catch and logged, so a failure in one never blocks the other or rolls back the friend save that already happened.

To change what triggers the bridge: `OutboxWriteService` (friend module) — it's the only publisher of `FriendRescheduledEvent`. Editing `dateOfBirth` alone on an existing friend (no analytics logged in the same request) does **not** fire this event — that's a known, accepted gap; it waits for `BirthdayMeetingScheduler`'s nightly pass instead of updating immediately (see comment in `MeetingService.onFriendRescheduled()`).

## FSRS_PROPOSED upsert

```
MeetingService.upsertFsrsProposed(friendId, dueDate)
  find open (non-terminal) FSRS_PROPOSED row for friendId
  exists?  → just update .date
  absent?  → new Meeting{friend, source=FSRS_PROPOSED, status=PROPOSED}, then set .date
  save
```

One friend has at most one live FSRS_PROPOSED row — same one-value-per-friend semantics the old `Friend.plannedSpeakingTime` field had, just relocated onto a `Meeting` row. **`Friend.plannedSpeakingTime` is still dual-written alongside this** (see `GroupMeetingService.completeGroupMeeting()` below, and `OutboxWriteService` on the friend side) — deliberate and temporary, kept until every reader has migrated to querying `Meeting` instead. Don't remove one side without checking both.

To change: `MeetingService.upsertFsrsProposed()`.

## Birthday auto-management — one method, two callers

```
ensureBirthdayMeeting(friend)
  no dateOfBirth?           → no-op
  compute nextOccurrence(dateOfBirth, today)   — handles Feb 29 by clamping to Feb 28 in non-leap years
  find existing BIRTHDAY row for this friend (regardless of status)
  absent?  → new Meeting{friend, source=BIRTHDAY, status=PROPOSED}
  row's date is null OR already in the past? → set to nextOccurrence
  save
```

Two callers, no duplicated logic:
1. **Immediate** — `MeetingService.onFriendRescheduled()`, right after a `FriendRescheduledEvent` (covers new-friend-added and any chat-logged save).
2. **Nightly catch-up** — `BirthdayMeetingScheduler.rolloverPassedBirthdays()`, `@Scheduled(cron = "0 0 0 * * ?")`, same slot as `ChronoJobService.applyDailyDecay()` and `FsrsNeglectService`'s lapse pass, but its own bean in this module rather than hooked into chrono — chrono depends on `friend` only, and `meeting` already sits above it in the dependency graph, so no cross-module cron plumbing is needed. Iterates `friendService.getAllFriends()`; failures per-friend are caught/logged, not fatal to the pass.

To change the rollover cadence: `BirthdayMeetingScheduler`'s `@Scheduled` cron. To change occurrence math: `MeetingService.nextOccurrence()`.

## Group flow — MANUAL creation → batch-log → Connections nudge

```
GroupMeetingService.createManual(ManualMeetingRequest{groupId, date, note})
  new Meeting{source=MANUAL, status=PROPOSED, group}
  save, then for every GroupMemberRepository.findFriendsByGroupId(groupId):
    save new MeetingAttendee(meeting, member, present=true)   — roster pre-filled, editable before DONE

GroupMeetingService.completeGroupMeeting(meetingId, CompleteGroupMeetingRequest{attendees[]})
  for each AttendeeLog{friendId, present, durationHours, experience, inPerson}:
    find that friend's MeetingAttendee row, set .present, save
    present == false → skip entirely (no reviewInteraction call, no row deletion)
    present == true  →
       reviewService.reviewInteraction(friend, durationHours ?? 0.0, experience, inPerson, today)
       friend.plannedSpeakingTime = returned date  (dual-write, see above)
       friendService.save(friend)
       eventPublisher.publishEvent(FriendRescheduledEvent(friend.id, date))  — same bridge as 1:1 logging,
                                                                                so MeetingService.onFriendRescheduled
                                                                                upserts that attendee's own
                                                                                FSRS_PROPOSED row too
  meeting.status = DONE, save
```

This is the attendee-list-driving-FSRS path: a group meeting fans out into one `ReviewService.reviewInteraction()` call and one `FriendRescheduledEvent` per *present* attendee, identical grading inputs to a single 1:1 `QuickLogModal` save. Absent attendees are left completely untouched — not graded, not deleted from the roster.

```
GroupMeetingService.connectionCandidates(meetingId)
  present attendees of that meeting, all pairs (i<j)
  pair already has a tracked Connection (ConnectionRepository.findByFriendId lookup by composite id)?
    → include as ConnectionCandidateDTO
  (no new Connections created here — existing-tracked-pairs only)
```

Backs the post-complete "Connections nudge" UI (`GroupConnectionsNudge`) — a low-friction prompt to also log a Connection meeting for present pairs that already track each other.

To change: batch-log grading logic → `GroupMeetingService.completeGroupMeeting()`; roster pre-fill → `GroupMeetingService.createManual()` + `GroupMemberRepository.findFriendsByGroupId()`; nudge pairing logic → `GroupMeetingService.connectionCandidates()`.

## Connection flow — record-only, no scheduling

```
ConnectionMeetingService.logConnectionMeeting(ConnectionMeetingRequest{friend1Id, friend2Id, date, outcome, note})
  validate: both ids present, outcome present, date present
  normalize to (min(friend1Id,friend2Id), max(...)) — matches ConnectionId's canonical ordering
  lookup Connection by that ConnectionId, 404 if untracked
  new Meeting{connection, source=MANUAL, status=DONE, date, outcome, note}   — already DONE, not PROPOSED
  save
  note present & non-blank?
    → ConnectionKnowledgeService.addKnowledge(id1, id2, [new ConnectionsKnowledge{text=note, priority=1}])
       — reuses the existing knowledge-append path, no duplicated logic (same pattern QuickLogModal
         uses for FriendKnowledge)
```

Connections are a fixed friend1/friend2 pair by schema (`ConnectionId`, no roster) — there's nothing to batch and nothing to schedule ahead of time, so unlike Friend/Group there's no PROPOSED state: you weren't there to schedule it, only to record what you heard about it after the fact. No FSRS, no `FriendRescheduledEvent`, no `plannedSpeakingTime` touch — confirmed by `ConnectionMeetingServiceTest.logConnectionMeeting_noFsrsOrSchedulingSideEffect()`.

To change: `ConnectionMeetingService.logConnectionMeeting()`. `outcome` (`ConnectionOutcome`: `WENT_WELL`/`NEUTRAL`/`TENSE`) and `note` are both nullable/optional on the `Meeting` entity and only ever populated on CONNECTION-subject rows — unused by Friend/Group rows.

## Read side

```
MeetingQueryService.thisWeek(weekOffset)
  Monday-Sunday window for LocalDate.now().plusWeeks(weekOffset) — offset 0 matches the old
  FriendController.getWeekFriends() default exactly
  → MeetingRepository.findByDateBetweenAndStatusNot(monday, sunday, CANCELLED)
  CANCELLED is the only excluded status, so negative offsets paging backward surface past
  DONE meetings too — reads as a progress log when paging back, not just a forward schedule

MeetingQueryService.upcomingForFriend(friendId) → findByFriendIdOrderByDateDesc   — ProfilePage
MeetingQueryService.forGroup(groupId)           → findByGroupIdOrderByDateDesc   — GroupDetailsPage
```

`MeetingController` (`@RequestMapping("/meetings")`) replaces `FriendController`'s old `thisWeek` endpoint, which only ever read `Friend.plannedSpeakingTime` and structurally couldn't reach across Group/Connection data (friend/group/connections are barred from depending on each other).

| Endpoint | Method | Backing call |
|---|---|---|
| `GET /meetings/thisWeek?weekOffset=` | query | `MeetingQueryService.thisWeek()` |
| `GET /meetings/friend/{friendId}` | query | `MeetingQueryService.upcomingForFriend()` |
| `GET /meetings/group/{groupId}` | query | `MeetingQueryService.forGroup()` |
| `POST /meetings/manual` | write | `GroupMeetingService.createManual()` |
| `GET /meetings/{meetingId}/attendees` | query | `MeetingAttendeeRepository.findByMeetingId()` |
| `POST /meetings/{meetingId}/complete` | write | `GroupMeetingService.completeGroupMeeting()` |
| `GET /meetings/{meetingId}/connection-candidates` | query | `GroupMeetingService.connectionCandidates()` |
| `POST /meetings/connection` | write | `ConnectionMeetingService.logConnectionMeeting()` |

## Boot-time backfill

```
MeetingBackfillRunner (ApplicationRunner, runs once every boot)
  for each friend:
    no existing FSRS_PROPOSED row AND friend.plannedSpeakingTime != null
      → MeetingService.upsertFsrsProposed(friend.id, friend.plannedSpeakingTime)
    friend.dateOfBirth != null
      → MeetingService.ensureBirthdayMeeting(friend)
```

Idempotent (checks existence first), safe on every boot — same `ddl-auto: update` reconcile-at-startup convention as `friend`'s `FsrsBackfillRunner`. Seeds `Meeting` rows for friends/data that predate this module's existence.

## Wiring: `/meetings` → `/api/meetings/**` → nginx

`MeetingController` maps its own paths at plain `/meetings` (e.g. `/meetings/thisWeek`), same convention as `chrono`/`backup`. Two more pieces make that reachable at `/api/meetings/**` from the browser:

1. **`bootstrap/src/main/java/com/communicator/app/PathPrefixConfig.java`** — since all module controllers now run in one merged dispatcher (the monolith), it prefixes every controller by owning module to avoid path collisions. For `com.communicator.meeting.*` packages it prepends only `/api` (not `/api/meetings`, since the controller's own `@RequestMapping` already contributes `/meetings`) → effective path `/api/meetings/**`.
2. **`nginx/nginx.conf`** — `upstream meeting_service { server communicator-app:8080; }` and `location /api/meetings/ { proxy_pass http://meeting_service; ... }` (no trailing path segment on `proxy_pass`, so nginx forwards the full incoming path unchanged — `/api/meetings/thisWeek` arrives at the monolith as `/api/meetings/thisWeek`, matching `PathPrefixConfig`'s mapping exactly). Added in commit `14b3c11` ("Route /api/meetings/ to the meeting module via nginx"); a later commit `f4f2db9` ("Dedupe Meeting types/config/nginx routes from parallel-agent merges") cleaned up a duplicate/conflicting route from parallel work on the same nginx.conf.

To change the public URL prefix: `PathPrefixConfig.configurePathMatch()`. To change container routing: `nginx/nginx.conf`'s `meeting_service` upstream/location block. Frontend side: `react/src/services/api/config.ts`'s `API_BASE.MEETINGS`, consumed by `meetingService.ts`, `groupMeetingService.ts`, `connectionMeetingService.ts`.

## Technology Notes

- **The Friend→Meeting bridge has no durability.** As detailed above: `FriendRescheduledEvent` is in-process Spring pub/sub, not a broker. A crash in the narrow AFTER_COMMIT window loses the event permanently with no automatic re-delivery; only the next real event for that friend (or a birthday-specific nightly sweep) papers over it. At current single-user local-app scale this window is small and the app restarts rarely mid-request, but it is a real, accepted gap, not a theoretical one.
- **`validateExactlyOneSubject()` is an application-level invariant, not a DB constraint.** Nothing stops a raw SQL script or a future migration tool from writing a `Meeting` row with zero or two subjects set; only the JPA `@PrePersist`/`@PreUpdate` hook catches it, and only for writes that go through Hibernate.
- **`Friend.plannedSpeakingTime` is a deliberate, temporary dual-write.** Every FSRS-driven write (bridge upsert, group batch-log) updates both the `Friend` column and the `Meeting` row. Nothing currently enforces they stay in sync beyond both being written in the same logical operation — if one write path is ever changed without the other, they will silently drift. Retire the `Friend` column only once every reader queries `Meeting` instead (tracked as a known follow-up, not done yet).
- **Composite FK into `Connection`** (`connection_friend1_id`/`connection_friend2_id` via `@JoinColumns`) mirrors `ConnectionId`'s own embedded composite key. Every lookup into `Connection` from this module must first normalize to `(min(id1,id2), max(id1,id2))` — `ConnectionMeetingService.logConnectionMeeting()` and `GroupMeetingService.connectionCandidates()` both do this by hand; there's no shared helper for it in this module, so a new call site must remember the same normalization or it will silently miss existing rows (Connection is undirected but stored with a canonical low/high ordering).
- **No message queue anywhere in this module.** All cross-module communication is either an in-process Spring event (`FriendRescheduledEvent`) or a direct repository call (`group`/`connections` repositories, since `meeting` is allowed to depend on them). If a future requirement needs guaranteed delivery across the bridge, that's a structural change (e.g. RabbitMQ), not a tweak to `MeetingService`.
- **Birthday leap-day handling**: `nextOccurrence()` relies on `LocalDate.withYear()`'s own Feb-29-in-a-non-leap-year clamp-to-Feb-28 behavior — not custom logic. Verify this is still the desired behavior if `java.time` semantics ever change (they won't, but it's worth knowing this isn't hand-rolled).

## Change Index

| Want to change… | Where |
|---|---|
| One friend's max-one-open-row FSRS proposal logic | `MeetingService.upsertFsrsProposed()` |
| Birthday row creation/rollover rules | `MeetingService.ensureBirthdayMeeting()`, `MeetingService.nextOccurrence()` |
| Nightly birthday catch-up schedule | `BirthdayMeetingScheduler` (`@Scheduled` cron) |
| Boot-time backfill for legacy friends | `MeetingBackfillRunner` |
| What triggers the Friend→Meeting bridge | `OutboxWriteService` (friend module) — only publisher of `FriendRescheduledEvent` |
| How the bridge is consumed | `MeetingService.onFriendRescheduled()` (`@TransactionalEventListener(AFTER_COMMIT)`) |
| MANUAL meeting creation (Friend or Group) | `GroupMeetingService.createManual()` |
| Group roster pre-fill | `GroupMeetingService.createManual()` + `GroupMemberRepository.findFriendsByGroupId()` |
| Group batch-log grading / presence semantics | `GroupMeetingService.completeGroupMeeting()` |
| Group→Connections nudge pairing | `GroupMeetingService.connectionCandidates()` |
| Connection meeting logging / outcome / knowledge-append | `ConnectionMeetingService.logConnectionMeeting()` |
| Week-board / upcoming-meetings queries | `MeetingQueryService` |
| One-of-three-subject invariant | `Meeting.validateExactlyOneSubject()` |
| Meeting entity fields / enums | `Meeting`, `MeetingSource`, `MeetingStatus`, `ConnectionOutcome` |
| Attendee roster row shape | `MeetingAttendee` |
| HTTP surface | `MeetingController` (`/meetings/**`, prefixed to `/api/meetings/**` by `PathPrefixConfig`) |
| Public URL prefix | `bootstrap/.../PathPrefixConfig.configurePathMatch()` |
| Container-level routing | `nginx/nginx.conf` `meeting_service` upstream + `location /api/meetings/` |
| Frontend API base | `react/src/services/api/config.ts` (`API_BASE.MEETINGS`), `meetingService.ts`, `groupMeetingService.ts`, `connectionMeetingService.ts` |
| FSRS/bandit math that produces the dates stored here | [friend FLOWS.md](../../../../../../../friend/src/main/java/communicate/Friend/FriendService/FLOWS.md) — not duplicated in this file |
