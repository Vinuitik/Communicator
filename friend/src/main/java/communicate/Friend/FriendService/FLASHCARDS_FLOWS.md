# Knowledge-as-Flashcards (design doc "Feature D")
Files: FlashcardEnrollmentService.java, FlashcardReviewService.java, FlashcardSpreadService.java, FlashcardBankruptcyService.java, FlashcardReviewSettingsService.java, ../FriendControllers/FlashcardReviewController.java, ../FriendEntities/FriendKnowledgeReview.java, ../FriendEntities/FlashcardReviewSettings.java, ../FriendEntities/Friend.java (`flashcardsEnabled` field), ../FriendRepositories/FriendKnowledgeReviewRepository.java, ../FriendRepositories/FlashcardReviewSettingsRepository.java, OutboxWriteService.java (`applyAddKnowledge` enrollment hook), FsrsService.java (shared math, see below)

This ports the exact same FSRS-6 math as [FLOWS.md](FLOWS.md) (`FsrsService` — same class, same `initialState`/`review`/`forget`/`intervalDays`) to a **second, independent purpose**: quizzing yourself on logged `FriendKnowledge`/`GroupKnowledge` facts, Anki-style. This is a completely separate memory state from `Friend.fsrsStability`/`fsrsDifficulty` (which drive *when to contact someone*, see FLOWS.md's `ReviewService`). Nothing here reads or writes those fields, and nothing in FLOWS.md's scheduling path reads or writes `FriendKnowledgeReview`. There is deliberately **no bandit** on this side — no arm/multiplier, no reward signal, just FSRS interval math and two lapse jobs.

Ported (mechanism, not exact numbers) from ObsidianOptimizer's `SpreadService`/`BankruptcyService` — see each service's own javadoc for the OO lineage.

## The pieces

```
FriendKnowledgeReview   — one row per (friend "folder", source fact). SourceType = FRIEND | GROUP.
  A FRIEND row's fact = a FriendKnowledge row this friend owns.
  A GROUP row's fact  = a GroupKnowledge row inherited via group membership.
  A GroupKnowledge fact reviewed under two different members' folders is
  intentionally TWO independent rows — shared context recalled per-relationship,
  not deduped "group trivia" (explicit design call-out, see entity javadoc).
  Own fsrsStability/fsrsDifficulty/lastReviewedDate/dueDate — independent per row.

Friend.flashcardsEnabled (Boolean, default false)   — the "star" toggle.
  Gates: enrollment triggers, review-queue visibility (queries filter on this),
  and OutboxWriteService.applyAddKnowledge's auto-enroll hook.

FlashcardReviewSettings   — single-row singleton (id=1), seeded on first read:
  maxDailyReviews=30, chronicNeglectDays=7, bankruptcyLimit=200
```

## Star / enroll / un-star / re-star

```
FlashcardEnrollmentController: PUT /flashcards/friends/{id}/star  {enabled: bool}
  → FlashcardEnrollmentService.setFlashcardsEnabled(friendId, enabled)

enabled=true, first time ever (flashcardsEnabled was false, no existing rows):
  friend.flashcardsEnabled = true
  enrollFriend(friendId)   — creates a review row (dueDate=today) for every
                              personal FriendKnowledge fact + every GroupKnowledge
                              fact from every group this friend belongs to
                              (join via GroupMemberRepository), skipping any
                              that already have a row (idempotent)

enabled=true, RE-star (flashcardsEnabled was false, rows already exist from before):
  relapseOnRestar(existing rows)   — the off period counts as a lapse:
     for every row that has prior FSRS state (skips never-reviewed rows —
     nothing to lapse, they're still just sitting at their enrollment due date):
        fsrs.forget(state, elapsedDays since lastReviewedDate/dueDate)
        newDue = today + fsrs.intervalDays(lapsed.stability, DESIRED_RETENTION)
        lastReviewedDate reset to today (same anchor-reset reasoning as
        FsrsNeglectService/FlashcardBankruptcyService — avoids double-counting
        the gap on the next real grade)
  friend.flashcardsEnabled = true
  enrollFriend(friendId)   — picks up any facts added while un-starred

enabled=false (un-star):
  friend.flashcardsEnabled = false   — ONLY this. Rows are never deleted.
  Review queue/folder queries are all filtered on flashcardsEnabled=true,
  so un-starring just hides the rows; re-starring later resurrects them
  (through the relapse path above, not a fresh enrollment).
```

**Ongoing enrollment, not just the star click:** `OutboxWriteService.applyAddKnowledge()` calls `FlashcardEnrollmentService.enrollFriend(friendId)` whenever new `FriendKnowledge` is logged for an already-starred friend, so new facts about a starred friend show up as flashcards without having to un-star/re-star.

**Known gap, documented not fixed:** a new `GroupKnowledge` fact added to a group *after* a member is already starred does not auto-enroll into that member's folder — only personal `FriendKnowledge` creation is hooked (`applyAddKnowledge` lives in `friend`, group-side knowledge creation lives in `group`, and `group` can't depend back on `friend` without a module cycle since `friend` already depends on `group` for enrollment reads). It re-syncs on the next re-star, or would need a scheduled reconciliation pass to close for real.

