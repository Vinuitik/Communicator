# Flow: Meeting Scheduling (week board → Friend/Group/Connection logging → FSRS reschedule)

Feature B (`SCHEDULING_MEETINGS_PLAN.md`). Replaces the old "Friend.plannedSpeakingTime is the only
thing the home screen reads" world with a real `Meeting` row per subject (Friend/Group/Connection)
and per source (`FSRS_PROPOSED`/`BIRTHDAY`/`MANUAL`), so a friend can appear on the board twice (an
FSRS due-date row and a birthday row) and Groups/Connections get their own rows instead of no
representation at all. Sibling flow to [relationship-lifecycle.md](relationship-lifecycle.md), which
still owns the actual FSRS/bandit scheduling math (Stage 1) — this doc is the surface layer: how a
`plannedSpeakingTime` decision becomes something you see and act on, across Friend/Group/Connection.

Backend mechanics: [meeting/.../FLOWS.md](../meeting/src/main/java/com/communicator/meeting/FLOWS.md)
(written in parallel — not duplicated here). Frontend-only in this doc.

Spans **UI → nginx → meeting module** on every read/write below, plus one in-process hop from
**friend → meeting** (an `ApplicationEventPublisher` event, not HTTP — friend has no idea meeting exists).

---

## Stage 1 — The week board (`HomePage`, route `/`)

```
User opens "/"  →  HomePage mounts, weekOffset=0
 → getThisWeek(weekOffset)                                    [meetingService.ts]
     GET /api/meetings/thisWeek?weekOffset=N → nginx → meeting:.../thisWeek
     → MeetingController.thisWeek()  →  MeetingQueryService.thisWeek(weekOffset)
         Mon-Sun window for (today shifted by weekOffset*7 days)
         findByDateBetweenAndStatusNot(monday, sunday, CANCELLED)  — DONE rows included too
 → List<MeetingDTO>  →  CalendarBoard sorts into 7 day columns (client-side, useWeekColumns)
```

