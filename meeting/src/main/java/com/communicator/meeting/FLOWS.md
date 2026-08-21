# Meeting Module

Files: Meeting.java, MeetingAttendee.java, MeetingSource.java, MeetingStatus.java, MeetingType.java, ConnectionOutcome.java, MeetingRepository.java, MeetingAttendeeRepository.java, MeetingService.java, GroupMeetingService.java, ConnectionMeetingService.java, MeetingEditService.java, MeetingTypeDeriver.java, GroupMatchingService.java, MeetingQueryService.java, BirthdayMeetingScheduler.java, MeetingBackfillRunner.java, MeetingController.java, dtos/*.java

Base package `com.communicator.meeting`. This is the one module in the app allowed to depend on `friend`, `group`, and `connections` simultaneously (`meeting/pom.xml`'s module-level comment) — those three never depend on each other or on this module.

**The source of truth for "who a meeting is about" is the attendee list, not the FK fields.** Read this before anything else in this file — it's a real architecture change, not a naming detail. Every `Meeting` still carries `friend`/`group`/`connection` `@ManyToOne` FK columns (the `connection` one a two-column composite FK into `Connection`'s embedded `ConnectionId` key: `connection_friend1_id`/`connection_friend2_id`), but as of the attendee-list-driven edit model (`MeetingEditService`) those FKs are **query-acceleration + backward-compat only**, kept in sync by `MeetingEditService` — not what determines a meeting's type. The real model is:

- `MeetingAttendee` rows (via `MeetingAttendeeRepository.findByMeetingId`) — who's on the meeting, generalized from a Group-only batch-log roster to every `Meeting`.
- `Meeting.selfAttending` (boolean, default `true`) — whether "I" (the single app user, never a `Friend` row myself) am on it.
- `MeetingTypeDeriver.derive(selfAttending, attendeeCount)` — a pure function computing `MeetingType` (`FRIEND`/`GROUP`/`CONNECTION`) from those two facts. **Never picked explicitly**, always derived, every time a `MeetingDTO` is built.

At most one of `friend`/`group`/`connection` may be set — enforced in `Meeting.validateAtMostOneSubject()` (`@PrePersist`/`@PreUpdate`, not a DB CHECK constraint — this repo has no migration tooling beyond Hibernate `ddl-auto: update`) — but **an ad-hoc GROUP meeting can have none of the three set**: 2+ attendees (with self) that don't match an existing `SocialGroup` closely enough (`GroupMatchingService`) get `group = null` and stay authoritative purely through their attendee list. `MeetingDTO.groupId` being `null` does **not** mean the type isn't `GROUP` — callers must branch on the DTO's `type` field, never on which FK id is non-null (see `MeetingDTO`'s own javadoc).

For the FSRS/bandit scheduling math that produces the dates this module stores, see [friend/.../FriendService/FLOWS.md](../../../../../../../friend/src/main/java/communicate/Friend/FriendService/FLOWS.md) — not re-explained here. For the frontend-side week-board/modal wiring, see [flows/meeting-scheduling.md](../../../../../../../flows/meeting-scheduling.md) — written before the attendee-list edit model landed (no `MeetingEditService`/`MeetingType`/PATCH endpoints mentioned there), so treat its Stage 1 "card categorization is purely which FK is set" line as stale against this file, not the other way around.

## Three sources, one entity

```
MeetingSource: FSRS_PROPOSED | BIRTHDAY | MANUAL
MeetingStatus: PROPOSED | DONE | CANCELLED     — no CONFIRMED, single-user local app
```

- **FSRS_PROPOSED** — auto-managed, one open row per friend, upserted by `MeetingService.upsertFsrsProposed()`.
- **BIRTHDAY** — auto-managed, one row per friend with a `dateOfBirth`, rolled forward yearly by `MeetingService.ensureBirthdayMeeting()`.
- **MANUAL** — everything user-initiated: `GroupMeetingService.createManual()` (Friend, Group, or Connection — all three can be scheduled ahead as a `PROPOSED` row) and `ConnectionMeetingService.logConnectionMeeting()` (Connection, either transitions an existing scheduled-ahead row to `DONE` or, if nothing was scheduled, creates one already-`DONE` — see below).

## Type derivation, the unified edit surface, and ad-hoc groups

```
MeetingTypeDeriver.derive(selfAttending, attendeeCount)
  selfAttending=true,  attendeeCount<=1  → FRIEND     (self + 1 other)
  selfAttending=true,  attendeeCount>=2  → GROUP       (self + 2+ others)
  selfAttending=false, attendeeCount==2  → CONNECTION  (that pair, I wasn't there)
  selfAttending=false, attendeeCount!=2  → GROUP       (0/1 attendee with no self is invalid —
                                                          rejected by MeetingEditService before
                                                          reaching this method; 3+ with no self
                                                          is just "I wasn't at this group thing")
```

Pure function, no persistence, called fresh every time a `MeetingDTO` is built (`MeetingDTO.from(meeting, attendees)`) — a meeting's type is never stored, only ever recomputed from its current attendee list.

`MeetingEditService` is the **one unified edit surface** — `PATCH /meetings/{id}` — that replaced separate Friend/Group/Connection create/edit forms:

```
MeetingEditService.updateMeeting(meetingId, UpdateMeetingRequest{date, time, location,
                                  attendeeFriendIds, selfAttending, groupId, newGroupName})
  validate: attendeeFriendIds non-empty; if !selfAttending, need >=2 attendees; at most one
            of groupId/newGroupName set
  replaceAttendees(meeting, attendeeFriendIds)   — diff against existing MeetingAttendee rows:
                                                     delete dropped, insert new, leave the rest
  meeting.selfAttending = request.selfAttending; date/time/location = request fields (plain edits)
  type = MeetingTypeDeriver.derive(selfAttending, attendeeFriendIds.size())
  resolveSubjectForType(meeting, type, attendeeFriendIds, request)   — see below
  save
```

`resolveSubjectForType` always clears all three FKs first, then sets at most one back, purely as the query-acceleration/backward-compat sync described above:

- **FRIEND** → `meeting.friend = friendService.getFriendById(attendeeFriendIds.get(0))`.
- **CONNECTION** → normalize to `(min(id1,id2), max(id1,id2))`, look up `Connection`; if untracked, leave `meeting.connection = null` — **not an error**, the attendee list stays authoritative either way, the FK is only ever a nice-to-have when a tracked `Connection` happens to exist (see `MeetingEditServiceTest.twoAttendeesNoSelf_untrackedConnection_leavesFkNullButStillValid`).
- **GROUP** → three ways, checked in order:
  1. `request.groupId` set → use that existing `SocialGroup` explicitly (`404` if it doesn't exist), skip auto-match.
  2. `request.newGroupName` set (non-blank) → create a new `SocialGroup` with that name, add the attendees as its roster via `GroupMemberService.addFriendsToGroup()`, link the meeting to it.
  3. Both null (**the default**) → `GroupMatchingService.findBestMatch()`; a match sets `meeting.group`, no match leaves it `null` — **this is the ad-hoc case**: a real `GROUP`-typed meeting with zero subject FKs set, attendee list + `selfAttending` fully authoritative.

`MeetingEditService.previewGroupMatch(attendeeFriendIds)` backs a live "which group would this resolve to" preview in the edit modal (`POST /meetings/group-match-preview`) without saving — calls `GroupMatchingService.findCandidates()` directly.

`MeetingEditService.cancelMeeting(meetingId)` just sets `status = CANCELLED` — no attendee/FK changes.

### GroupMatchingService — "closely enough" is a Jaccard threshold

```
GroupMatchingService.findBestMatch(attendeeFriendIds) / findCandidates(attendeeFriendIds)
  for every existing SocialGroup:
    roster = GroupMemberService.getFriendsByGroupId(group.id) as a Set<Integer>
    score  = |attendees ∩ roster| / |attendees ∪ roster|     — Jaccard similarity
  keep only score >= MIN_MATCH_THRESHOLD (0.5)
  sort by score desc, then groupSize asc (tie-break: prefer the smaller/tighter group)
  findBestMatch = first of that sorted list, or empty if nothing clears the threshold
```

An exact attendee-set match always scores `1.0` and wins. A big group that loosely *contains* the meeting's attendees among many others who weren't there scores low automatically — the union grows with every non-attending member — so "prefer the tighter, more specific group" falls out of the Jaccard metric itself, no separate size-penalty term needed. `0.5` is a hardcoded constant, not configurable via `application.yml`. A genuine tie (same score **and** same size) just returns list order, not disambiguated further — callers wanting to show the user multiple options should call `findCandidates()` (plural) rather than `findBestMatch()`.

To change: match threshold/scoring → `GroupMatchingService.MIN_MATCH_THRESHOLD` / `GroupMatchingService.score()`; which of the three GROUP-resolution paths wins → `MeetingEditService.resolveGroup()`; attendee diffing on edit → `MeetingEditService.replaceAttendees()`.

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

## MANUAL creation — Friend, Group, or Connection, all scheduled-ahead

```
GroupMeetingService.createManual(ManualMeetingRequest{friendId, groupId,
                                  connectionFriend1Id, connectionFriend2Id, date, note})
  exactly one of friendId / groupId / (connectionFriend1Id+connectionFriend2Id) must be set
  new Meeting{source=MANUAL, status=PROPOSED, date, note}

  friendId set     → meeting.friend = friendService.getFriendById(friendId); save
  groupId set      → meeting.group = group (404 if missing); save, then for every
                      GroupMemberRepository.findFriendsByGroupId(groupId):
                        save new MeetingAttendee(meeting, member, present=true)
                          — roster pre-filled, editable before DONE
  connection pair   → normalize to (min(id1,id2), max(id1,id2)), look up Connection
  set               (404 if untracked — same "must already be a tracked pair" rule
                      ConnectionMeetingService.logConnectionMeeting enforces for logging);
                      meeting.connection = connection; meeting.selfAttending = false; save,
                      then save 2 MeetingAttendee rows (one per friend in the pair) — filled
                      in immediately, not left for MeetingBackfillRunner, so the row derives
                      as type CONNECTION right away
```

This lives on `GroupMeetingService` (named for its original Friend/Group scope before the
Connection branch was added — not renamed, to avoid a mechanical rename touching every caller)
and is now the single entry point for scheduling *any* subject type ahead of time. The name is a
known small inconsistency, not a boundary: `ConnectionMeetingService` still owns *logging* a
Connection meeting's outcome (including transitioning a row this method created — see below).
`GroupMeetingService` is also still the only Group-batch-log entry point:

```
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

## Connection flow — schedule ahead (optional) → log outcome, two modes

```
ConnectionMeetingService.logConnectionMeeting(ConnectionMeetingRequest{friend1Id, friend2Id, date, outcome, note})
  validate: both ids present, outcome present, date present
  normalize to (min(friend1Id,friend2Id), max(...)) — matches ConnectionId's canonical ordering
  lookup Connection by that ConnectionId, 404 if untracked

  MeetingRepository.findFirstByConnectionAndStatusOrderByDateDesc(connection, PROPOSED)
    found  → TRANSITION: that row's status=DONE, date/outcome/note = this request's — no new
             Meeting row, no new MeetingAttendee rows (already set when it was scheduled via
             GroupMeetingService.createManual's connection branch)
    absent → CREATE-AND-CLOSE: new Meeting{connection, source=MANUAL, status=DONE, date, outcome,
             note, selfAttending=false}, save, then save 2 MeetingAttendee rows (one per friend)
             immediately — same reasoning as the createManual connection branch: don't wait for
             MeetingBackfillRunner's next boot pass to make this row derive as type CONNECTION

  either way: note present & non-blank?
    → ConnectionKnowledgeService.addKnowledge(id1, id2, [new ConnectionsKnowledge{text=note, priority=1}])
       — reuses the existing knowledge-append path, no duplicated logic (same pattern QuickLogModal
         uses for FriendKnowledge)
```

Connections are a fixed friend1/friend2 pair by schema (`ConnectionId`, no roster) — there's nothing to batch, but as of this flow there *is* something to schedule ahead of time (via `GroupMeetingService.createManual`, above): a `PROPOSED` Connection meeting works the same way Friend/Group's do. `logConnectionMeeting` is purely the "what happened" write — it never creates the `PROPOSED` row itself, only ever finds-and-transitions one if it exists, or falls back to create-and-close for "I never scheduled this, just record it." No FSRS, no `FriendRescheduledEvent`, no `plannedSpeakingTime` touch in either mode — confirmed by `ConnectionMeetingServiceTest.logConnectionMeeting_noFsrsOrSchedulingSideEffect()`.

Both `logConnectionMeeting` and `createManual`'s connection branch independently require an already-tracked `Connection` row for the pair (404 otherwise) — scheduling ahead is still about a pair the app already tracks, just not yet contacted; it does not create a new `Connection`.

To change: `ConnectionMeetingService.logConnectionMeeting()`; which mode wins → the `findFirstByConnectionAndStatusOrderByDateDesc` lookup at the top of that method. `outcome` (`ConnectionOutcome`: `WENT_WELL`/`NEUTRAL`/`TENSE`) and `note` are both nullable/optional on the `Meeting` entity and only ever populated on CONNECTION-subject rows — unused by Friend/Group rows.

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

Every query method routes through `MeetingQueryService.toDtos()`, which loads each `Meeting`'s attendee list (`MeetingAttendeeRepository.findByMeetingId`, one extra query per meeting) before calling `MeetingDTO.from(meeting, attendees)` — `MeetingTypeDeriver` needs the attendee count, so the type can't be computed from the `Meeting` row alone. N+1-shaped, accepted at this app's scale (dozens of meetings, not thousands) — same "no cache, live query" tradeoff made elsewhere in this module.

`MeetingDTO` now carries `type` (`MeetingType`, always derived, never null), `time`, `location`, `selfAttending`, and the full `attendees` list, alongside the historical `friendId`/`groupId`/`connectionFriend1Id`/`connectionFriend2Id`/`friendName`/`groupName` fields. **`groupId` can be `null` while `type == GROUP`** (the ad-hoc case) — frontend code must branch on `type`, not on which id field is populated; see `MeetingDTO`'s own class javadoc for the exact warning.

`MeetingController` (`@RequestMapping("/meetings")`) replaces `FriendController`'s old `thisWeek` endpoint, which only ever read `Friend.plannedSpeakingTime` and structurally couldn't reach across Group/Connection data (friend/group/connections are barred from depending on each other).

| Endpoint | Method | Backing call |
|---|---|---|
| `GET /meetings/thisWeek?weekOffset=` | query | `MeetingQueryService.thisWeek()` |
| `GET /meetings/friend/{friendId}` | query | `MeetingQueryService.upcomingForFriend()` |
| `GET /meetings/group/{groupId}` | query | `MeetingQueryService.forGroup()` |
| `POST /meetings/manual` | write | `GroupMeetingService.createManual()` — Friend, Group, or Connection |
| `GET /meetings/{meetingId}/attendees` | query | `MeetingAttendeeRepository.findByMeetingId()` |
| `POST /meetings/{meetingId}/complete` | write | `GroupMeetingService.completeGroupMeeting()` |
| `GET /meetings/{meetingId}/connection-candidates` | query | `GroupMeetingService.connectionCandidates()` |
| `POST /meetings/connection` | write | `ConnectionMeetingService.logConnectionMeeting()` — transitions an existing `PROPOSED` row to `DONE`, or create-and-close if none exists |
| `PATCH /meetings/{meetingId}` | write | `MeetingEditService.updateMeeting()` — the unified edit surface; also what `CalendarBoard`'s drag-and-drop reschedule calls, sending just a changed `date` with everything else unchanged |
| `PATCH /meetings/{meetingId}/cancel` | write | `MeetingEditService.cancelMeeting()` |
| `POST /meetings/group-match-preview` | query | `MeetingEditService.previewGroupMatch()` → `GroupMatchingService.findCandidates()` |

## Boot-time backfill

```
MeetingBackfillRunner (ApplicationRunner, runs once every boot)
  for each friend:
    no existing FSRS_PROPOSED row AND friend.plannedSpeakingTime != null
      → MeetingService.upsertFsrsProposed(friend.id, friend.plannedSpeakingTime)
    friend.dateOfBirth != null
      → MeetingService.ensureBirthdayMeeting(friend)
  backfillAttendees():
    for every Meeting with NO existing MeetingAttendee rows (guard, not source-based — safe to re-run):
      meeting.friend != null      → save 1 MeetingAttendee (selfAttending already defaults true)
      meeting.connection != null  → save 2 MeetingAttendee rows (both sides of the pair),
                                       meeting.selfAttending = false, save
      meeting.group != null       → skipped — Group rows already got real attendee rows at
                                       creation time (GroupMeetingService.createManual populates
                                       them from GroupMember)
```

Idempotent (checks existence first), safe on every boot — same `ddl-auto: update` reconcile-at-startup convention as `friend`'s `FsrsBackfillRunner`. Seeds `Meeting` rows for friends/data that predate this module's existence, **and separately** backfills `MeetingAttendee` rows + `selfAttending` for every `Meeting` row that predates the attendee-list-driven edit model — every pre-existing Friend-subject row becomes 1 attendee with `selfAttending=true` (unchanged from its actual prior behavior), every pre-existing Connection-subject row becomes its 2 attendees with `selfAttending=false` retrofitted onto it. `Meeting.selfAttending`'s column has a DB-level `columnDefinition = "boolean default true"` (not just a Java-side default) so `ddl-auto: update`'s `ALTER TABLE` on an already-populated table backfills every existing row to `true` at the SQL level first — this runner then specifically flips the Connection rows to `false`, since they need the opposite of the DB default.

Both live Connection-meeting write paths (`GroupMeetingService.createManual`'s connection branch and `ConnectionMeetingService.logConnectionMeeting`'s create-and-close branch) now fill in their 2 `MeetingAttendee` rows + `selfAttending=false` themselves, at write time — this runner's `meeting.connection != null` branch exists purely as a legacy-data safety net for rows written before that was true (or by some future direct-write path that bypasses both services), not as the primary mechanism anymore.

## Wiring: `/meetings` → `/api/meetings/**` → nginx

`MeetingController` maps its own paths at plain `/meetings` (e.g. `/meetings/thisWeek`), same convention as `chrono`/`backup`. Two more pieces make that reachable at `/api/meetings/**` from the browser:

1. **`bootstrap/src/main/java/com/communicator/app/PathPrefixConfig.java`** — since all module controllers now run in one merged dispatcher (the monolith), it prefixes every controller by owning module to avoid path collisions. For `com.communicator.meeting.*` packages it prepends only `/api` (not `/api/meetings`, since the controller's own `@RequestMapping` already contributes `/meetings`) → effective path `/api/meetings/**`.
2. **`nginx/nginx.conf`** — `upstream meeting_service { server communicator-app:8080; }` and `location /api/meetings/ { proxy_pass http://meeting_service; ... }` (no trailing path segment on `proxy_pass`, so nginx forwards the full incoming path unchanged — `/api/meetings/thisWeek` arrives at the monolith as `/api/meetings/thisWeek`, matching `PathPrefixConfig`'s mapping exactly). Added in commit `14b3c11` ("Route /api/meetings/ to the meeting module via nginx"); a later commit `f4f2db9` ("Dedupe Meeting types/config/nginx routes from parallel-agent merges") cleaned up a duplicate/conflicting route from parallel work on the same nginx.conf.

To change the public URL prefix: `PathPrefixConfig.configurePathMatch()`. To change container routing: `nginx/nginx.conf`'s `meeting_service` upstream/location block. Frontend side: `react/src/services/api/config.ts`'s `API_BASE.MEETINGS`, consumed by `meetingService.ts`, `groupMeetingService.ts`, `connectionMeetingService.ts`.

## Technology Notes

- **The Friend→Meeting bridge has no durability.** As detailed above: `FriendRescheduledEvent` is in-process Spring pub/sub, not a broker. A crash in the narrow AFTER_COMMIT window loses the event permanently with no automatic re-delivery; only the next real event for that friend (or a birthday-specific nightly sweep) papers over it. At current single-user local-app scale this window is small and the app restarts rarely mid-request, but it is a real, accepted gap, not a theoretical one.
- **`validateAtMostOneSubject()` is an application-level invariant, not a DB constraint.** Nothing stops a raw SQL script or a future migration tool from writing a `Meeting` row with two or three subject FKs set at once (zero is valid now — the ad-hoc case); only the JPA `@PrePersist`/`@PreUpdate` hook catches it, and only for writes that go through Hibernate.
- **The FK fields can silently go stale relative to the attendee list.** `MeetingEditService` is the only writer that keeps friend/group/connection in sync with the derived type — any future direct write to `Meeting` (a script, a different service, a raw repository `save()`) that touches attendees without also calling through `MeetingEditService`'s resolution logic will leave the FK columns pointing at the wrong thing, or stale-but-present after attendees changed underneath them. Treat `MeetingEditService.updateMeeting()` as the only correct way to change who's on a meeting.
- **`GroupMatchingService.score()` does a full `SocialGroupRepository.findAll()` plus one `GroupMemberService.getFriendsByGroupId()` call per group, on every match/preview call** — no caching, recomputed from scratch each time (matches the live-preview use case in the edit modal, which needs fresh data as the user edits attendees). Fine at dozens-of-groups scale; would need rethinking if the group count grows into the hundreds and the preview is called on every keystroke.
- **`Friend.plannedSpeakingTime` is a deliberate, temporary dual-write.** Every FSRS-driven write (bridge upsert, group batch-log) updates both the `Friend` column and the `Meeting` row. Nothing currently enforces they stay in sync beyond both being written in the same logical operation — if one write path is ever changed without the other, they will silently drift. Retire the `Friend` column only once every reader queries `Meeting` instead (tracked as a known follow-up, not done yet).
- **Composite FK into `Connection`** (`connection_friend1_id`/`connection_friend2_id` via `@JoinColumns`) mirrors `ConnectionId`'s own embedded composite key. Every lookup into `Connection` from this module must first normalize to `(min(id1,id2), max(id1,id2))` — `ConnectionMeetingService.logConnectionMeeting()`, `GroupMeetingService.createManual()`'s connection branch, and `GroupMeetingService.connectionCandidates()` all do this by hand; there's no shared helper for it in this module, so a new call site must remember the same normalization or it will silently miss existing rows (Connection is undirected but stored with a canonical low/high ordering).
- **A Connection pair can end up with more than one `PROPOSED` row** if `createManual`'s connection branch is called twice for the same pair before either is logged — nothing server-side dedupes this (same "no dedupe, client's job" contract `POST /meetings/manual` already has for Group, see its own doc comment). `findFirstByConnectionAndStatusOrderByDateDesc` picks the most-recently-dated one to transition if that happens; the other(s) stay `PROPOSED` and orphaned until manually cancelled or logged separately. No UI currently calls this connection branch (see `flows/meeting-scheduling.md` for the frontend surface, which doesn't yet expose a "schedule a connection meeting ahead" entry point — only the backend capability landed).
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
| MANUAL meeting creation (Friend, Group, or Connection) | `GroupMeetingService.createManual()` |
| Group roster pre-fill | `GroupMeetingService.createManual()` + `GroupMemberRepository.findFriendsByGroupId()` |
| Connection scheduled-ahead attendee-row fill | `GroupMeetingService.createManual()`'s connection branch |
| Group batch-log grading / presence semantics | `GroupMeetingService.completeGroupMeeting()` |
| Group→Connections nudge pairing | `GroupMeetingService.connectionCandidates()` |
| Connection meeting logging / outcome / knowledge-append / PROPOSED→DONE transition | `ConnectionMeetingService.logConnectionMeeting()` |
| Finding a Connection pair's open scheduled-ahead row | `MeetingRepository.findFirstByConnectionAndStatusOrderByDateDesc()` |
| Week-board / upcoming-meetings queries | `MeetingQueryService` |
| Meeting type derivation rules (FRIEND/GROUP/CONNECTION) | `MeetingTypeDeriver.derive()` |
| The unified edit surface (attendees/selfAttending/date/time/location/subject resolution) | `MeetingEditService.updateMeeting()` |
| Attendee-list diffing on edit | `MeetingEditService.replaceAttendees()` |
| Which of groupId/newGroupName/auto-match wins for a GROUP-typed edit | `MeetingEditService.resolveGroup()` |
| Ad-hoc-group threshold / "closely enough" scoring | `GroupMatchingService.MIN_MATCH_THRESHOLD`, `GroupMatchingService.score()` |
| Live group-match preview (no save) | `MeetingEditService.previewGroupMatch()` / `GroupMatchingService.findCandidates()` |
| Cancel a meeting (soft-delete) | `MeetingEditService.cancelMeeting()` |
| At-most-one-FK-subject invariant | `Meeting.validateAtMostOneSubject()` |
| Meeting entity fields / enums | `Meeting`, `MeetingSource`, `MeetingStatus`, `MeetingType`, `ConnectionOutcome` |
| Attendee roster row shape | `MeetingAttendee` |
| Attendee-rows + selfAttending backfill for pre-existing rows | `MeetingBackfillRunner.backfillAttendees()` |
| HTTP surface | `MeetingController` (`/meetings/**`, prefixed to `/api/meetings/**` by `PathPrefixConfig`) |
| Public URL prefix | `bootstrap/.../PathPrefixConfig.configurePathMatch()` |
| Container-level routing | `nginx/nginx.conf` `meeting_service` upstream + `location /api/meetings/` |
| Frontend API base | `react/src/services/api/config.ts` (`API_BASE.MEETINGS`), `meetingService.ts`, `groupMeetingService.ts`, `connectionMeetingService.ts` |
| FSRS/bandit math that produces the dates stored here | [friend FLOWS.md](../../../../../../../friend/src/main/java/communicate/Friend/FriendService/FLOWS.md) — not duplicated in this file |