## Quiz / reveal / grade

```
FlashcardReviewController:
  GET  /flashcards/folders            → FlashcardReviewService.getFolders()
       every starred friend + due/total counts (folder list + empty state)
  GET  /flashcards/queue              → getTodayQueue()
       rows across ALL starred friends with dueDate <= today
       (FlashcardSpreadService already wrote overflow forward, so this is
       just "what's due today", no extra client-side capping needed)
  GET  /flashcards/folders/{friendId} → getFolder(friendId)
       one friend's WHOLE deck, due or not — browsing bypasses the daily cap
       (like Anki's Browse mode)
  POST /flashcards/{reviewId}/grade   {grade: 2|3|4}  → gradeCard(reviewId, grade)
       2=HARD, 3=GOOD, 4=EASY (FsrsService.GRADE_HARD/GOOD/EASY) — no "Again"
       exposed to the user; that grade only reaches this row via forget()
       from the nightly bankruptcy job, same rule as FLOWS.md's ReviewService.
       first grade on a row  → fsrs.initialState(grade)
       later grades          → fsrs.review(priorState, grade, elapsedDays)
       dueDate = today + fsrs.intervalDays(newStability, DESIRED_RETENTION)
       DESIRED_RETENTION = 0.9, a fixed constant (FlashcardEnrollmentService),
       deliberately NOT RoleProperties' per-role retention — that knob tunes
       "how often you want to CONTACT someone" (a relationship-rhythm axis),
       a different question from "how reliably do you want to remember a
       fact about them."
```

## Nightly jobs (ChronoJobService, same cron slot as FLOWS.md's FsrsNeglectService)

```
ChronoJobService.applyDailyDecay()  [chrono, cron "0 0 0 * * ?"]
  ... Pass A: EMA decay, Pass B: FsrsNeglectService (both FLOWS.md's concern) ...
  Pass C (this feature, order matters — runs AFTER the above):
    settings = FlashcardReviewSettingsService.get()
    FlashcardBankruptcyService.run(bankruptcyLimit, chronicNeglectDays)
    FlashcardSpreadService.run(maxDailyReviews)
```

**Why bankruptcy runs before spread:** bankruptcy redistributes its own lapsed rows via least-loaded-day picks; spread then enforces the global daily cap across the WHOLE pool afterward, including whatever bankruptcy just rescheduled — running them in the other order would let spread cap a day's load, then have bankruptcy dump a fresh pile back onto it uncapped.

