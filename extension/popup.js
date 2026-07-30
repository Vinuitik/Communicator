// Popup controller. UI only — every network call is delegated to background.js
// via runtime.sendMessage so it runs with the extension's host permissions.
import { getConfig, api } from './config.js';

const send = (type, payload) => api.runtime.sendMessage({ type, payload });
const $ = (id) => document.getElementById(id);

function setStatus(el, msg, kind = 'info') {
  el.textContent = msg;
  el.className = `status ${kind}`;
}

function selectedFriend() {
  const opt = $('friend-select').selectedOptions[0];
  return opt ? { id: Number(opt.value), name: opt.textContent } : null;
}

// ── Panels (capture / settings) ─────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', p.dataset.panel === name));
}
$('tab-settings-btn').addEventListener('click', () => { showPanel('settings'); loadSettings(); });
$('back-btn').addEventListener('click', () => showPanel('capture'));

// ── Friend list ──────────────────────────────────────────────────────────────
async function loadFriends() {
  const select = $('friend-select');
  const { lastFriendId } = await getConfig();
  const res = await send('listFriends');
  if (!res?.ok) {
    select.innerHTML = '<option value="">Couldn’t load friends</option>';
    return setStatus($('cap-status'), `Couldn't load friends: ${res?.error || res?.status || 'unknown'}`, 'err');
  }
  select.innerHTML = res.friends
    .map((f) => `<option value="${f.id}">${f.name}</option>`)
    .join('');
  if (lastFriendId && res.friends.some((f) => f.id === lastFriendId)) {
    select.value = String(lastFriendId);
  }
}

// ── Prefill from a context-menu capture (see background.js openPicker) ────────
async function prefillFromPending() {
  const { pendingCapture } = await api.storage.local.get('pendingCapture');
  if (pendingCapture?.text) {
    $('cap-input').value = pendingCapture.text;
    await api.storage.local.remove('pendingCapture');
  }
}

// ── Save note ──────────────────────────────────────────────────────────────────
$('cap-send').addEventListener('click', async () => {
  const friend = selectedFriend();
  const text = $('cap-input').value.trim();
  if (!friend) return setStatus($('cap-status'), 'Pick a friend first.', 'err');
  if (!text) return setStatus($('cap-status'), 'Write or paste a note first.', 'err');

  $('cap-send').disabled = true;
  setStatus($('cap-status'), 'Saving…', 'info');
  const res = await send('saveNote', { friendId: friend.id, friendName: friend.name, text });
  $('cap-send').disabled = false;
  if (res?.ok) {
    setStatus($('cap-status'), `${res.detail} ✓`, 'ok');
    $('cap-input').value = '';
  } else {
    setStatus($('cap-status'), `Failed: ${res?.error || res?.status || 'unknown'}`, 'err');
  }
});

// ── Attach a file (drag-drop or picker) ─────────────────────────────────────────
async function saveFile(file) {
  const friend = selectedFriend();
  if (!friend) return setStatus($('cap-status'), 'Pick a friend first.', 'err');
  setStatus($('cap-status'), `Uploading "${file.name}"…`, 'info');
  try {
    const dataB64 = await fileToB64(file);
    const res = await send('saveFile', {
      friendId: friend.id, friendName: friend.name, name: file.name, type: file.type, dataB64,
    });
    if (res?.ok) setStatus($('cap-status'), `${res.detail} ✓`, 'ok');
    else setStatus($('cap-status'), `Failed: ${res?.error || res?.status || 'unknown'}`, 'err');
  } catch (err) {
    setStatus($('cap-status'), `Couldn't read the file: ${err}`, 'err');
  }
}

function fileToB64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]); // strip data: prefix
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const dropZone = $('drop-zone');
['dragenter', 'dragover'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) =>
  dropZone.addEventListener(ev, () => dropZone.classList.remove('drag')));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) saveFile(file);
});
$('file-input').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) saveFile(file);
});

// ── Settings ────────────────────────────────────────────────────────────────────
async function loadSettings() {
  const cfg = await getConfig();
  $('cfg-api').value = cfg.apiBase;
}

$('cfg-save').addEventListener('click', async () => {
  await send('setConfig', { apiBase: $('cfg-api').value.trim() });
  setStatus($('settings-status'), 'Settings saved.', 'ok');
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadFriends();
prefillFromPending();
