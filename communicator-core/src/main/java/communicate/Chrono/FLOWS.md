# Chrono Domain Flows

Files: ChronoJobService.java, MovingAverageCalculationService.java, ChronoProperties.java, ChronoController.java, AnalyticsEntry.java, FriendSummary.java, FriendUpdateRequest.java, EmaUpdateService.java, MeetingGenerationService.java, MeetingService.java, calendar.js, analytics.js

---

## 1. Scheduled Daily Decay (midnight cron)

`@Scheduled(cron)` → `ChronoJobService.applyDailyDecay()`

**Step 1 — Meeting generation:**
`ChronoJobService.applyDailyDecay()` → `MeetingGenerationService.generateMissingNextMeetingsForAllFriends()` → `FriendEventRepository.findByActiveTrue()` → for each active `FriendEvent`: `MeetingGenerationService.generateIfMissing()` → `MeetingRepository.existsByEventIdAndMeetingDateGreaterThanEqual()` → if no future meeting exists: `MeetingGenerationService.calculateNextOccurrence()` → `MeetingRepository.save(Meeting)` with status=`PLANNED`, source=`EVENT_AUTO`

To change recurrence logic: `MeetingGenerationService.calculateNextOccurrence()` — handles yearly (keepMeetingDate + recurrenceDays % 365) and day-based recurrence separately.
To change what "active event" means: `FriendEventRepository.findByActiveTrue()`, field `FriendEvent.active`.

**Step 2 — EMA decay:**
`ChronoJobService.applyDailyDecay()` → paginate all friends: `FriendRepository.count()` + `FriendRepository.findAll(PageRequest)` — page size from `ChronoProperties.friendService.friendPageSize` (default 500)

Per page: `AnalyticsRepository.findFriendIdsWithInteractionsOnDate(friendIds, yesterday)` → friends NOT in that set → `ChronoJobService.applyDecayToFriend(friend, yesterday)`

`applyDecayToFriend()` reads `ChronoProperties.coefficients.decay["good"]` as `decayAlpha` (default 0.2) → multiplies all three EMA fields by `(1 - decayAlpha)` → `FriendRepository.save(friend)`

To change decay rate per experience tier: `ChronoProperties.getDecayAlpha()` — maps `***` → `excellent`, `**` → `good`, `*` → `poor` keys in `chrono.coefficients.decay.*` config.
To change the page size for friend iteration: `ChronoProperties.friendService.friendPageSize` (env: `chrono.friend-service.friend-page-size`).
To change cron schedule: `chrono.schedule` property (default `0 0 0 * * ?`).

---

## 2. Manual Decay Trigger (HTTP)

`POST /chrono/trigger-decay` → `ChronoController.triggerManualDecay()` → `ChronoJobService.triggerManualDecay()` → `ChronoJobService.applyDailyDecay()` (same flow as above)

To add auth/guards to this endpoint: `ChronoController.triggerManualDecay()`.

---

## 3. EMA Recalculation on New Analytics (real-time, called from Friend domain)

`AnalyticsService.saveAll()` → `EmaUpdateService.updateEmaOnNewAnalytics(friendId, experience, hours, date)`

`EmaUpdateService.updateEmaOnNewAnalytics()`:
- Skips if `date` is in the future
- Skips if `daysDifference > 12`
- `EmaProperties.getNewDataAlpha(experience)` → base alpha (`ema.coefficients.new-data.*`)
- `EmaUpdateService.calculateTimeDecayFactor(daysDifference)` → `e^(-0.1 * days)` — decay constant hardcoded to 0.1
- `effectiveAlpha = baseAlpha * timeDecayFactor`
- EMA formula: `alpha * decayedValue + (1 - alpha) * currentEMA`
- `FriendRepository.save(friend)`

To change the staleness cutoff (12 days): `EmaUpdateService.updateEmaOnNewAnalytics()`, constant `daysDifference > 12`.
To change the time-decay rate: `EmaUpdateService.calculateTimeDecayFactor()`, constant `decayConstant = 0.1`.
To change base alpha per experience: `EmaProperties.getNewDataAlpha()` (config prefix: `ema.coefficients.new-data.*`).

---

## 4. MovingAverageCalculationService (utility, not scheduled independently)

`MovingAverageCalculationService.calculateMovingAverages(analyticsData, currentFreq, currentDur, currentExc, calculationDate)`