```
FlashcardBankruptcyService.run(bankruptcyLimit, chronicNeglectDays)
  scan every row across every starred friend, split overdue rows into:
    chronic  = daysOverdue > chronicNeglectDays   (always lapsed, no threshold)
    standard = overdue but within chronicNeglectDays

  Pass 1 (always): lapseAndReschedule() every chronic row
     — never-reviewed-but-overdue rows are bootstrapped from
       fsrs.initialState(GRADE_HARD) before forget() (treats "never even
       attempted, now overdue" as at least as bad as a first Hard grade,
       so a long-neglected new card doesn't sit on a stale due date forever)

  Pass 2 (threshold gate): if (chronic.size + standard.size) >= bankruptcyLimit:
     BANKRUPTCY DECLARED — lapseAndReschedule() every remaining standard row too

  lapseAndReschedule(row):
     fsrs.forget(priorState, elapsedDays)
     newDue = leastLoadedDate(today+1 .. today+intervalDays)   — spreads lapses
              across the window instead of piling everyone onto day 1
     lastReviewedDate reset to today (anchor-reset, avoids double-counting
     the neglected gap on the row's next real grade)

  No reward/penalty beyond the lapse itself in either pass — neglect and
  bankruptcy are exogenous (you didn't review), not evidence a difficulty/
  interval estimate was wrong. There's no bandit in this feature at all, so
  there's nothing else to skip.

FlashcardSpreadService.run(maxDailyReviews)
  pool EVERY starred friend's rows together (one global cap, not per-friend)
  bucket rows by day-offset from today; for any day over maxDailyReviews:
     sort that day's rows HARDEST-first (highest fsrsDifficulty stays put;
     easiest rows spill to the next day) — a never-reviewed row (null
     difficulty) sorts as mid-difficulty (5.0/10), neither protected nor
     sacrificed first
     cascade overflow forward day by day until every day fits the cap
  only touches dueDate — never fsrsStability/fsrsDifficulty (same
  "spread reshuffles scheduling, never touches memory state" separation OO's
  version documents)
```

## Settings

```
GET/PUT /flashcards/settings → FlashcardReviewSettingsService.get()/update(...)
  single row (id=1), seeded on first read with maxDailyReviews=30,
  chronicNeglectDays=7, bankruptcyLimit=200 — live-editable from the
  Settings page, read fresh by ChronoJobService every night (no caching,
  no restart needed to pick up a change)
```

## Frontend

```
react/src/components/pages/FlashcardReviewPage/FlashcardReviewPage.tsx
  Sidebar: "Today" (queue, GET /queue) + one entry per starred friend folder
           (GET /folders for counts, GET /folders/{id} for a folder's full deck)
  Card:    fact text → "Reveal" button → RatingPicker (Hard/Good/Easy only,
           no Again) → POST /{reviewId}/grade → advance cursor; on deck
           exhaustion, reload both folders (counts) and the deck (in case
           grading moved this card's due date, e.g. an Easy pushing it out
           of "today")

react/src/services/api/flashcardService.ts
  Thin fetch wrappers over FlashcardReviewController's six endpoints,
  hitting API_BASE.FRIEND + /flashcards (routed through PathPrefixConfig).

react/src/components/pages/ProfilePage/ProfilePage.tsx
  Star icon (★/☆) next to the friend header — PUT .../star toggles
  friend.flashcardsEnabled; optimistic UI update, reverted on failure.

react/src/components/pages/SettingsPage/SettingsPage.tsx
  Form for maxDailyReviews / chronicNeglectDays / bankruptcyLimit, backed by
  GET/PUT /flashcards/settings.
```

No dedicated FLOWS.md for `FlashcardReviewPage/` — this repo's convention is page-level React components don't carry their own FLOWS.md (none of the other 14 `pages/*` do either); frontend flows for a backend-driven feature like this are documented alongside the backend doc instead.

## Technology Notes

