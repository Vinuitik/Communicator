# Relationship Scheduling — FSRS + Bandit
Files: ReviewService.java, FsrsService.java, BanditService.java, GradeComputationService.java, ExplanationService.java, LeechService.java, FsrsNeglectService.java, FsrsBackfillService.java, FsrsBackfillRunner.java, ../FriendEntities/Friend.java (fsrs*/pendingBandit*/leech fields), ../FriendEntities/BanditArm.java, ../FriendEntities/BanditArmId.java, ../FriendRepositories/BanditArmRepository.java, ../Config/RoleProperties.java

This is the code that decides `plannedSpeakingTime` — **not** the EMA health numbers (`average_*`), which are a separate cosmetic display signal (see [../PROTO.md](../PROTO.md) §EMA). Ported from ObsidianOptimizer's flashcard spaced-repetition system, re-domained from notes→friends. Entry point is `ReviewService.reviewInteraction()`, called from both `OutboxWriteService.applyTalkedToFriend()` (an existing friend's logged interaction — the delayed-reward/leech path applies) and `OutboxWriteService.applyAddFriend()` (a brand-new friend's first-ever interaction — no prior decision to reward, so `fsrs.initialState()` runs instead of `fsrs.review()`). Both paths run on the live HTTP call and the offline-outbox mailbox consumer identically — see [relationship-lifecycle flow](../../../../../../../flows/relationship-lifecycle.md) for where this sits in the bigger write path.

**Not implemented:** the original design wanted the bandit's reward signal to come from automated speech/tone analysis (Modulate). That was never built — grade comes entirely from manually-entered form fields.

## The four pieces, and how they compose

```
GradeComputationService.computeGrade(durationHours, experience, inPerson)
  → HARD(2) / GOOD(3) / EASY(4)         — never AGAIN(1), that grade only exists via FsrsService.forget()
     durationNorm  = minmax(durationHours, global min/max hours seen so far)
     intensityNorm = minmax(experienceToNumber(experience), 1.0, 3.0)   — the "*"/"**"/"***" star scale
     base = 0.5*durationNorm + 0.5*intensityNorm
     effective = min(1.0, base * (inPerson ? 1.15 : 1.0))
     band: <0.40 → HARD, <0.70 → GOOD, else → EASY

FsrsService  (FSRS-6 math, verbatim port of py-fsrs, no "Again"/lapse path from a real grade)
  first review:  initialState(grade)          → (stability=W[grade-1], difficulty=f(grade))
  later reviews: review(priorState, grade, elapsedDays)
     r = retrievability(elapsedDays, stability)      — recall probability decay curve
     newStability  = recallStability(difficulty, stability, r, grade)   — hard/easy grade multipliers baked in
     newDifficulty = nextDifficulty(difficulty, grade)                  — mean-reverts toward Easy's raw difficulty
  intervalDays(stability, desiredRetention) → days until predicted recall drops to that retention target
  forget(state, elapsedDays)  — separate lapse path, ONLY called by FsrsNeglectService, never from a real grade

BanditService  (Thompson Sampling over interval multipliers, 4 context buckets)
  bucket(difficulty, stability) = "{dEasy|dHard}:{sShort|sLong}"    — cut at difficulty 5.5, stability 90 days
  chooseArm(bucket)   — sample Beta(alpha,beta) for each arm in {0.85, 1.0, 1.25, 1.5, 2.0}, return the argmax
  reward(bucket, rawEffectiveMultiplier, recalled)
     arm = snapArm(rawEffectiveMultiplier)             — nearest grid value to how the friend was ACTUALLY contacted
     r = recalled ? arm/MAX_ARM : 0
     alpha' = 1 + 0.97*(alpha-1) + r   ·   beta' = 1 + 0.97*(beta-1) + (1-r)     — discounted Beta update
     persisted per (bucket, arm) in Postgres table bandit_arms (BanditArm/BanditArmId)

ReviewService.reviewInteraction(friend, durationHours, experience, inPerson, interactionDate)
  1. delayed reward for the PREVIOUS scheduling decision (skipped if this is the friend's first review):
       recalled = grade != HARD
       scheduledDays = daysBetween(lastInteractionDate, plannedSpeakingTime)
       baseInterval  = scheduledDays / pendingBanditArm          — reconstruct the FSRS-only interval
       rawEffective  = actualElapsedDays / baseInterval          — how the REAL gap compares to that base
       bandit.reward(pendingBanditBucket, rawEffective, recalled)
       on-time-or-early → LeechService.recordHit()  ·  late → recordMiss()
  2. grade = GradeComputationService.computeGrade(...)
  3. state = fsrs.review(priorState, grade, elapsedDays)     — or fsrs.initialState(grade) if no prior state
  4. bucket = bandit.bucket(state.difficulty, state.stability)  ;  arm = bandit.chooseArm(bucket)
     due = interactionDate + round(fsrs.intervalDays(state.stability, desiredRetention) * arm)
  5. friend.{fsrsStability, fsrsDifficulty, lastInteractionDate, pendingBanditArm, pendingBanditBucket} updated
  6. ExplanationService — deterministic template, best-effort LLM polish via host-wrapper (never blocks)
  returns `due` → caller (OutboxWriteService) persists it as friend.plannedSpeakingTime
```

**Why the reward is delayed one interaction, not immediate:** at scheduling time you only know the *predicted* interval; whether it was actually a good interval is only knowable once the next interaction happens (or doesn't). `pendingBanditArm`/`pendingBanditBucket` on `Friend` are exactly this — "the decision we're waiting to grade" — same pattern OO used for `NoteReviewRepository.pendingArm`.

**Per-role retention target:** `desiredRetention` isn't a single global constant — `RoleProperties` (`fsrs.role.desired-retention.<role>` in `application.yml`, e.g. Partner/Close/Casual/Family) resolves per `friend.role`; unset role or unknown key falls back to `fsrs.desired-retention` (default 0.9). Higher target → shorter intervals (recall probability must stay higher).

## Nightly neglect lapse (chrono cron, separate from the EMA decay pass)

```
ChronoJobService.applyDailyDecay()  [chrono, cron "0 0 0 * * ?"]
  Pass A: legacy EMA decay (see relationship-lifecycle flow) — cosmetic, unrelated to scheduling
  Pass B: FsrsNeglectService.applyNightlyLapse()   — in-process call, same JVM, no HTTP hop
    for each friend with FSRS state AND overdue by > 7 days (CHRONIC_NEGLECT_DAYS):
       fsrs.forget(state, elapsedDays)          — stability collapses, difficulty jumps (Again-grade path)
       newDue = leastLoadedDate(today+1..today+intervalDays)   — spreads lapses, avoids due-date pile-ups
       friend.{fsrsStability, fsrsDifficulty, lastInteractionDate, plannedSpeakingTime} updated
       LeechService.recordMiss(friend)          — always counts as a miss
       NO bandit reward — exogenous (you went silent), not evidence the interval itself was wrong
```

## Leech flagging

`LeechService` is just a counter: 3 consecutive misses (`recordMiss` from either `ReviewService` late-contact or `FsrsNeglectService` lapse) sets `friend.leech = true`; any on-time hit resets the counter to 0. No separate scheduling consequence yet — it's a signal for the UI to surface ("this friendship keeps drifting regardless of the interval we pick"), same idea as Anki flagging a flashcard as structurally broken.

## Cold-start backfill (existing friends predating this system)

```
FsrsBackfillRunner (ApplicationRunner, runs once per boot)
  → FsrsBackfillService.backfillAll()
     for each friend with fsrsStability == null AND >= 2 logged Analytics rows:
        fsrsStability  = mean gap in days between consecutive past interactions
        fsrsDifficulty = legacy average_excitement EMA (0-3), inverted onto FSRS's 1-10 scale
        lastInteractionDate = date of their most recent logged interaction
     friends with < 2 interactions are left alone — cold-start normally via initialState() on their next real review
```
Idempotent (skips anyone already seeded) and safe to leave running every boot — consistent with this codebase's `ddl-auto: update` convention of reconciling state at startup rather than a tracked one-shot migration.

## Technology Notes

- **Bandit posteriors are per-process-wide bucket, not per-friend.** All friends landing in the same (difficulty, stability) bucket share one Beta(alpha,beta) pair in `bandit_arms`. This is deliberate pooling (design premise: dozens of friends with weekly-at-best events is too data-starved for a per-friend bandit) but means one friend's unusual contact pattern nudges the multiplier every other friend in that bucket gets.
- **Discount factor 0.97 → effective memory ~33 observations** (`1/(1-0.97)`). Old rewards fade rather than accumulating forever, so the bandit can adapt if your actual rhythm changes — but also means a long-quiet stretch can "forget" a well-tuned bucket.
- **Grade normalization (`GradeComputationService.minmax`) is a *global* min/max over ALL logged interactions ever**, recomputed fresh on every single call via `AnalyticsRepository.findMinHours/findMaxHours` — not cached, not per-role. One extreme outlier interaction (a 10-hour hangout) permanently compresses the normalized range for every future grade until something more extreme happens. At current scale (dozens of friends, weekly-at-best) this is a live DB query per interaction, not a real cost concern — revisit only if that assumption changes.
- **All numeric cutoffs are starting guesses, explicitly flagged TBD in the source:** difficulty cutoff 5.5, stability cutoff 90 days, grade bands 0.40/0.70, in-person multiplier 1.15, chronic-neglect threshold 7 days, leech threshold 3 misses. None have been retuned against real usage data yet.
- **`ExplanationService` calls host-wrapper directly** (not through `ai_agent`) with an 8s timeout and silently falls back to the deterministic template on any failure — a down/misconfigured LLM never blocks or corrupts scheduling, it just loses the "polished sentence" flourish.
- **The reward-delay window is exactly one interaction, however long that takes.** If a friend goes 3 years without a logged interaction, the bandit reward for the decision made 3 years ago is still sitting in `pendingBanditArm`/`pendingBanditBucket`, waiting. It's ultimately deprived of any credit — `FsrsNeglectService`'s lapse path bypasses the bandit reward entirely rather than crediting a very-late one.

## Change Index

| Want to change… | Where |
|---|---|
| How duration/stars/in-person combine into a grade | `GradeComputationService` (weights, in-person multiplier, HARD/EASY band cutoffs) |
| FSRS-6 math itself (stability/difficulty curves) | `FsrsService` (weights array `W`, `DECAY`) — verbatim port, changing this diverges from py-fsrs |
| Per-role target retention (how aggressive scheduling is) | `RoleProperties` / `application.yml` `fsrs.desired-retention` + `fsrs.role.desired-retention.<role>` |
| Bandit interval multipliers or bucket boundaries | `BanditService.ARMS`, `STABILITY_CUTOFF_DAYS`, `DIFFICULTY_CUTOFF` |
| How fast the bandit forgets old rewards | `BanditService.DISCOUNT` |
| Delayed-reward / effective-arm attribution logic | `ReviewService.reviewInteraction()` step 1 |
| The "why this date" explanation text | `ExplanationService.explainTemplate()` (template) / `explainViaLlm()` (LLM polish, `host-wrapper.url`) |
| Chronic-neglect lapse threshold or day-spreading | `FsrsNeglectService.CHRONIC_NEGLECT_DAYS` / `leastLoadedDate()` |
| Leech-flag sensitivity | `LeechService.LEECH_THRESHOLD` |
| Cold-start backfill estimate for legacy friends | `FsrsBackfillService.averageGapDays()` / `difficultyFromExcitement()` |
| Where scheduling state actually lives | `Friend` entity: `fsrsStability`, `fsrsDifficulty`, `lastInteractionDate`, `pendingBanditArm`, `pendingBanditBucket`, `missedDueCount`, `leech` |
| Bandit posterior storage | Postgres table `bandit_arms` (`BanditArm`/`BanditArmId`/`BanditArmRepository`) |
