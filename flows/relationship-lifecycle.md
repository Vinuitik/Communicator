# Flow: The Relationship Lifecycle (log interaction → health → reminder → decay)

The **core CRM loop**. What the whole product is about: you meet someone, you log it, the system scores the relationship's "health" and schedules the next contact, surfaces who's due this week, and quietly lets neglected relationships decay so they resurface. This one loop spans **UI → nginx → friend → Postgres** on the write side and **chrono → friend → Postgres** on the nightly side — chrono and friend have run in the same JVM since the JVM-monolith merge, so the nightly side has no nginx hop despite the module boundary.

Protos for mechanics: [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [chrono](../chrono/src/main/java/com/communicator/chrono/PROTO.md) · [nginx spine](../nginx/PROTO.md)

Deep dive on the scheduler itself (FSRS-6 + Thompson-sampling bandit — the part that actually picks `plannedSpeakingTime`): [FriendService/FLOWS.md](../friend/src/main/java/communicate/Friend/FriendService/FLOWS.md)

**Sibling flow:** [meeting-scheduling.md](meeting-scheduling.md) covers how this scheduling decision now *surfaces* — the home screen described in Stage 2 below has moved off `plannedSpeakingTime` reads entirely, onto a `Meeting` row per subject (Friend/Group/Connection). This doc still owns the actual scheduling math (Stage 1); meeting-scheduling.md owns the UI-facing week board, Group batch-logging, and Connection outcome logging.

---

## Stage 1 — Log an interaction ("I talked to X")

The single most important write. Today this is the **legacy MPA** page `updateForm/talkedForm` (React's version is a [scaffold](../react/src/PROTO.md)). Both the live HTTP call and the offline-outbox mailbox consumer funnel through the same `OutboxWriteService.applyTalkedToFriend()`, so scheduling behaves identically whether the write lands immediately or syncs later.

```
User fills "talked to" form (experience stars, duration, in-person?, new facts) and submits
 → browser POSTs to  http://localhost:8090/api/friend/talkedToFriend/{id}
 → nginx  location /api/friend/  ─ strips prefix ─►  friend:8085/talkedToFriend/{id}
 → FriendController.updateFriend(id, friend)                         [friend proto §Log an interaction]
 → OutboxWriteService.applyTalkedToFriend(id, friend, requestId)      — idempotency-ledger checked first
     friendService.updateFriend(id, friend)     — merge name/exp/dob, save+flush
     analyticsService.saveAll(analytics, id)    — append Analytics rows …
        └─► EmaUpdateService.updateEmaOnNewAnalytics(...)  PER ROW  ── EMA goes UP (health/visualization only)
              skip if date in future or >12 days old
              alpha = EmaProperties.getNewDataAlpha(exp)  · timeDecay = e^(-0.1·daysAgo)
              averageFrequency/Duration/Excitement recomputed, friend saved
              (throws on error → whole interaction rolls back)
     knowledgeService.saveAll(knowledges, id)   — append new facts
     reviewService.reviewInteraction(friend, durationHours, experience, inPerson, interactionDate)
        1. delayed bandit reward for the PREVIOUS scheduling decision (skipped on a friend's first review):
             recalled = grade != HARD
             rawEffective = actualElapsedDays / (scheduledDays / pendingBanditArm)
             BanditService.reward(pendingBanditBucket, rawEffective, recalled)   — Beta update, discounted 0.97
             on/before due date → LeechService.recordHit()  ·  after due date → recordMiss() (3 misses = leech-flagged)
        2. GradeComputationService.computeGrade(durationHours, experience, inPerson)
             → HARD / GOOD / EASY   (weighted duration+intensity, ×1.15 if in-person, banded at 0.40/0.70)
        3. FsrsService.review(prior stability/difficulty, grade, elapsedDays)  — FSRS-6 math, verbatim port
             (first-ever review → FsrsService.initialState(grade) instead)
        4. BanditService.bucket(difficulty, stability) → one of 4 cells (2 stability × 2 difficulty)
           BanditService.chooseArm(bucket)             → Thompson-sample the best interval multiplier
             ARMS = {0.85, 1.0, 1.25, 1.5, 2.0}
           dueDate = interactionDate + round(FsrsService.intervalDays(stability, desiredRetention) × arm)
        5. friend.fsrsStability/fsrsDifficulty/lastInteractionDate/pendingBanditArm/pendingBanditBucket updated
        6. ExplanationService — deterministic template ("Suggesting {date} for {name} — …"), optionally
           polished into one sentence by host-wrapper LLM (never blocks on failure) → friend.schedulingExplanation
     friendService.save(friend)  — persists the new plannedSpeakingTime + FSRS/bandit state + explanation
 → 200 OK
```

**Achieves:** the friend now has an updated "health" (3 EMAs, display-only), a freshly scheduled `plannedSpeakingTime` chosen by FSRS+bandit (not the EMAs), new interaction history, new facts (feed the [knowledge-RAG flow](knowledge-rag.md)), and a human-readable reason for the chosen date.

**Note — desiredRetention is per-role**, not a single global constant: `RoleProperties` (`fsrs.role.desired-retention` in `application.yml`) maps a friend's `role` (Partner/Close/Casual/Family, free-form string) to a target retention probability; unknown/missing role falls back to `fsrs.desired-retention` (default 0.9).

**Deliberately NOT implemented:** the original design called for the bandit's reward signal to come from automated speech/tone analysis (Modulate). That integration was never built — the grade instead comes entirely from the manually-entered form fields (duration, experience stars, in-person flag) via `GradeComputationService`.

**To change scheduling cadence:** `ReviewService.reviewInteraction()` (glue) / `FsrsService` (interval math) / `BanditService` (multiplier + bucket cutoffs) / `RoleProperties` (per-role retention target). **To change how a meeting moves the (cosmetic) health EMAs:** `EmaProperties` + `EmaUpdateService`. **To change the grade formula:** `GradeComputationService`.

---

## Stage 2 — "Who do I contact this week?"

**No longer the home screen's own query.** `GET /api/friend/thisWeek` / `FriendService.findThisWeek()`
still exist and still work exactly as described below, but as of the Meeting-scheduling feature
(see [meeting-scheduling.md](meeting-scheduling.md)) the actual home screen (`HomePage`, route `/`)
reads `GET /api/meetings/thisWeek` (the `meeting` module) instead — a `Meeting` row per subject
(Friend/Group/Connection/Birthday), not a Friend-only, `plannedSpeakingTime`-only list. A Friend's
`plannedSpeakingTime` still drives what the board shows, just indirectly: `ReviewService` sets it
(Stage 1), which publishes `FriendRescheduledEvent`, which `meeting`'s `MeetingService` listens for to
upsert that friend's `FSRS_PROPOSED` `Meeting` row — see meeting-scheduling.md Stage 5 for that seam.

This endpoint's remaining live callers are narrower widgets: `FriendsPage`'s week-chip filter and
`InsightsPage`'s KPI strip (`getFriendsThisWeek`) — both Friend-list views where a flat
`plannedSpeakingTime` scan is still exactly what's wanted.

```
GET /api/friend/thisWeek  → nginx → friend:8085/thisWeek
 → FriendService.findThisWeek()                                     [friend proto §This week]
     loads ALL friends, keeps a friend if:
        birthday falls in [Mon..Sun]   OR   plannedSpeakingTime ≤ Sunday (due/overdue)
 → List<FriendDTO> (controller flags isBirthdayThisWeek) → rendered list
```

**Achieves:** the actionable list. Note it keys off `plannedSpeakingTime` (set in Stage 1), **not** the EMA — the EMA is a *health signal*, the planned date is the *scheduler*. Overdue friends never age out until you log an interaction (Stage 1) and reschedule them.

---

## Stage 3 — Nightly decay (the loop closes)

Every midnight, chrono runs **two independent passes** in the same job: the legacy EMA decay (cosmetic health) and the FSRS chronic-neglect lapse (the actual scheduler's overdue handling). They don't talk to each other.

```
@Scheduled(cron "0 0 0 * * ?")  ChronoJobService.applyDailyDecay()   [chrono proto]

 Pass A — EMA decay (display-only health). Same JVM as friend since the JVM-monolith merge —
 every step below is a direct injected-bean call (ChronoJobService holds FriendService/
 AnalyticsService fields), NOT an HTTP round-trip through nginx like it used to be:
 → friendService.getFriendsCount()
 → per page (size 500):
     friendService.getFriendsPaginatedForChrono(page, size)        → List<ShortFriendDTO>(id,name,3 EMAs)
     analyticsService.getFriendsWithInteractionsOnDate(ids, yesterday) → ids who DID interact
     for each friend NOT in that set:
        newEma = currentEma * (1 - decayAlpha)   ← EmaProperties.getDecayAlpha(friend's last rating)
        friendService.updateMovingAverages(...)  → Postgres

 Pass B — FSRS chronic-neglect lapse (the real scheduler):
 → FsrsNeglectService.applyNightlyLapse()   — in-process, same JVM, no HTTP hop
     for each friend with FSRS state AND overdue by > 7 days (CHRONIC_NEGLECT_DAYS):
        FsrsService.forget(state, elapsedDays)     — stability collapses, difficulty jumps (lapse path)
        newDue = leastLoadedDate(today+1 .. today+intervalDays)   — spreads lapsed friends, no due-date pile-up
        friend.fsrsStability/fsrsDifficulty/lastInteractionDate/plannedSpeakingTime updated
        LeechService.recordMiss(friend)            — always a miss; contributes to 3-strikes leech flag
        NO bandit reward — a neglect lapse is exogenous (you didn't reach out), not evidence the interval was wrong
```

**Achieves:** two separate signals move independently. The EMAs are a cosmetic "closeness" number (Stage 1 raises it, Pass A lowers it) — they no longer drive scheduling. The actual due date (`plannedSpeakingTime`) is FSRS+bandit state, set in Stage 1 and, if you go silent for over a week past due, force-lapsed and rescheduled by Pass B here — independent of what the EMAs say.

**Resolved:** this flow used to warn that "EMA" was computed in four independently-drifting places (friend's up-path, chrono's down-path with a hardcoded rating-ignoring alpha, an unwired `MovingAverageCalculationService`, and a client-side recompute in `analyticsMath.ts`). That's fixed — `EmaMathService` is now the single shared arithmetic primitive both the up-path (`EmaUpdateService`) and down-path (`ChronoJobService.applyDecayToFriend`, which now also reads the real per-rating alpha via `EmaProperties.getDecayAlpha`) call into; `analyticsMath.ts`'s client-side recompute was retired in favor of a server-computed `GET analyticsSeries` endpoint. `knowledgeMCP`'s `calculate_friend_moving_averages` tool only reads the already-computed `average_*` fields (plus a plain non-EMA arithmetic mean for raw-data context) — it was never an independent EMA computation. See the [code-reuse report](../CODE_REUSE_REPORT.md) for the historical record of what this fixed.

---

## The loop, in one picture

```
        ┌──────────────── you meet someone ─────────────────────────┐
        ▼                                                            │
  POST talkedToFriend → EMA↑ (cosmetic) + FSRS/bandit reschedule     │
        │                    plannedTime (the real due date)         │
        ▼                                                            │
  GET thisWeek surfaces due/overdue + birthdays  ────────────────────┘   (you act → back to top)
        ▲
        │  (silence)
  nightly chrono job: Pass A EMA↓ (cosmetic) + Pass B FSRS force-lapse if >7d overdue (real reschedule)
```

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| What "logging an interaction" does | `OutboxWriteService.applyTalkedToFriend()` (called from `FriendController.talkedToFriend/{id}` and the offline-outbox mailbox consumer) |
| Next-contact cadence | `ReviewService.reviewInteraction()` / `FsrsService` / `BanditService` / `RoleProperties` — see [FriendService/FLOWS.md](../friend/src/main/java/communicate/Friend/FriendService/FLOWS.md) |
| How a meeting raises health | `EmaProperties` + `EmaUpdateService` (friend) |
| How silence lowers health | `ChronoJobService.applyDecayToFriend()` + `application.yml ema.coefficients.decay` |
| Nightly schedule | `ChronoJobService.@Scheduled(cron)` (hardcoded — not the yaml) |
| Weekly list inclusion rule (Friend-only widgets: FriendsPage/InsightsPage) | `FriendService.findThisWeek()` |
| Home screen's week board (all subject types) | `MeetingQueryService.thisWeek()` — see [meeting-scheduling.md](meeting-scheduling.md) |
| Shared EMA arithmetic (both up/down paths) | `EmaMathService` |