- **Two fully independent FSRS states share one `FsrsService` class.** `Friend.fsrsStability`/`fsrsDifficulty` (contact scheduling, FLOWS.md) and `FriendKnowledgeReview.fsrsStability`/`fsrsDifficulty` (fact recall, here) never interact — same weights array, same curves, two completely separate "how well is this memory holding up" tracks. A future maintainer touching `FsrsService.W`/`DECAY` changes both features at once, whether that's intended or not.
- **No bandit on this side, on purpose.** Contact scheduling has a bandit because the "right" interval multiplier is genuinely uncertain and worth learning from outcomes; flashcard-recall intervals just use FSRS's own predicted-retention math directly (`intervalDays(stability, 0.9)`), same as vanilla FSRS/Anki. Don't expect `BanditArm`/`BanditService` to show up anywhere in this file's call graph — it doesn't.
- **`DESIRED_RETENTION = 0.9` is a hardcoded constant** (`FlashcardEnrollmentService.DESIRED_RETENTION`), not read from `RoleProperties` or any settings row. Changing it means a code change + redeploy, unlike `maxDailyReviews`/`chronicNeglectDays`/`bankruptcyLimit`, which are live-editable via `/flashcards/settings`.
- **Un-starring never deletes data.** All history (every `FriendKnowledgeReview` row, its FSRS state) survives a star/un-star cycle indefinitely; the only effect is queue visibility. There is currently no way to actually delete a friend's flashcard history short of deleting the underlying `FriendKnowledge`/`GroupKnowledge` facts themselves (which orphans the row — see `FlashcardReviewService.toDtos()`'s `"(deleted fact)"` fallback text).
- **Re-starring is a deliberate lapse, not a free pass.** `relapseOnRestar()` runs `fsrs.forget()` on every previously-reviewed row before re-enrollment, so a long break shows up as a real difficulty/stability hit next time you review — same "the off period counts against you" philosophy as `FsrsNeglectService`'s chronic-neglect pass in FLOWS.md, just triggered by a manual toggle instead of a nightly cron.
- **`FriendKnowledgeReview.sourceKnowledgeId` is not a foreign key.** It's a plain int that means "FriendKnowledge.id" or "GroupKnowledge.id" depending on `sourceType`, deliberately not an FK constraint since those two tables live in different Maven modules (friend/group) and this keeps them independently deletable — the tradeoff is `toDtos()` has to do the id→entity join manually per source type and tolerate a miss (deleted fact) rather than the DB enforcing referential integrity.
- **`friend` now depends on `group` at the Maven level** (see `friend/pom.xml`) purely so `FlashcardEnrollmentService`/`FlashcardReviewService` can read `GroupKnowledge`/call `GroupKnowledgeRepository`/`GroupMemberRepository` directly — same-JVM plain bean calls, same pattern `chrono` already uses for its own `friend` dependency, not a new architectural style. This is a new module edge introduced by this feature; it did not exist before Feature D.
- **Bankruptcy's `leastLoadedDate` tie-break uses `java.util.Random`**, not seeded — nightly reschedule spread is deliberately non-reproducible run to run, same as `FsrsNeglectService`'s equivalent in FLOWS.md.

## Change Index

| Want to change… | Where |
|---|---|
| Daily review cap, chronic-neglect window, bankruptcy threshold | `FlashcardReviewSettings` row via `PUT /flashcards/settings` (live, no redeploy) — defaults in `FlashcardReviewSettingsService` |
| Fixed retention target for fact recall (currently 0.9, hardcoded) | `FlashcardEnrollmentService.DESIRED_RETENTION` (code change + redeploy) |
| What counts as "the reviewable deck" for a friend | `FlashcardEnrollmentService.enrollFriend()` (personal `FriendKnowledge` ∪ group-inherited `GroupKnowledge`) |
| Star/un-star/re-star behavior, including the re-star lapse | `FlashcardEnrollmentService.setFlashcardsEnabled()` / `relapseOnRestar()` |
| Auto-enroll-on-new-fact hook | `OutboxWriteService.applyAddKnowledge()` (checks `friend.flashcardsEnabled`) |
| Quiz queue / folder browsing / grading | `FlashcardReviewService` (`getTodayQueue`, `getFolder`, `getFolders`, `gradeCard`) |
| Which day overflow rows land on when a day is over the cap | `FlashcardSpreadService.run()` (hardest-stays-first sort, `UNREVIEWED_DIFFICULTY`) |
| Chronic-neglect / mass-bankruptcy lapse logic | `FlashcardBankruptcyService.run()` / `lapseAndReschedule()` / `leastLoadedDate()` |
| Nightly wiring + run order vs. contact-scheduling's own nightly lapse | `ChronoJobService.applyDailyDecay()` (Pass C, after Pass A/B) |
| HTTP surface | `FlashcardReviewController` (`/flashcards/**`) |
| Where fact-review state actually lives | `FriendKnowledgeReview` entity; `Friend.flashcardsEnabled` gates visibility |
| Frontend review UI | `react/.../FlashcardReviewPage/FlashcardReviewPage.tsx`, `react/src/services/api/flashcardService.ts` |
| Star toggle UI | `react/.../ProfilePage/ProfilePage.tsx` (★/☆ icon) |
| Settings UI | `react/.../SettingsPage/SettingsPage.tsx` |
