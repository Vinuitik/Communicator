// PWA service-worker registration + update detection.
//
// Wire-up: one call in src/index.tsx — registerServiceWorker().
//
// Registration silently no-ops outside a secure context (plain-http :8090
// will refuse it everywhere except localhost). Install must happen over the
// Cloudflare tunnel domain, which serves a real cert.

let registration: ServiceWorkerRegistration | null = null;
let updateListeners: Array<() => void> = [];
let notified = false;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  if (!window.isSecureContext) {
    console.info('[PWA] not a secure context — service worker skipped');
    return null;
  }
  try {
    // A controller already present at load time means an OLDER SW was running this
    // page — the next controllerchange is therefore a real update, not the very
    // first install (which has no prior controller to change FROM).
    const hadController = !!navigator.serviceWorker.controller;
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    registration = await navigator.serviceWorker.register(swUrl, { scope: `${process.env.PUBLIC_URL}/` });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || notified) return;
      notified = true;
      updateListeners.forEach((cb) => cb());
    });

    return registration;
  } catch (e) {
    console.warn('[PWA] service worker registration failed:', e);
    return null;
  }
}

// Subscribe to "a new version has taken over — reload to see it". Returns an
// unsubscribe function. Fires at most once per page load.
export function onUpdateAvailable(cb: () => void): () => void {
  updateListeners.push(cb);
  return () => { updateListeners = updateListeners.filter((l) => l !== cb); };
}

// Manual "check now" — nudges the browser to re-fetch service-worker.js instead
// of waiting on its own multi-hour cache-lifetime check.
export async function checkForUpdate(): Promise<void> {
  try {
    const reg = registration || (await navigator.serviceWorker.getRegistration());
    await reg?.update();
  } catch {
    /* best-effort */
  }
}

export function reloadApp(): void {
  window.location.reload();
}
