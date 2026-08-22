/* Communicator — service worker (PWA).
 *
 * Hand-written (no Workbox/CRA PWA template) to keep this a plain add-on to the
 * existing CRA build — no new build dependency.
 *
 * Responsibilities:
 *   1. App shell — cache the SPA's entry HTML + manifest so it boots offline.
 *   2. Hashed assets (CRA's static/js, static/css) — stale-while-revalidate.
 *   3. Friend media (/api/fileRepository/...) — cache-first, since photos/files
 *      don't change once uploaded.
 *   4. Share target — intercept POST /app/share-target (OS share sheet sharing
 *      a photo/video into the installed app), stash the file(s) in a small
 *      handoff IndexedDB, and 303-redirect to /app/share so ShareLandingPage
 *      can read the file once on mount. See src/pwa/shareHandoff.ts for the
 *      read side and the DB schema this file must stay in sync with.
 *
 * Offline writes DO have a queue — this file's old header claiming otherwise
 * was stale. `src/pwa/outbox.ts` is a 3-tier (direct / Drive-relay / IndexedDB)
 * JSON-intent queue, and `src/pwa/blobOutbox.ts` is its binary-blob sibling
 * (queues shared media for upload once ShareLandingPage picks a friend). This
 * service worker doesn't drive either queue itself — it only owns the share
 * hand-off above; outbox flushing/replay happens at the app layer (see
 * src/pwa/FLOWS.md).
 *
 * Served at /app/service-worker.js (CRA copies public/ verbatim to the build
 * root; the app itself is reverse-proxied under /app/ — see nginx/nginx.conf),
 * so its default scope is /app/. Service workers require a secure context:
 * real HTTPS (the Cloudflare tunnel domain) or localhost — the self-hosted
 * :8090 plain-http origin will refuse registration everywhere else.
 */

const VERSION = 'v7'; // v7: the ACTUAL fix for the "ServiceWorker intercepted the
// request and encountered an unexpected error" crash. v6 only wrapped
// handleNavigate() and the top-level fetch listener; cacheFirst() and
// staleWhileRevalidate() — which handle EVERY build-asset/media/icon request, i.e.
// almost all of them — still let caches.open() throw straight out to
// event.respondWith() uncaught whenever Cache Storage is unavailable. That's what
// was actually crashing: the app's own JS bundle load (a build asset) failing this
// way meant the React app, and with it the update-available UI, never rendered.
// v6: broadcastLog() bridges [SW] logs to the page console via postMessage
// (Firefox never surfaces a SW's own console output in the normal page console —
// see broadcastLog's comment below), and the whole 'fetch' listener body is now
// try/caught so a synchronous throw before respondWith() is diagnosable instead of
// surfacing only as the opaque "unexpected error" browsers show.
// v5: removed the unconditional self.skipWaiting() in install().
// Every prior version force-activated the instant it finished downloading — mid-
// session, on ANY open tab, with zero user say in it (compounded by NavigationBar
// polling checkForUpdate() on every tab-focus). That's a real failure mode: an
// update can silently take over while the server happens to be mid-restart from an
// unrelated deploy, leaving a blank page with no explanation. Now installs sit
// WAITING until a client explicitly posts {type:'SKIP_WAITING'} — see the
// 'message' listener below and src/pwa/registerSW.ts's applyUpdate(), which is the
// only thing allowed to call that, and only from a user click.
const SHELL_CACHE = `communicator-shell-${VERSION}`;
const MEDIA_CACHE = 'communicator-media'; // unversioned: media doesn't change once uploaded

// Firefox does NOT surface a service worker's own console.* output in the page's
// regular DevTools console — it only shows up in a separate inspector
// (about:debugging#/runtime/this-firefox → this SW → Inspect). That made every
// [SW] log below invisible during the v3-v5 debugging chain even though they were
// firing the whole time. broadcastLog() still logs normally (for Chrome / the SW's
// own console) AND postMessages the same info to every open client, where
// registerSW.ts re-logs it with a [SW→page] prefix — so it lands in the ONE
// console every browser actually shows by default.
function broadcastLog(level, message, detail) {
  const fn = console[level] || console.log;
  fn.call(console, '[SW]', message, detail);
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage({
      type: 'SW_LOG',
      level,
      message,
      detail: detail ? String((detail && detail.message) || detail) : undefined,
    }));
  }).catch(() => {});
}

const SHELL_URLS = ['/app/', '/app/index.html', '/app/manifest.json'];

