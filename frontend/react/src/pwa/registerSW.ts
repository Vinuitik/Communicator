// PWA service-worker registration + click-to-apply update detection.
//
// Wire-up: one call in src/index.tsx — registerServiceWorker().
//
// Registration silently no-ops outside a secure context (plain-http :8090
// will refuse it everywhere except localhost). Install must happen over the
// Cloudflare tunnel domain, which serves a real cert.
//
// Update model: a new SW installs and sits WAITING — it does NOT take over on
// its own (service-worker.js no longer calls self.skipWaiting() unconditionally).
// onUpdateAvailable fires once a worker is confirmed waiting; applyUpdate() is the
// only thing that tells it to activate, and only a user click should ever call it.
// This used to be proactive (skipWaiting() ran the instant install finished,
// mid-session, with no user say in it) — deliberately changed after that caused a
// blank/white page for a user whose tab got silently taken over while the server
// happened to be mid-restart from an unrelated deploy.

let registration: ServiceWorkerRegistration | null = null;
let updateListeners: Array<() => void> = [];
let notified = false;

function watchForWaitingWorker(worker: ServiceWorker | null): void {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    // 'installed' + an existing controller (i.e. this isn't the very first install
    // this browser has ever done) means a new version finished downloading and is
    // sitting in the waiting state — ready, but not applied.
    if (worker.state === 'installed' && navigator.serviceWorker.controller && !notified) {
      notified = true;
      updateListeners.forEach((cb) => cb());
    }
  });
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  if (!window.isSecureContext) {
    console.info('[PWA] not a secure context — service worker skipped');
    return null;
  }
  // Firefox never surfaces a service worker's own console.* output in the page's
  // regular DevTools console (it only shows up in a separate about:debugging
  // inspector) — this bridges service-worker.js's broadcastLog() postMessages back
  // into the one console every browser actually shows by default.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_LOG') {
      const { level, message, detail } = event.data;
      const fn = (console as unknown as Record<string, (...args: unknown[]) => void>)[level] || console.log;
      fn('[SW→page]', message, detail || '');
    }
  });

  try {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
    registration = await navigator.serviceWorker.register(swUrl, { scope: `${process.env.PUBLIC_URL}/` });

    // A worker can already be sitting in `.waiting` at registration time (e.g. this
    // tab has been open since before an update landed, and a DIFFERENT tab's
    // registration already finished the download). Surface it immediately rather
    // than only detecting updates that happen to complete while this tab is open.
    if (registration.waiting && navigator.serviceWorker.controller) {
      notified = true;
      updateListeners.forEach((cb) => cb());
    }

    watchForWaitingWorker(registration.installing);
    registration.addEventListener('updatefound', () => watchForWaitingWorker(registration!.installing));

    return registration;
  } catch (e) {
    console.warn('[PWA] service worker registration failed:', e);
    return null;
  }
}

// Subscribe to "a new version finished downloading and is ready to apply".
// Returns an unsubscribe function. Fires at most once per page load — does NOT
// mean it already took over, just that applyUpdate() will now do something.
export function onUpdateAvailable(cb: () => void): () => void {
  updateListeners.push(cb);
  return () => { updateListeners = updateListeners.filter((l) => l !== cb); };
}

// Manual "check now" — nudges the browser to re-fetch service-worker.js instead
// of waiting on its own multi-hour cache-lifetime check. Only downloads/installs;
// does not activate anything (see applyUpdate for that).
export async function checkForUpdate(): Promise<void> {
  try {
    const reg = registration || (await navigator.serviceWorker.getRegistration());
    await reg?.update();
  } catch {
    /* best-effort */
  }
}

// The ONLY path that makes a waiting update take over — call this from a user's
// click, never proactively. Tells the waiting worker to skip waiting, then reloads
// once it actually becomes the controller (controllerchange), so the reload always
// lands on the new version's JS instead of racing it.
export async function applyUpdate(): Promise<void> {
  const reg = registration || (await navigator.serviceWorker.getRegistration());
  const waiting = reg?.waiting;
  if (!waiting) {
    // Nothing actually waiting (stale UI state, or it was already applied by
    // another tab) — a plain reload is the correct no-op fallback.
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

// Unconditional reload, no update semantics — kept for call sites that just need
// "refresh this tab" (e.g. a manual troubleshooting action), not update-apply.
export function reloadApp(): void {
  window.location.reload();
}
