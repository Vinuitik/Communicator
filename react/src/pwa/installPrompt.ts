// Captures the browser's `beforeinstallprompt` so a real in-app "Install" button can
// trigger the native PWA install (Chrome/Edge fire it once, early, and you must stash
// the event to call .prompt() later on a user gesture). Firefox/Safari never fire it →
// the caller falls back to manual guidance. Import this for side effects (from
// index.tsx) so the event isn't missed before GetAppPage ever mounts.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  canInstall: boolean;
  installed: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(s: InstallState) => void>();

function emit() { listeners.forEach((fn) => fn(state())); }

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true;
}

export function state(): InstallState {
  return { canInstall: !!deferred, installed: isStandalone() };
}

// Subscribe to install-availability changes; returns an unsubscribe. Fires once immediately.
export function onInstallChange(fn: (s: InstallState) => void): () => void {
  listeners.add(fn);
  fn(state());
  return () => listeners.delete(fn);
}

// Trigger the native prompt. Returns 'accepted' | 'dismissed' | 'unavailable'.
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null; // a captured prompt is single-use
  emit();
  e.prompt();
  const { outcome } = await e.userChoice.catch<{ outcome: 'dismissed' }>(() => ({ outcome: 'dismissed' }));
  return outcome;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // stop the mini-infobar; install is driven from the Get App page
  deferred = e as BeforeInstallPromptEvent;
  emit();
});
window.addEventListener('appinstalled', () => { deferred = null; emit(); });
