# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~2,633 words - fits in a single context window. You may not need a graph.

## Summary
- 59 nodes · 65 edges · 10 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Decay Job & Application Logic|Decay Job & Application Logic]]
- [[_COMMUNITY_Chrono Configuration Properties|Chrono Configuration Properties]]
- [[_COMMUNITY_EMA Metrics|EMA Metrics]]
- [[_COMMUNITY_Alpha Coefficients|Alpha Coefficients]]
- [[_COMMUNITY_Application Bootstrap|Application Bootstrap]]
- [[_COMMUNITY_HTTP Controller|HTTP Controller]]
- [[_COMMUNITY_Meeting Generation gRPC|Meeting Generation gRPC]]
- [[_COMMUNITY_Analytics Data Model|Analytics Data Model]]
- [[_COMMUNITY_Friend Summary Model|Friend Summary Model]]
- [[_COMMUNITY_Friend Update Request|Friend Update Request]]

## God Nodes (most connected - your core abstractions)
1. `Chrono Service` - 9 edges
2. `FriendServiceClient` - 8 edges
3. `Exponential Moving Average (EMA)` - 5 edges
4. `ChronoJobService` - 4 edges
5. `MovingAverageCalculationService` - 4 edges
6. `ChronoApplication` - 3 edges
7. `ChronoProperties` - 3 edges
8. `ChronoController` - 3 edges
9. `Friend Service` - 3 edges
10. `Real-time EMA Update` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Daily Decay Process` --conceptually_related_to--> `Chrono Service`  [EXTRACTED]
  chrono/README.md → chrono/README.md  _Bridges community 2 → community 3_

## Hyperedges (group relationships)
- **EMA-based Metrics Computed by Hybrid Approach** — readme_ema, readme_realtime_update, readme_daily_decay, readme_hybrid_approach [EXTRACTED 0.95]
- **Chrono Service Data Flow Pipeline** — readme_analytics_service, readme_friend_service, readme_chrono_service, readme_daily_decay [EXTRACTED 1.00]
- **Alpha Coefficients Configuration in application.yml** — readme_alpha_newdata, readme_alpha_decay, readme_application_yml [EXTRACTED 1.00]

## Communities

### Community 0 - "Decay Job & Application Logic"
Cohesion: 0.2
Nodes (2): ChronoJobService, FriendServiceClient

### Community 1 - "Chrono Configuration Properties"
Cohesion: 0.23
Nodes (5): ChronoProperties, Coefficients, FriendService, Grpc, MovingAverageCalculationService

### Community 2 - "EMA Metrics"
Cohesion: 0.29
Nodes (10): Average Duration Metric, Average Excitement Metric, Average Frequency Metric, Chrono Service, Exponential Moving Average (EMA), Friend Service, POST /chrono/health Endpoint, Hybrid Real-time + Daily Decay Architecture (+2 more)

### Community 3 - "Alpha Coefficients"
Cohesion: 0.33
Nodes (6): Decay Alpha Coefficients, newData Alpha Coefficients, Analytics Service, application.yml Configuration, Daily Decay Process, Real-time EMA Update

### Community 4 - "Application Bootstrap"
Cohesion: 0.5
Nodes (1): ChronoApplication

### Community 5 - "HTTP Controller"
Cohesion: 0.5
Nodes (1): ChronoController

### Community 6 - "Meeting Generation gRPC"
Cohesion: 0.67
Nodes (1): MeetingGenerationGrpcClient

### Community 7 - "Analytics Data Model"
Cohesion: 1.0
Nodes (1): AnalyticsEntry

### Community 8 - "Friend Summary Model"
Cohesion: 1.0
Nodes (1): FriendSummary

### Community 9 - "Friend Update Request"
Cohesion: 1.0
Nodes (1): FriendUpdateRequest

## Knowledge Gaps
- **10 isolated node(s):** `Coefficients`, `FriendService`, `Grpc`, `AnalyticsEntry`, `FriendSummary` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Decay Job & Application Logic`** (14 nodes): `ChronoJobService`, `.applyDailyDecay()`, `.applyDecayToFriend()`, `.triggerManualDecay()`, `FriendServiceClient`, `.getAllFriends()`, `.getFriendAnalytics()`, `.getFriendsCount()`, `.getFriendsPaginated()`, `.getFriendsWithInteractionsOnDate()`, `.hadInteractionOnDate()`, `.updateFriendAverages()`, `ChronoJobService.java`, `FriendServiceClient.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Application Bootstrap`** (4 nodes): `ChronoApplication`, `.main()`, `.objectMapper()`, `ChronoApplication.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Controller`** (4 nodes): `ChronoController`, `.health()`, `.triggerManualDecay()`, `ChronoController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Meeting Generation gRPC`** (3 nodes): `MeetingGenerationGrpcClient`, `.generateMissingNextMeetingsForAllFriends()`, `MeetingGenerationGrpcClient.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Data Model`** (2 nodes): `AnalyticsEntry`, `AnalyticsEntry.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Summary Model`** (2 nodes): `FriendSummary.java`, `FriendSummary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Update Request`** (2 nodes): `FriendUpdateRequest.java`, `FriendUpdateRequest`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Chrono Service` connect `EMA Metrics` to `Alpha Coefficients`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `Friend Service` connect `EMA Metrics` to `Alpha Coefficients`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Exponential Moving Average (EMA)` (e.g. with `Average Frequency Metric` and `Average Duration Metric`) actually correct?**
  _`Exponential Moving Average (EMA)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Coefficients`, `FriendService`, `Grpc` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._