- Groups `AnalyticsEntry` records by date: totalDuration, frequency count, lastExperience
- Iterates day-by-day from earliest analytics date to `calculationDate`
- On days with data: `ChronoProperties.getNewDataAlpha(experience)` — alpha tiers: `***`=0.6, `**`=0.3, `*`=0.15
- On days without data: `ChronoProperties.getDecayAlpha(lastExperience)` — tiers: `***`=0.07, `**`=0.2, `*`=0.57
- Returns `MovingAverageResult(frequency, excitement, duration)`

To change EMA new-data alpha values: `ChronoProperties.getNewDataAlpha()` (hardcoded, not config-driven).
To change EMA decay alpha values: `ChronoProperties.getDecayAlpha()` — reads `chrono.coefficients.decay.*`.

Note: This service mirrors the algorithm in `analytics.js` `exponentialMovingAverageWithAlphaArray()`. Keep them in sync if changing the alpha model.

---

## 5. Calendar View (UI → Friend domain)

`calendar.js` DOMContentLoaded → `loadWeeklyCalendar()` → `GET /api/friend/thisWeek` → `FriendController.getWeekFriends()` → `FriendService.findThisWeek()` (returns friends with birthday this week OR `plannedSpeakingTime` <= this Sunday)

Rendered as weekly columns; clicking a friend box → `GET /api/friend/talked/{id}` (routes to update form).

To change "this week" filtering logic: `FriendService.findThisWeek()` and `FriendService.isBefore()`.

---

## 6. Analytics Chart View (UI)

`analytics.js` DOMContentLoaded → `GET /api/friend/shortList` → populates friend dropdown.

User clicks "Apply Filters" → `GET /api/friend/analyticsList?friendId=&left=&right=` → renders data table → `updateCharts(data)` → builds per-day alpha arrays using same experience→alpha mapping as backend → `exponentialMovingAverageWithAlphaArray()` → renders Chart.js graphs for duration, frequency, intensity.

Alpha constants in `analytics.js` (client-side mirror):
- New data: `***`=0.6, `**`=0.7, `*`=0.8
- Decay: `***`=0.07, `**`=0.2, `*`=0.57

Note: `analytics.js` new-data alphas (`**`=0.7, `*`=0.8) differ from `ChronoProperties.getNewDataAlpha()` (`**`=0.3, `*`=0.15) and `EmaProperties` (`**`=0.7). These are inconsistent. To unify: `ChronoProperties.getNewDataAlpha()`, `EmaProperties.getNewDataAlpha()`, and `analytics.js` `newDataAlpha`.

---

## Change Index

| Behaviour | Where to change |
|---|---|
| Cron schedule | `chrono.schedule` property (`ChronoProperties.schedule`) |
| Friend page size in decay loop | `chrono.friend-service.friend-page-size` (`ChronoProperties.FriendService.friendPageSize`) |
| Batch size for interaction check | `chrono.friend-service.batch-size` (`ChronoProperties.FriendService.batchSize`) |
| Decay alpha per experience tier | `chrono.coefficients.decay.*` → `ChronoProperties.getDecayAlpha()` |
| New-data alpha (MovingAverageCalculationService) | `ChronoProperties.getNewDataAlpha()` (hardcoded tiers) |
| New-data alpha (EmaUpdateService) | `ema.coefficients.new-data.*` → `EmaProperties.getNewDataAlpha()` |
| Historical data staleness cutoff | `EmaUpdateService.updateEmaOnNewAnalytics()` constant `12` |
| Time-decay factor for historical analytics | `EmaUpdateService.calculateTimeDecayFactor()` constant `decayConstant = 0.1` |
| Meeting auto-generation recurrence | `MeetingGenerationService.calculateNextOccurrence()` |
| What triggers meeting auto-generation | `MeetingGenerationService.generateIfMissing()`, field `FriendEvent.active` |
| Manual decay HTTP endpoint | `ChronoController.triggerManualDecay()` |
| Frontend EMA chart algorithm | `analytics.js` `exponentialMovingAverageWithAlphaArray()` |
| Frontend alpha constants | `analytics.js` `newDataAlpha` / `decayAlpha` maps |
| gRPC host/port (if used) | `ChronoProperties.Grpc` (`chrono.grpc.host`, `chrono.grpc.port`) |
