// Generic read-through cache — the read-side counterpart to outbox.ts's write path, same
// tiering philosophy (server -> local -> Drive relay). One IndexedDB store (`cache`,
// db.ts) for every entity type, not one store per type: cacheKey is an OPAQUE string the
// caller builds, never assumed to be a single entity id — 'friend:42' (single), and just
// as validly 'friends:list' or 'meetings:2026-08-18..2026-08-24' (lists/ranges).

import { isServerReachable } from './connectivity';
import { getCache, putCache } from './db';
import { pullFromDrive } from './drivePull';

export async function readThrough<T>(cacheKey: string, fetchFn: () => Promise<T>): Promise<T> {
  if (await isServerReachable()) {
    try {
      const data = await fetchFn();
      await putCache(cacheKey, data);
      return data;
    } catch {
      // Server "reachable" (ping succeeded) but this specific fetch failed — fall through
      // to the cache/Drive tiers below, same handling as an unreachable server. Mirrors
      // outbox.ts's submit(): a transient failure on the direct call degrades gracefully
      // rather than surfacing to the caller.
    }
  }

  const cached = await getCache<T>(cacheKey);
  if (cached) return cached.data;

  const pulled = await pullFromDrive(cacheKey);
  if (pulled !== undefined) {
    await putCache(cacheKey, pulled);
    return pulled as T;
  }

  // Every tier missed (new device, evicted storage, never-synced bundle). Throw rather
  // than return undefined as T so TypeScript's return type stays honest — callers catch
  // this and render an empty state.
  throw new Error(`readThrough: no data available for "${cacheKey}" (server, cache, and Drive all missed)`);
}
