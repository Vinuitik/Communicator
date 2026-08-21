// Reachability probe for the offline-write outbox (outbox.ts).
//
// navigator.onLine is only a cheap short-circuit, never trusted alone — behind
// a reverse proxy / tunnel, "origin down" can be a resolved HTTP response
// (5xx), not a thrown network error, so resp.ok is checked explicitly.

import { API_BASE } from '../services/api/config';

export async function isServerReachable(timeoutMs = 2500): Promise<boolean> {
  if (!navigator.onLine) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${API_BASE.FRIEND}/ping`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}