// If precaching fails (quota exceeded is the live suspect — see FLOWS.md), the OLD
// install handler let that rejection propagate out of waitUntil(), which per spec
// DISCARDS the new service worker entirely — it never activates, skipWaiting() never
// runs, and the browser silently keeps running whatever buggy version was already
// active, forever, no matter how many times the page is reloaded. This was the exact
// deadlock behind v3 failing to take over from v2: the fix needed a successful cache
// write to install, and a successful cache write was the very thing broken. Precache
// failure now degrades to "install with an empty shell cache" instead of "don't
// install at all" — handleNavigate()'s network-first fetch still works fine with
// nothing precached, it just always goes to the network until Cache Storage frees up.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL_URLS))
      .catch((e) => console.error('[SW] shell precache failed during install (quota?) — installing anyway, navigation will fall back to network-only until Cache Storage frees up', e))
  );
  // Deliberately NO self.skipWaiting() here. A new SW used to take over every open
  // tab the instant it finished downloading — mid-session, with no user say in it —
  // which is exactly the failure mode this app should never have: an update silently
  // activates while the user is mid-flow (or while the server happens to be mid-restart
  // from a deploy), the tab's already-loaded JS and the newly-active SW disagree about
  // something, and the result is a blank/white page with no explanation. Now the new
  // worker installs and sits in the WAITING state until the client explicitly asks it
  // to activate (see the 'message' listener below) — same UX contract as most real
  // software: download in the background, apply on click.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('communicator-shell-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .catch((e) => console.error('[SW] old shell-cache cleanup failed — continuing to claim clients anyway', e))
      .then(() => self.clients.claim())
  );
});

// ── Share-target handoff DB (mirrors src/pwa/shareHandoff.ts's constants —
// kept inline so this file is a standalone SW with no build step. Bump BOTH
// files' DB version together if the schema ever changes.) ──
const SHARE_HANDOFF_DB_NAME = 'communicator-share-handoff';
const SHARE_HANDOFF_DB_VERSION = 1;
const SHARE_HANDOFF_STORE = 'pendingShares';

function openShareHandoffDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_HANDOFF_DB_NAME, SHARE_HANDOFF_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_HANDOFF_STORE)) {
        db.createObjectStore(SHARE_HANDOFF_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putPendingShare(record) {
  return openShareHandoffDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_HANDOFF_STORE, 'readwrite');
    tx.objectStore(SHARE_HANDOFF_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

self.addEventListener('fetch', (event) => {
  // Whole body wrapped: a synchronous throw ANYWHERE in here (bad URL parsing, a
  // regex blowing up, anything) happens before respondWith() is ever called, which
  // Firefox and Chrome both then report as exactly the opaque "ServiceWorker
  // intercepted the request and encountered an unexpected error" — with no [SW] log
  // at all, since nothing downstream ever ran. This try/catch is the only thing that
  // can make that specific failure mode visible.
  try {
    const { request } = event;
    const url = new URL(request.url);

    // OS share sheet → POST /app/share-target. Field name 'media' must match
    // manifest.json's share_target.params.files[0].name.
    if (request.method === 'POST' && url.pathname === '/app/share-target') {
      event.respondWith(handleShareTarget(request));
      return;
    }

    if (request.method !== 'GET') return; // never cache writes

    // Navigations → network-first, fall back to the cached shell on ANY failure
    // (offline, DNS down, or a reachable-but-broken origin returning a bad status)
    // so the installed app still boots.
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigate(request));
      return;
    }

    if (url.origin === self.location.origin && isAppIcon(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
      return;
    }

    if (url.origin === self.location.origin && isMedia(url.pathname)) {
      event.respondWith(cacheFirst(request, MEDIA_CACHE));
      return;
    }

    if (url.origin === self.location.origin && isBuildAsset(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
      return;
    }

    // Everything else (incl. /api/* data GETs) → straight to network, no caching.
  } catch (e) {
    broadcastLog('error', 'fetch listener threw synchronously before respondWith — this IS the "unexpected error" Firefox shows', e);
  }
});

// Everything in here — including caches.open() itself — used to be able to throw
// past this function and reject respondWith()'s promise, which Chrome surfaces as
// the maximally uninformative "ServiceWorker intercepted the request and
// encountered an unexpected error." Wrapping the WHOLE body (not just the fetch)
// means any cache-layer failure (quota exceeded, private-browsing storage
// restrictions, a corrupted cache) degrades to a real response instead of an
// unhandled rejection. console.error calls here are the actual diagnostic: open
// DevTools → Application → Service Workers → "communicator-app" (or just the
// page console) to see which branch fired and why.
async function handleNavigate(request) {
  broadcastLog('log', 'handleNavigate start', request.url);
  try {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const res = await fetchWithTimeout(request, 3500);
      if (res && res.ok) {
        cache.put('/app/index.html', res.clone()).catch((e) =>
          broadcastLog('error', 'failed to update shell cache after a live fetch', e));
        return res;
      }
      broadcastLog('warn', `navigate fetch returned status ${res && res.status} — falling back to cached shell`);
      const cached = (await cache.match('/app/index.html')) || (await cache.match('/app/'));
      return cached || res;
    } catch (fetchErr) {
      broadcastLog('warn', 'navigate fetch failed (offline or timeout), falling back to cached shell', fetchErr);
      const cached = (await cache.match('/app/index.html')) || (await cache.match('/app/'));
      if (cached) return cached;
      broadcastLog('error', 'no cached shell available either — serving inline offline page', fetchErr);
      return offlineFallbackResponse();
    }
  } catch (cacheErr) {
    // caches.open() (or any other Cache Storage call) itself failed — this is the
    // bug that used to produce the generic error above. Quota exceeded is the
    // most likely cause given MEDIA_CACHE has no eviction (see FLOWS.md).
    broadcastLog('error', 'Cache Storage unavailable — serving live network response with no cache fallback', cacheErr);
    try {
      return await fetch(request);
    } catch (networkErr) {
      broadcastLog('error', 'Cache Storage AND network both unavailable', networkErr);
      return offlineFallbackResponse();
    }
  }
}

// Last-resort response when there's no cached shell AND no network — a real
// (if minimal) page instead of Response.error(), which Chrome renders as its own
// opaque "can't reach this page" error with zero app branding or explanation.
function offlineFallbackResponse() {
  return new Response(
    '<!doctype html><html><body style="font-family:sans-serif;padding:2rem;text-align:center">'
    + '<h1>Communicator is offline</h1><p>No cached version of the app is available yet on this '
    + 'device. Connect once online to finish installing, then this page works offline too.</p>'
    + '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html' } },
  );
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('nav timeout')), ms);
    fetch(request).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function isAppIcon(path) {
  return path === '/app/favicon.ico' || path === '/app/logo192.png' || path === '/app/logo512.png'
    || path === '/app/manifest.json';
}