`‹ Today ›` buttons page `weekOffset` by ±1 and refetch — negative offsets read as history (past
`DONE` rows come back since only `CANCELLED` is excluded server-side), not just upcoming. There is
no "overdue, before Monday" bucket anymore (the old endpoint's behavior) — an overdue Friend meeting
just sits in its own past Mon-Sun window until you page back to it or log it and it reschedules.

**Card categorization** (`CalendarBoard.categoryFor`) branches on `MeetingDTO.type` — the derived
`MeetingType` (`MeetingTypeDeriver`, see [meeting/.../FLOWS.md](../meeting/src/main/java/com/communicator/meeting/FLOWS.md)),
not raw FK presence: `source === 'BIRTHDAY'` → Birthday card (checked first, always Friend-subject),
else `type === 'GROUP'` → Group card, `type === 'CONNECTION'` → Connection card, else Friend card.
An ad-hoc Group meeting (no matched `SocialGroup`) still renders as a Group card here even though
`groupId` is null — `type` is what to branch on, `groupId` isn't a reliable presence check anymore.

---

## Stage 2 — Clicking a card: three different flows by subject type

### 2a. Friend card → existing flow, unchanged
`onOpenFriend`/`onLogChat` build a throwaway `Friend` object from the `MeetingDTO` (only
id/name/date are populated — good enough to route to `/friends/:id` or open the existing
`QuickLogModal`). This is the pre-existing Stage 1 write path from
[relationship-lifecycle.md](relationship-lifecycle.md) — nothing about *how* a Friend meeting logs
changed, only how it's surfaced.

### 2b. Group card → `GroupBatchLogModal` → (maybe) `GroupConnectionsNudge`
```
Click Group card  →  HomePage: setGroupMeetingTarget(meeting); stage='batchLog'
 → GroupBatchLogModal mounts
     GET /api/meetings/{meetingId}/attendees               [groupMeetingService.getMeetingAttendees]
       → pre-filled AttendeeDTO[] (present:true for every current GroupMember, from meeting creation)
 Step 1 "presence": toggle who showed up (checkbox per attendee)
 Step 2 "grade": for each still-present attendee, same duration/experience/in-person inputs
   QuickLogModal uses for a 1:1 log (RatingPicker + hours Input + SegmentedControl)
 → Complete meeting
     POST /api/meetings/{meetingId}/complete  { attendees: AttendeeLog[] }
       [groupMeetingService.completeGroupMeeting]
     → GroupMeetingService.completeGroupMeeting()
         per present attendee: ReviewService.reviewInteraction(friend, hours, experience, inPerson, today)
           — THE SAME FSRS+bandit pipeline as a 1:1 "talked to" log (relationship-lifecycle Stage 1)
         friend.plannedSpeakingTime = returned due date; friendService.save(friend)
         eventPublisher.publishEvent(FriendRescheduledEvent(friendId, dueDate))   — one event PER friend
         absent attendees: row.present=false persisted, NO reviewInteraction call — untouched otherwise
       meeting.status = DONE
 → onComplete(meeting)  →  HomePage.handleBatchLogComplete
     GET /api/meetings/{meetingId}/connection-candidates    [groupMeetingService.getConnectionCandidates]
       → present-attendee pairs that already have a tracked Connection row (never the full
         combinatorial set, never creates a new Connection)
     candidates.length > 0  →  open GroupConnectionsNudge
     candidates.length === 0 (or the candidates call itself fails)  →  toast + refetch, done
```

**FSRS fan-out**: one Group meeting with N present attendees fires N separate
`ReviewService.reviewInteraction()` calls and N separate `FriendRescheduledEvent`s — there is no
group-level scheduling decision, each friend's stability/difficulty/bandit state moves independently,
exactly as if you'd logged N individual 1:1 chats. `GroupMeetingService` has direct access to
`ReviewService`/`FriendService` beans (same JVM since the monolith merge) — no HTTP hop.

### 2b-continued. `GroupConnectionsNudge` — a display-only stub, wired independently by each caller
```
GroupConnectionsNudge renders each candidate pair with Went well / Neutral / Tense buttons
 → tap  →  onLogOutcome(friend1Id, friend2Id, outcome)   — nudge itself makes NO network call
```
Read `GroupConnectionsNudge.tsx`'s own doc comment closely: it was built as a stub against a
not-yet-landed backend, with the expectation that "a parent component wires this once that lands."
**That wiring landed, but not through `ConnectionOutcomeForm`** — both `HomePage` and
`GroupDetailsPage` independently define their own `handleLogConnectionOutcome`, each calling
`logConnectionMeeting()` directly with `date: today()` and no note. `ConnectionOutcomeForm` (the
richer date+note form) is a separate component, not used by the nudge at all — see 2c.

### 2c. Connection card → `ConnectionOutcomeForm` (HomePage only)
```
Click Connection card  →  HomePage: setConnectionMeetingTarget(meeting)
 → ConnectionOutcomeForm mounts (friend1Id/friend2Id from the MeetingDTO's connection FKs)
     date (defaults today) + outcome (SegmentedControl) + optional note
 → Save
     POST /api/meetings/connection  { friend1Id, friend2Id, date, outcome, note? }
       [connectionMeetingService.logConnectionMeeting]
     → ConnectionMeetingService.logConnectionMeeting()
         requires an existing Connection row for (friend1Id,friend2Id) — 404 if untracked
         Meeting saved with status=DONE immediately (no PROPOSED state for Connections at all)
         note (if any) → ConnectionKnowledgeService.addKnowledge() → ConnectionsKnowledge row
 → onSaved  →  close + refetch week
```
**This path currently has no live entry point on the backend.** `POST /meetings/manual` only accepts
`friendId`/`groupId` (`GroupMeetingService.createManual` throws if both or neither are set — there's
no third option for a connection pair), and `POST /meetings/connection` itself always saves the row
as `DONE`. Nothing in the current backend ever creates a `PROPOSED`-status, Connection-subject
`Meeting` row, so `GET /meetings/thisWeek` can never actually return one for `CalendarBoard` to render
as a "Log outcome" card in practice — this path is real, tested-looking code with no way to reach it
yet. (Also: `CalendarBoard`'s card-body `onClick` isn't gated on `isDone` the way the action button
is — clicking a `DONE` Connection card, if one ever existed, would reopen `ConnectionOutcomeForm` and
create a second `Meeting` row rather than showing/editing the first.)

---

## Stage 3 — Scheduling a Friend meeting by hand (`ScheduleMeetingModal`, `ProfilePage` only)

```
ProfilePage → "+ Schedule a meeting"  →  ScheduleMeetingModal(friendId, friendName)
 → Save (date + optional note)
     POST /api/meetings/manual  { friendId, groupId: null, date, note }   [meetingService.createManualMeeting]
     → GroupMeetingService.createManual()  →  Meeting(source=MANUAL, status=PROPOSED, friend=…)
 → onScheduled  →  ProfilePage.loadMeetings()  →  GET /api/meetings/friend/{friendId}
```
`ProfilePage`'s "Upcoming meetings" card (`MeetingRow`) is fed entirely by
`getFriendMeetings(friendId)` → `MeetingController.forFriend` → `MeetingQueryService.upcomingForFriend`,
split client-side into `status === 'PROPOSED'` (ascending, "Upcoming") vs. everything else
(`DONE`/`CANCELLED`, "History", API's descending order kept). This replaced a single
next-contact-date field with the full row list — a `MeetingRow` can be an `FSRS_PROPOSED` auto-date,
a `BIRTHDAY`, or a hand-scheduled `MANUAL` row, all mixed together and told apart only by
`meetingLabel()`'s `source` check.

---

## Stage 4 — `GroupDetailsPage`'s own "Log this meeting" button

Same `GroupBatchLogModal` → `GroupConnectionsNudge` chain as 2b, but with its own entry point instead
of clicking a week-board card:
```
"Log this meeting"  →  handleLogMeeting()
     GET /api/meetings/group/{groupId}   — check for an already-PROPOSED group meeting first
     none found → POST /api/meetings/manual { groupId, date: today, note: null }
       [groupMeetingService.createManualMeeting — the Group half of ManualMeetingRequest]
       → GroupMeetingService.createManual(): for a group, auto-creates one MeetingAttendee
         (present=true) per current GroupMember — this is what GroupBatchLogModal's presence
         step pre-fills from
 → GroupBatchLogModal(meetingId) … same as 2b from here
```
`POST /meetings/manual` does no dedupe of its own for either subject type — `handleLogMeeting`'s
GET-then-maybe-POST check is entirely a client-side convention both `HomePage` (implicitly, by only
ever clicking on already-existing week-board rows) and `GroupDetailsPage` (explicitly) rely on to
avoid creating duplicate `PROPOSED` group meetings.

---

## Stage 5 — How a Friend's reschedule becomes a Meeting row (the friend→meeting seam)

```
ReviewService.reviewInteraction() returns a new due date        [relationship-lifecycle Stage 1]
 (from either a 1:1 "talked to" log OR a Group batch-log's per-attendee loop, Stage 2b above)
 → friend.plannedSpeakingTime saved  →  FriendRescheduledEvent(friendId, dueDate) published
 → MeetingService.onFriendRescheduled()   [@TransactionalEventListener(AFTER_COMMIT)]
     — runs only after the publishing transaction commits; friend module never imports meeting,
       it just publishes an event onto the shared Spring context
     upsertFsrsProposed(friendId, dueDate)
       one live (non-terminal) FSRS_PROPOSED row per friend — updates date if it exists, else creates
     ensureBirthdayMeeting(friend)
       one live BIRTHDAY row per friend with a dateOfBirth — creates or rolls to next year if passed
```
**Known gap** (flagged in the source, not fixed here): editing only `dateOfBirth` on an existing
friend with no analytics logged in the same request never fires `FriendRescheduledEvent`, so that
edit's birthday-row update waits for `BirthdayMeetingScheduler`'s nightly pass instead of updating
immediately.

## Stage 6 — Nightly birthday rollover

```
BirthdayMeetingScheduler.rolloverPassedBirthdays()   @Scheduled(cron "0 0 0 * * ?")
  same nightly slot as ChronoJobService.applyDailyDecay() / FsrsNeglectService's lapse pass, but its
  own separate @Scheduled bean — meeting sits above friend/group/connections in the dependency graph,
  doesn't need chrono's help to run on a cron
  for every friend with a dateOfBirth: MeetingService.ensureBirthdayMeeting(friend)
    rolls the BIRTHDAY row to next year once its stored date is in the past
```

---

## The three subject types, side by side

| | Friend | Group | Connection |
|---|---|---|---|
| Auto-scheduled rows | `FSRS_PROPOSED` + `BIRTHDAY` | none | none |
| Manual creation | `POST /meetings/manual` (friendId) | `POST /meetings/manual` (groupId) — auto-creates attendee rows | **none** — see Stage 2c gap |
| Logging UI | `QuickLogModal` (1:1) or `ScheduleMeetingModal` (schedule only) | `GroupBatchLogModal` (presence → per-attendee grade) | `ConnectionOutcomeForm` (date+outcome+note) |
| Completes via | `OutboxWriteService.applyTalkedToFriend` | `POST /meetings/{id}/complete` | `POST /meetings/connection` |
| FSRS side effect | yes, 1 friend | yes, N friends (fan-out) | **none** — record-only |
| Resulting status | stays `PROPOSED` until logged | `DONE` | always created as `DONE` |

---

## Technology Notes

- **`GroupConnectionsNudge` is genuinely stateless** — it holds only a local `Set` of already-tapped
  pairs so it doesn't nag twice in one pass. Every actual save is the caller's responsibility; `HomePage`
  and `GroupDetailsPage` each reimplement the identical `handleLogConnectionOutcome` (same
  `logConnectionMeeting` call, same `date: today()`, no note field exposed by the nudge). A future
  edit to that wiring (e.g. adding a note) has to be made in both places — there's no shared hook.
- **Two different Connection-logging UIs exist with different capabilities.** `GroupConnectionsNudge`'s
  inline buttons: outcome only, today's date, no note. `ConnectionOutcomeForm`: date picker + outcome +
  optional note (which appends to `ConnectionsKnowledge`). Only the latter can attach a note — the
  nudge path can never produce a `ConnectionsKnowledge` row.
- **The FSRS fan-out in `completeGroupMeeting` is not atomic per-friend in the eyes of the caller.**
  The whole method is one `@Transactional` block, so a mid-loop exception rolls back every attendee's
  reschedule and the meeting's `DONE` status together — but the `FriendRescheduledEvent`s are only
  actually delivered `AFTER_COMMIT`, so if the transaction *does* commit, all N events fire together
  right after, not incrementally as each attendee is processed.
- **`ManualMeetingRequest` structurally cannot target a Connection** (`friendId`/`groupId`, exactly
  one) and `ConnectionMeetingRequest` always saves `DONE` — there is no code path today that produces
  a `PROPOSED` Connection meeting, which is what `CalendarBoard`'s Connection-card click handler and
  `ConnectionOutcomeForm` are built to react to. Not broken, just unreachable until/unless a
  connection gets a `PROPOSED`-creating entry point.
- **`CalendarBoard`'s `onGroupMeetingClick`/`onConnectionMeetingClick` default to a `console.log`
  TODO** if the parent doesn't supply a handler — only `HomePage` renders `CalendarBoard`, and it
  supplies both, so this default path is currently dead but still there as the documented contract
  for any future page that reuses the board.

## Change Index

| Want to change… | Where |
|---|---|
| Week-board date window / paging | `MeetingQueryService.thisWeek()` (backend) / `HomePage`'s `weekOffset` state + `useWeekColumns` in `CalendarBoard.tsx` |
| Which card type a Meeting renders as | `CalendarBoard.categoryFor()` |
| Group batch-log presence/grade steps | `GroupBatchLogModal.tsx` (`step` state machine) |
| What grading inputs a Group attendee gets | `GroupBatchLogModal.tsx` `GradeState`/`defaultGrade()` — mirrors `QuickLogModal`'s fields |
| Group meeting completion + FSRS fan-out | `GroupMeetingService.completeGroupMeeting()` (backend) |
| Which pairs trigger the Connections nudge | `GroupMeetingService.connectionCandidates()` (backend) — present attendees × already-tracked `Connection` rows only |
| Connections-nudge outcome wiring | `HomePage.handleLogConnectionOutcome()` / `GroupDetailsPage.handleLogConnectionOutcome()` (frontend, duplicated) |
| Connection outcome form (date+note capable) | `ConnectionOutcomeForm.tsx` → `ConnectionMeetingService.logConnectionMeeting()` (backend) |
| Manual "schedule a meeting" (Friend only) | `ScheduleMeetingModal.tsx` → `GroupMeetingService.createManual()` (backend) |
| Group "Log this meeting" entry / dedupe-before-create | `GroupDetailsPage.handleLogMeeting()` |
| Friend reschedule → Meeting row upsert | `MeetingService.onFriendRescheduled()` / `upsertFsrsProposed()` (backend, listens for `FriendRescheduledEvent`) |
| Birthday row creation/rollover | `MeetingService.ensureBirthdayMeeting()` (immediate) / `BirthdayMeetingScheduler` (nightly) |
| Profile's upcoming/history meeting list | `ProfilePage.tsx` `upcomingMeetings`/`pastMeetings` split + `MeetingRow`/`meetingLabel()` |
| The FSRS/bandit math itself | see [relationship-lifecycle.md](relationship-lifecycle.md) Stage 1 — unchanged by this feature |
