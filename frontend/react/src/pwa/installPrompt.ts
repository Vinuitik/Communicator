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

// iOS Safari never fires beforeinstallprompt (canInstall stays false forever there) —
// callers use this to show manual "Share → Add to Home Screen" steps instead. iPadOS
// 13+ reports itself as a desktop Mac UA, so a touch-point check catches it too.
export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua)
    || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

// Firefox is the one browser where the extension .xpi itself is directly
// installable (signed via AMO — see extension/deploy-extension.sh) instead of
// needing the unzip-and-load-unpacked dance Chrome/Edge/Brave require.
export function isFirefox(): boolean {
  return window.navigator.userAgent.includes('Firefox');
}

// Phone vs laptop/desktop — used to hide device-irrelevant sections (e.g. the browser
// extension card: no mobile browser supports extensions, regardless of engine).
export function isMobile(): boolean {
  return isIOS() || /Android|Mobi/i.test(window.navigator.userAgent);
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
