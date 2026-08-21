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

### 2b-continued. `GroupConnectionsNudge` — calls the endpoint itself, note field included
```
GroupConnectionsNudge renders each candidate pair with a note input + Went well / Neutral / Tense
buttons
 → tap  →  logConnectionMeeting({ friend1Id, friend2Id, date: today(), outcome, note })
              [connectionMeetingService.logConnectionMeeting — same endpoint ConnectionOutcomeForm
               uses]
     success → pair marked logged (removed from the remaining list), onLogged?.(...) fires
               (optional — callers use it for a toast, nothing more)
     failure → inline error shown under that pair, pair stays in the remaining list (retryable)
```
Previously a display-only stub (`onLogOutcome` prop, no network call inside it) — `HomePage` and
`GroupDetailsPage` each independently defined their own `handleLogConnectionOutcome`, calling
`logConnectionMeeting()` directly with `date: today()` and **no note field**, since the nudge itself
never exposed one. Both duplicates are gone: the nudge now owns the call and the note input, and
both pages just render `<GroupConnectionsNudge onLogged={...} onClose={...} />` — `onLogged` is
purely a post-save notification hook (both pages use it only to fire a toast), not a place to
duplicate the save. `ConnectionOutcomeForm` (2c below) is still a separate, richer component
(date picker, multi-line note) — the nudge's inline note field is intentionally lighter (single
line, no date picker, always logs as "today") to keep the nudge a few taps, not a form.

### 2c. Connection card → `ConnectionOutcomeForm` (HomePage only) — PROPOSED, or DONE→history
```
Click Connection card, status PROPOSED  →  HomePage: setConnectionMeetingTarget(meeting)
 → ConnectionOutcomeForm mounts (friend1Id/friend2Id from the MeetingDTO's connection FKs)
     date (defaults today) + outcome (SegmentedControl) + optional note
 → Save
     POST /api/meetings/connection  { friend1Id, friend2Id, date, outcome, note? }
       [connectionMeetingService.logConnectionMeeting]
     → ConnectionMeetingService.logConnectionMeeting()
         requires an existing Connection row for (friend1Id,friend2Id) — 404 if untracked
         finds this pair's open PROPOSED Meeting (the one this card represents) and transitions
           it to DONE with this request's date/outcome/note — does NOT create a second row
         note (if any) → ConnectionKnowledgeService.addKnowledge() → ConnectionsKnowledge row
 → onSaved  →  close + refetch week

Click Connection card, status DONE  →  HomePage: onViewConnection(meeting)
     navigate(connectionDetailsPath(connectionFriend1Id, connectionFriend2Id))
       [utils/constants.ts] — ConnectionDetailsPage, not the log form again
```
**A live entry point now exists on the backend.** `POST /meetings/manual` accepts
`connectionFriend1Id`/`connectionFriend2Id` as a third option alongside `friendId`/`groupId`
(`GroupMeetingService.createManual`, see [meeting/.../FLOWS.md](../meeting/src/main/java/com/communicator/meeting/FLOWS.md))
— it creates a `PROPOSED`-status, Connection-subject `Meeting` row the same way Friend/Group manual
scheduling always could, so `GET /meetings/thisWeek` can return one for `CalendarBoard` to render as
a "Log outcome" card, and `logConnectionMeeting` above transitions that exact row instead of always
creating a fresh `DONE` one. **No frontend UI calls this yet** — there is no "schedule a connection
meeting ahead" button anywhere in `react/`; the backend capability landed as part of fixing the
duplicate-row bug below, but wiring an entry point (e.g. from `ConnectionDetailsPage`) is still open.
Logging a Connection meeting with nothing scheduled ahead still works exactly as before
(create-and-close, immediately `DONE`) — that path is unchanged, just no longer the *only* path.