function isMedia(path) {
  return path.startsWith('/api/fileRepository/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

function isBuildAsset(path) {
  return path.startsWith('/app/static/') || /\.(js|css|woff2?|ttf)$/i.test(path);
}

// Both cache strategies below used to let caches.open()/cache.match() throw straight
// out to event.respondWith() uncaught — the exact "ServiceWorker intercepted the
// request and encountered an unexpected error" bug, just on build-asset/media
// requests instead of navigations. handleNavigate got this fix first; these two were
// the actual culprit for a case where Cache Storage itself is unavailable (broken
// profile, private browsing, storage partitioning) since EVERY JS/CSS/media request
// routes through one of these two, unlike the single navigation request.
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    } catch (e) {
      return hit || Response.error();
    }
  } catch (cacheErr) {
    broadcastLog('error', 'cacheFirst: Cache Storage unavailable, falling back to live network', cacheErr);
    try {
      return await fetch(request);
    } catch (networkErr) {
      return Response.error();
    }
  }
}

async function staleWhileRevalidate(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    const fetching = fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fetching;
  } catch (cacheErr) {
    broadcastLog('error', 'staleWhileRevalidate: Cache Storage unavailable, falling back to live network', cacheErr);
    try {
      return await fetch(request);
    } catch (networkErr) {
      return Response.error();
    }
  }
}

// Share sheet → POST /app/share-target (multipart/form-data, per manifest.json's
// share_target block). Unlike ObsidianOptimizer's handleShareTarget (which POSTs
// straight to a backend /api/capture/file), Communicator has no such endpoint —
// there's no "general capture inbox" here, sharing a photo/video is meant to land
// on a FRIEND, and only the user (via ShareLandingPage) knows which friend. So this
// handler does the minimum a service worker can do: pull the file(s) out of the
// multipart body, stash them in a small handoff IndexedDB (a Blob can't ride across
// a navigation/redirect any other way), and 303-redirect into the React app. The
// friend-picker + actual upload (via blobOutbox) happen entirely in
// ShareLandingPage after it mounts and reads this record — see
// src/pwa/shareHandoff.ts for the read side and the exact contract.
async function handleShareTarget(request) {
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return Response.redirect('/app/share?shared=err', 303);
  }

  const files = form.getAll('media').filter((f) => f && typeof f.name === 'string' && f.size > 0);
  if (files.length === 0) return Response.redirect('/app/share?shared=err', 303);

  const shareId = (self.crypto && self.crypto.randomUUID)
    ? self.crypto.randomUUID()
    : `share-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const record = {
    id: shareId,
    files: files.map((f) => ({ name: f.name, type: f.type, blob: f })),
    title: (form.get('title') || '').toString(),
    text: (form.get('text') || '').toString(),
    ts: Date.now(),
  };

  try {
    await putPendingShare(record);
  } catch (e) {
    return Response.redirect('/app/share?shared=err', 303);
  }

  return Response.redirect(`/app/share?shared=1&shareId=${shareId}`, 303);
}
