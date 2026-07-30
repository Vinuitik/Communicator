// Endpoint config — editable in the popup's Settings tab, persisted in
// chrome.storage.local. Shared by background.js and popup.js.
//
// apiBase: the Communicator backend, reached via nginx (the `/api` base, same
//   paths the web app uses). Default is the Cloudflare tunnel domain. For
//   same-machine dev, set it to http://localhost:8090/api in ⚙ Settings.
//
// No auth here — Communicator is single-tenant/unauthenticated (see
// group/.../WebConfig.java), so unlike the project this extension was ported
// from, there's no login/session handling to do.

// Cross-browser WebExtension API handle. Firefox exposes the promise-based
// `browser.*` namespace; Chrome/Edge/Brave expose `chrome.*` (also promise-based
// under MV3). Picking `browser ?? chrome` means every `await api.*` call below
// returns a real promise in BOTH engines — no polyfill needed.
export const api = globalThis.browser ?? globalThis.chrome;

export const DEFAULTS = {
  apiBase: 'https://communicator.work/api',
};

export async function getConfig() {
  const stored = await api.storage.local.get(['apiBase', 'lastFriendId', 'lastFriendName']);
  return { ...DEFAULTS, ...stored };
}

export async function setConfig(patch) {
  await api.storage.local.set(patch);
}

// Remembers which friend was last used, so the context-menu "quick add" item
// can save with one click instead of prompting every time.
export async function setLastFriend(id, name) {
  await api.storage.local.set({ lastFriendId: id, lastFriendName: name });
}