`CalendarBoard`'s card-body `onClick` is now gated on `status === 'DONE'` the same way the action
button already was (see `CalendarBoard.tsx`'s `meetingCard()`): a `DONE` Connection card body click
calls `onViewConnection` (→ `ConnectionDetailsPage`) instead of reopening `ConnectionOutcomeForm` and
creating a second `Meeting` row. A `DONE` Group card body click is similarly gated to a no-op (no
group-level "view history" navigation exists yet, so it just doesn't reopen the batch-log modal).

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
| Manual creation | `POST /meetings/manual` (friendId) | `POST /meetings/manual` (groupId) — auto-creates attendee rows | `POST /meetings/manual` (connectionFriend1Id+connectionFriend2Id) — auto-creates 2 attendee rows; **backend-only, no UI entry point yet** (see Stage 2c) |
| Logging UI | `QuickLogModal` (1:1) or `ScheduleMeetingModal` (schedule only) | `GroupBatchLogModal` (presence → per-attendee grade) | `ConnectionOutcomeForm` (date+outcome+note) or `GroupConnectionsNudge` (outcome+single-line note) |
| Completes via | `OutboxWriteService.applyTalkedToFriend` | `POST /meetings/{id}/complete` | `POST /meetings/connection` — transitions a scheduled-ahead row if one exists, else create-and-close |
| FSRS side effect | yes, 1 friend | yes, N friends (fan-out) | **none** — record-only |
| Resulting status | stays `PROPOSED` until logged | `DONE` | `PROPOSED` if scheduled ahead via `POST /meetings/manual`, `DONE` once logged (or immediately `DONE` if never scheduled) |

---

## Technology Notes

- **`GroupConnectionsNudge` now owns its own save** — it calls `logConnectionMeeting` directly (same
  endpoint `ConnectionOutcomeForm` uses) instead of delegating to a caller-supplied handler. It still
  holds local `Set`/`Record` state (`logged`, `saving`, `notes`, `errors`) per pair so a failed save
  leaves that pair retryable without losing what was typed, and a successful one is removed from the
  remaining list so it doesn't nag twice in one pass. `HomePage` and `GroupDetailsPage` no longer
  reimplement anything — both just render `<GroupConnectionsNudge onLogged={...} onClose={...} />`,
  where `onLogged` is an optional post-save hook (both pages use it only to fire a toast).
- **Two different Connection-logging UIs still exist, now closer in capability.**
  `GroupConnectionsNudge`'s inline form: outcome + a single-line optional note, always logs as today.
  `ConnectionOutcomeForm`: date picker + outcome + a multi-line optional note. Both call the same
  `logConnectionMeeting` endpoint and both can append a `ConnectionsKnowledge` row now — the nudge no
  longer lacks a note field, it just keeps a lighter single-line one on purpose (Decisions Log: "a few
  taps, not a form").
- **The FSRS fan-out in `completeGroupMeeting` is not atomic per-friend in the eyes of the caller.**
  The whole method is one `@Transactional` block, so a mid-loop exception rolls back every attendee's
  reschedule and the meeting's `DONE` status together — but the `FriendRescheduledEvent`s are only
  actually delivered `AFTER_COMMIT`, so if the transaction *does* commit, all N events fire together
  right after, not incrementally as each attendee is processed.
- **`ManualMeetingRequest` can now target a Connection** (`connectionFriend1Id`+`connectionFriend2Id`,
  a third mutually-exclusive option alongside `friendId`/`groupId`) and `ConnectionMeetingRequest`
  transitions a matching `PROPOSED` row to `DONE` if one exists rather than always creating a fresh
  one. `CalendarBoard`'s Connection-card click handler and `ConnectionOutcomeForm` can now actually
  receive a `PROPOSED` Connection meeting — but no frontend flow calls the manual-creation endpoint's
  connection branch yet, so in practice every Connection card on the board today is still created via
  create-and-close (already `DONE` the moment it appears). The backend path is real and tested; wiring
  a "schedule a connection meeting ahead" entry point (e.g. from `ConnectionDetailsPage`) is open.
- **`CalendarBoard`'s `onGroupMeetingClick`/`onConnectionMeetingClick` default to a `console.log`
  TODO** if the parent doesn't supply a handler — only `HomePage` renders `CalendarBoard`, and it
  supplies both, so this default path is currently dead but still there as the documented contract
  for any future page that reuses the board. `onViewConnection` (new, for the DONE-card-body gating)
  has the same "optional, only `HomePage` supplies it" shape but no `console.log` default — a DONE
  Connection card body click silently no-ops if a future page reuses `CalendarBoard` without wiring it.

## Change Index

| Want to change… | Where |
|---|---|
| Week-board date window / paging | `MeetingQueryService.thisWeek()` (backend) / `HomePage`'s `weekOffset` state + `useWeekColumns` in `CalendarBoard.tsx` |
| Which card type a Meeting renders as | `CalendarBoard.categoryFor()` |
| Group batch-log presence/grade steps | `GroupBatchLogModal.tsx` (`step` state machine) |
| What grading inputs a Group attendee gets | `GroupBatchLogModal.tsx` `GradeState`/`defaultGrade()` — mirrors `QuickLogModal`'s fields |
| Group meeting completion + FSRS fan-out | `GroupMeetingService.completeGroupMeeting()` (backend) |
| Which pairs trigger the Connections nudge | `GroupMeetingService.connectionCandidates()` (backend) — present attendees × already-tracked `Connection` rows only |
| Connections-nudge outcome wiring / note field / per-pair retry | `GroupConnectionsNudge.tsx` (`handleTap`) → `connectionMeetingService.logConnectionMeeting()` — owns the call itself now, `HomePage`/`GroupDetailsPage` just render it with an `onLogged` toast hook |
| Connection outcome form (date+note capable) | `ConnectionOutcomeForm.tsx` → `ConnectionMeetingService.logConnectionMeeting()` (backend) |
| DONE-card-body gating (Group no-op / Connection → history) | `CalendarBoard.tsx` `meetingCard()` — `onCardClick` branches on `isDone`, mirroring the action button |
| DONE Connection card → show history | `CalendarBoard`'s `onViewConnection` prop → `HomePage` → `navigate(connectionDetailsPath(...))` → `ConnectionDetailsPage` |
| Manual "schedule a meeting" (Friend only, UI) | `ScheduleMeetingModal.tsx` → `GroupMeetingService.createManual()` (backend) |
| Manual "schedule a Connection meeting" (backend only, no UI entry point) | `GroupMeetingService.createManual()`'s connection branch (backend) — see [meeting/.../FLOWS.md](../meeting/src/main/java/com/communicator/meeting/FLOWS.md) |
| PROPOSED→DONE transition for a scheduled-ahead Connection meeting | `ConnectionMeetingService.logConnectionMeeting()` (backend) — `findFirstByConnectionAndStatusOrderByDateDesc` picks the row |
| Group "Log this meeting" entry / dedupe-before-create | `GroupDetailsPage.handleLogMeeting()` |
| Friend reschedule → Meeting row upsert | `MeetingService.onFriendRescheduled()` / `upsertFsrsProposed()` (backend, listens for `FriendRescheduledEvent`) |
| Birthday row creation/rollover | `MeetingService.ensureBirthdayMeeting()` (immediate) / `BirthdayMeetingScheduler` (nightly) |
| Profile's upcoming/history meeting list | `ProfilePage.tsx` `upcomingMeetings`/`pastMeetings` split + `MeetingRow`/`meetingLabel()` |
| The FSRS/bandit math itself | see [relationship-lifecycle.md](relationship-lifecycle.md) Stage 1 — unchanged by this feature |
