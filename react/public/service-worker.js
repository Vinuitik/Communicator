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
 * No offline writes/outbox — Communicator has no queued-write concept, unlike
 * the project this was patterned after. A capture (extension or app) that
 * happens while offline just fails; retry once back online.
 *
 * Served at /app/service-worker.js (CRA copies public/ verbatim to the build
 * root; the app itself is reverse-proxied under /app/ — see nginx/nginx.conf),
 * so its default scope is /app/. Service workers require a secure context:
 * real HTTPS (the Cloudflare tunnel domain) or localhost — the self-hosted
 * :8090 plain-http origin will refuse registration everywhere else.
 */

const VERSION = 'v1';
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never cache writes

  const url = new URL(request.url);

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
