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

const VERSION = 'v2'; // bumped for share_target handling — new SW logic needs new bytes to install
const SHELL_CACHE = `communicator-shell-${VERSION}`;
const MEDIA_CACHE = 'communicator-media'; // unversioned: media doesn't change once uploaded

const SHELL_URLS = ['/app/', '/app/index.html', '/app/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('communicator-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
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
});

async function handleNavigate(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetchWithTimeout(request, 3500);
    if (res && res.ok) {
      cache.put('/app/index.html', res.clone()).catch(() => {});
      return res;
    }
    return (await cache.match('/app/index.html')) || (await cache.match('/app/')) || res;
  } catch (e) {
    return (await cache.match('/app/index.html')) || (await cache.match('/app/')) || Response.error();
  }
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

async function cacheFirst(request, cacheName) {
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
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetching = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fetching;
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
