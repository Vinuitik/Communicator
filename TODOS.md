# TODOS

## PWA / Offline

### MEDIA_CACHE has no eviction — caused a real navigation-breaking bug

**What:** `service-worker.js`'s `MEDIA_CACHE` caches every friend photo/video
cache-first, forever, with no size cap or LRU pruning.

**Why:** Almost certainly the root cause of a live bug: a user's `caches.open()`
call started throwing (very likely `QuotaExceededError`) inside `handleNavigate()`,
and because that call sat outside the function's try/catch, the entire `/app/`
navigation failed with Chrome's generic "ServiceWorker intercepted the request and
encountered an unexpected error" — which also silently broke PWA installability,
since Chrome won't offer `beforeinstallprompt` on a site whose own service worker
errors on the start_url.

**Context:** Fixed defensively this session (service-worker.js `v3`): the whole
`handleNavigate()` body is now try/caught with real `console.error`/`console.warn`
logging, so a Cache Storage failure degrades to a live network fetch or a minimal
offline page instead of an unhandled rejection. That fix stops the CRASH, but does
NOT address the underlying unbounded growth — `MEDIA_CACHE` will keep growing and
can hit quota again. Real fix: add a size cap (e.g. evict oldest entries past N MB
or N items) or an LRU policy to `cacheFirst()`'s cache.put() path in
service-worker.js.

**Effort:** S–M
**Priority:** P1 (caused a real outage once already)
**Depends on:** None

### Staleness indicator for cached offline reads

**What:** Add a "last synced Xh ago" banner/indicator wherever `readCache.ts`'s
`readThrough()` serves a result from the local IndexedDB cache or a Drive-pulled
bundle instead of a live server fetch.

**Why:** Without it, offline data looks identical to fresh online data — a user
could act on days-old meeting/connection data with no visual cue it isn't current.
Trust issue, not a correctness issue (the data itself is still accurate as of
whenever it was cached).

**Context:** Surfaced during the offline-PWA plan review (see
`docs/designs/offline-pwa-plan.md`). Deferred because it's page-UI work layered
on top of the caching foundation, not blocking it — the `cache` IndexedDB store's
`ts` field (timestamp of when each entry was cached) already exists in that
plan's schema, so this TODO has what it needs the moment someone picks it up.
Natural implementation: a small shared banner component + `readThrough()` should
also return the `ts` alongside the data so pages can render it.

**Effort:** S
**Priority:** P2
**Depends on:** the offline-PWA plan's foundation lane (readCache.ts) landing first
