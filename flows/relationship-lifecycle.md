# Flow: The Relationship Lifecycle (log interaction → health → reminder → decay)

The **core CRM loop**. What the whole product is about: you meet someone, you log it, the system scores the relationship's "health" and schedules the next contact, surfaces who's due this week, and quietly lets neglected relationships decay so they resurface. This one loop spans **UI → nginx → friend → Postgres** on the write side and **chrono → nginx → friend → Postgres** on the nightly side.

Protos for mechanics: [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [chrono](../chrono/src/main/java/com/communicator/chrono/PROTO.md) · [nginx spine](../nginx/PROTO.md)

---

## Stage 1 — Log an interaction ("I talked to X")

The single most important write. Today this is the **legacy MPA** page `updateForm/talkedForm` (React's version is a [scaffold](../react/src/PROTO.md)).

```
User fills "talked to" form (experience stars, duration, new facts) and submits
 → browser POSTs to  http://localhost:8090/api/friend/talkedToFriend/{id}
 → nginx  location /api/friend/  ─ strips prefix ─►  friend:8085/talkedToFriend/{id}
 → FriendController.updateFriend(id, friend)                         [friend proto §Log an interaction]
     setMeetingTime(experience, TODAY)  →  plannedSpeakingTime
        "*" → +1 day    "**" → +1 week    else → +1 month
     friendService.updateFriend(id, friend)     — merge name/exp/dob/plannedTime, save+flush
     analyticsService.saveAll(analytics, id)    — append Analytics rows …
        └─► EmaUpdateService.updateEmaOnNewAnalytics(...)  PER ROW  ── EMA goes UP
              skip if date in future or >12 days old
              alpha = EmaProperties.getNewDataAlpha(exp)  · timeDecay = e^(-0.1·daysAgo)
              averageFrequency/Duration/Excitement recomputed, friend saved
              (throws on error → whole interaction rolls back)
     knowledgeService.saveAll(knowledges, id)   — append new facts
 → 200 OK
```

**Achieves:** the friend now has an updated "health" (3 EMAs), a freshly scheduled `plannedSpeakingTime`, new interaction history, and new facts (which later feed the [knowledge-RAG flow](knowledge-rag.md)).
**To change scheduling cadence:** `FriendService.setMeetingTime()`. **To change how a meeting moves health:** `EmaProperties` + `EmaUpdateService`.

---

## Stage 2 — "Who do I contact this week?" (the home screen)

```
User opens home  →  GET /api/friend/thisWeek  → nginx → friend:8085/thisWeek
 → FriendService.findThisWeek()                                     [friend proto §This week]
     loads ALL friends, keeps a friend if:
        birthday falls in [Mon..Sun]   OR   plannedSpeakingTime ≤ Sunday (due/overdue)
 → List<FriendDTO> (controller flags isBirthdayThisWeek) → rendered list
```

**Achieves:** the actionable list. Note it keys off `plannedSpeakingTime` (set in Stage 1), **not** the EMA — the EMA is a *health signal*, the planned date is the *scheduler*. Overdue friends never age out until you log an interaction (Stage 1) and reschedule them.

---

## Stage 3 — Nightly decay (the loop closes)

Every midnight, chrono lowers the health of everyone you *didn't* talk to yesterday, so cooling relationships trend toward 0 and (eventually, if the product used EMA for surfacing) resurface.

```
@Scheduled(cron "0 0 0 * * ?")  ChronoJobService.applyDailyDecay()   [chrono proto]
 → GET  http://nginx/api/friend/friends/count                (chrono calls friend THROUGH nginx)
 → per page (size 500):
     GET  /api/friend/friends/chrono/page/{p}/size/{s}   → List<FriendSummary>(id,name,3 EMAs)
     POST /api/friend/batch-interaction-check?date=yesterday → ids who DID interact
     for each friend NOT in that set:
        newEma = currentEma * (1 - 0.2)     ← hardcoded "good" alpha, ignores real rating
        PUT /api/friend/updateAverages  → FriendService.updateMovingAverages()  → Postgres
```

**Achieves:** relationship health decays with silence. Combined with Stage 1 (health rises on contact), the three EMAs are a live "closeness" signal per friend.

**⚠ Cross-flow caveat (from the protos):** the "EMA" is computed in **four** places with **different** formulas/coefficients — friend `EmaUpdateService` (up), chrono `applyDecayToFriend` (down, rating ignored) + the unwired `MovingAverageCalculationService`, plus `analytics.js` and the `knowledgeMCP` tool. So the number a user sees depends on which path last touched it. See the [code-reuse report](../CODE_REUSE_REPORT.md).

---

## The loop, in one picture

```
        ┌──────────────── you meet someone ────────────────┐
        ▼                                                   │
  POST talkedToFriend  → EMA↑ + reschedule plannedTime      │
        │                                                   │
        ▼                                                   │
  GET thisWeek surfaces due/overdue + birthdays  ───────────┘   (you act → back to top)
        ▲
        │  (silence)
  nightly chrono decay: EMA↓ for anyone not talked to
```

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| What "logging an interaction" does | `FriendController.updateFriend` / `talkedToFriend/{id}` |
| Next-contact cadence | `FriendService.setMeetingTime()` |
| How a meeting raises health | `EmaProperties` + `EmaUpdateService` (friend) |
| How silence lowers health | `ChronoJobService.applyDecayToFriend()` + `application.yml chrono.coefficients.decay` |
| Nightly schedule | `ChronoJobService.@Scheduled(cron)` (hardcoded — not the yaml) |
| Weekly list inclusion rule | `FriendService.findThisWeek()` |
| Unify the 4 EMA copies | see [CODE_REUSE_REPORT.md](../CODE_REUSE_REPORT.md) |
