// Shared timeline range defs — TrendsPanel (per-friend) and InsightsPage
// (cross-friend) both drive the same range pills off this one list.
export const ANALYTICS_RANGES = [
  { value: '1M', label: '1M', days: 30 },
  { value: '3M', label: '3M', days: 90 },
  { value: '6M', label: '6M', days: 180 },
  { value: '1Y', label: '1Y', days: 365 },
  { value: 'All', label: 'All', days: 3650 },
];

// The EMA recompute that used to live here (computeAnalyticsSeries) is
// retired — it independently re-derived the same day-by-day walk the
// backend's EmaUpdateService/ChronoJobService already compute, and could
// drift from them (different alpha shape, no proximity signal). Callers now
// fetch the server-computed series directly: see
// services/api/friendService.ts's getFriendAnalyticsSeries, backed by
// FriendAnalyticsController.getAnalyticsSeries /
// AnalyticsService.computeSeries (friend module), which uses the same
// EmaMathService/EmaProperties the other two EMA call sites use.
