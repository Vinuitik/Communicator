// MV3 background (service worker in Chrome / event page in Firefox). All network
// calls live here so they run with the extension's host permissions.
//
// One job: take whatever you capture (selected text, a link, the page itself, or
// an image/file) and save it against a specific friend's profile — either as a
// knowledge-base note or an uploaded file. Communicator has no "review queue" or
// ingest pipeline (unlike the project this extension was ported from), so this is
// deliberately thin: two backend calls, no auth, no background processing.
//
// Backend contracts used (see react/src/services/api/friendService.ts for the
// same calls made by the web app):
//   GET  /friend/shortList                    → [{ id, name }, ...]
//   POST /friend/addKnowledge/{friendId}      [{ fact, importance }]
//   POST /fileRepository/files/upload         multipart: files[], friendId
import { getConfig, setConfig, setLastFriend, api } from './config.js';

async function apiFetch(path, opts = {}) {
  const { apiBase } = await getConfig();
  return fetch(`${apiBase}${path}`, opts);
}

// ── Friends ──────────────────────────────────────────────────────────────────
async function listFriends() {
  try {
    const res = await apiFetch('/friend/shortList');
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
    return { ok: true, friends: await res.json() };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── Save a note (text/link/page) to a friend's knowledge base ──────────────────
async function saveNote(friendId, friendName, text) {
  const fact = (text || '').trim();
  if (!friendId) return { ok: false, error: 'No friend selected.' };
  if (!fact) return { ok: false, error: 'Nothing to save.' };
  try {
    const res = await apiFetch(`/friend/addKnowledge/${friendId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ fact, importance: 5 }]),
    });
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
    await setLastFriend(friendId, friendName);
    return { ok: true, detail: `Saved to ${friendName}` };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── Save a file (drag-dropped in the popup, or a right-clicked image) ─────────
async function saveFile(friendId, friendName, name, type, dataB64) {
  if (!friendId) return { ok: false, error: 'No friend selected.' };
  try {
    const bytes = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append('files', new Blob([bytes], { type: type || 'application/octet-stream' }), name);
    form.append('friendId', String(friendId));
    const res = await apiFetch('/fileRepository/files/upload', { method: 'POST', body: form });
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
    await setLastFriend(friendId, friendName);
    return { ok: true, detail: `Uploaded "${name}" to ${friendName}` };
  } catch (e) { return { ok: false, error: String(e) }; }
}

function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]); // strip data: prefix
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// ── Message router (popup → background) ─────────────────────────────────────────
const HANDLERS = {
  getConfig: () => getConfig(),
  setConfig: (patch) => setConfig(patch),
  listFriends: () => listFriends(),
  saveNote: ({ friendId, friendName, text }) => saveNote(friendId, friendName, text),
  saveFile: ({ friendId, friendName, name, type, dataB64 }) =>
    saveFile(friendId, friendName, name, type, dataB64),
};

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) { sendResponse({ ok: false, error: `unknown message: ${msg?.type}` }); return false; }
  Promise.resolve(handler(msg.payload || {})).then(sendResponse);
  return true; // async response
});

// ── Context menus ────────────────────────────────────────────────────────────
// 'quick-add' only exists once a friend has been used at least once (its title
// names them); until then, the only option is the picker.
async function installMenus() {
  const { lastFriendId, lastFriendName } = await getConfig();
  await new Promise((resolve) => api.contextMenus.removeAll(resolve));
  if (lastFriendId) {
    api.contextMenus.create({
      id: 'quick-add',
      title: `Add to ${lastFriendName}`,
      contexts: ['selection', 'link', 'page'],
    });
  }
  api.contextMenus.create({
    id: 'add-to-friend',
    title: 'Add note to a friend…',
    contexts: ['selection', 'link', 'page'],
  });
  api.contextMenus.create({
    id: 'save-image',
    title: lastFriendId ? `Save image to ${lastFriendName}` : 'Save image (pick a friend first)',
    contexts: ['image'],
  });
}

function noteTextFor(info, tab) {
  if (info.menuItemId === 'save-image') return null;
  if (info.selectionText) return info.selectionText;
  if (info.linkUrl) return info.linkUrl;
  return [tab?.title, info.pageUrl].filter(Boolean).join('\n');
}

async function flashBadge(ok) {
  try {
    await api.action.setBadgeBackgroundColor({ color: ok ? '#4cc38a' : '#e05c5c' });
    await api.action.setBadgeText({ text: ok ? '✓' : '!' });
    setTimeout(() => api.action.setBadgeText({ text: '' }), 2500);
  } catch { /* badge is best-effort */ }
}

// A capture handed off to the popup for friend-picking (used by 'add-to-friend'
// and by the first-ever 'quick-add', since there's no last friend to quick-add to).
async function openPicker(text) {
  await api.storage.local.set({ pendingCapture: { text } });
  api.windows.create({
    url: api.runtime.getURL('popup.html'),
    type: 'popup',
    width: 360,
    height: 480,
  });
}

api.contextMenus.onClicked.addListener(async (info, tab) => {
  const { lastFriendId, lastFriendName } = await getConfig();

  if (info.menuItemId === 'save-image') {
    if (!lastFriendId) return flashBadge(false);
    try {
      const res = await fetch(info.srcUrl);
      const blob = await res.blob();
      const name = info.srcUrl.split('/').pop()?.split('?')[0] || 'image';
      const dataB64 = await blobToB64(blob);
      const result = await saveFile(lastFriendId, lastFriendName, name, blob.type, dataB64);
      return flashBadge(result.ok);
    } catch { return flashBadge(false); }
  }

  const text = noteTextFor(info, tab);
  if (!text) return;

  if (info.menuItemId === 'quick-add' && lastFriendId) {
    const result = await saveNote(lastFriendId, lastFriendName, text);
    return flashBadge(result.ok);
  }
  // 'add-to-friend' (or a stale 'quick-add' with no friend yet) → let the user pick.
  return openPicker(text);
});

// ── Install / startup ────────────────────────────────────────────────────────
api.runtime.onInstalled.addListener((details) => {
  installMenus();
  if (details.reason === 'install') {
    api.tabs.create({ url: api.runtime.getURL('onboarding.html') });
  }
});
api.runtime.onStartup?.addListener(() => installMenus());

// Rebuild the menu titles whenever the popup changes the last-used friend.
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.lastFriendId || changes.lastFriendName)) installMenus();
});
