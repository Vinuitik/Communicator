// Endpoint config — editable in the popup's Settings tab, persisted in
// chrome.storage.local. Shared by background.js and popup.js.
//
// obsidianApi: the Communicator backend, reached via nginx (the `/api` base,
//   same paths the web app uses). Default is the Cloudflare tunnel domain.
//   For same-machine dev, set it to http://localhost:8090/api in ⚙ Settings.
//
// Both features (clip note AND download) go through this one backend: the yt-dlp
// downloader now lives in the embedder and is proxied at /download (the embedder
// is loopback-only, so the extension can't call it directly).

// Cross-browser WebExtension API handle. Firefox exposes the promise-based
// `browser.*` namespace; Chrome/Edge/Brave expose `chrome.*` (also promise-based
// under MV3). Picking `browser ?? chrome` means every `await api.*` call below
// returns a real promise in BOTH engines — no polyfill needed.
export const api = globalThis.browser ?? globalThis.chrome;

export const DEFAULTS = {
  obsidianApi: 'https://communicator.work/api',
};

export async function getConfig() {
  const stored = await api.storage.local.get(['obsidianApi', 'agentWsToken']);
  return { ...DEFAULTS, ...stored };
}

export async function setConfig(patch) {
  await api.storage.local.set(patch);
}

// ── Remembered credentials (opt-in) ──────────────────────────────────────────────
// The backend session is a short-lived in-memory Spring session that dies on every
// server restart, so the cookie keeps going stale and the user re-logs in constantly.
// With "Remember me" we stash the credentials in chrome.storage.local and background.js
// silently re-logs in on any 401 — so a capture never fails just because the session
// lapsed. Trade-off: the password sits in extension storage in plain text. Acceptable for
// a single-user personal tool; clear it by unchecking "Remember me" (clearCreds).
export async function getCreds() {
  return await api.storage.local.get(['authUser', 'authPass']);
}
export async function setCreds(authUser, authPass) {
  await api.storage.local.set({ authUser, authPass });
}
export async function clearCreds() {
  await api.storage.local.remove(['authUser', 'authPass']);
}
