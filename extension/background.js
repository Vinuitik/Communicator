// MV3 background (service worker in Chrome / event page in Firefox). All network
// calls live here so they run with the extension's host permissions (the page's
// own CORS/CSP/mixed-content rules don't apply) and the ObsidianOptimizer session
// cookie is sent on same-origin terms.
//
// One job: take whatever you capture (raw text, a URL, or an uploaded file) and
// hand it to the backend so it ends up reviewable in the Learn page. Routing is
// deliberately thin — the embedder's ingest router already classifies youtube /
// web / pdf / av, so for URLs we just POST /capture and let it decide.
//
// Backend contracts used:
//   GET  /me                          auth check
//   POST /login   (form-encoded)      session login
//   GET  /children                    vault root (default folder for raw-text notes)
//   POST /notes   {folder, name}      create note → { path }   (writes sr-due + #review)
//   PUT  /notes   {path, content}     write note body
//   POST /capture {url}               → embedder /ingest (extract → synthesize → inbox)
//   POST /workspace/save   {url}      download a media/pdf URL into _workspace/
//   POST /workspace/upload (multipart) store a dropped local file in _workspace/
//   POST /download {url}              yt-dlp offline grab → _workspace/ (watchable)
import { getConfig, setConfig, getCreds, api } from './config.js';

// ── HTTP helper ────────────────────────────────────────────────────────────────
// Self-healing auth: the backend session is in-memory and dies on server restart, so a
// call can 401 even though the user "is" logged in. When that happens and we have
// remembered credentials, silently re-login once and retry — the capture just works
// instead of dumping the user back to the sign-in form.
async function obsidian(path, opts = {}) {
  const { obsidianApi } = await getConfig();
  const doFetch = () => fetch(`${obsidianApi}${path}`, { credentials: 'include', ...opts });
  let res = await doFetch();
  if (res.status === 401 && path !== '/login') {
    if (await reloginFromStored(obsidianApi)) res = await doFetch();
  }
  return res;
}

async function reloginFromStored(obsidianApi) {
  const { authUser, authPass } = await getCreds();
  if (!authUser || !authPass) return false;
  try {
    const r = await fetch(`${obsidianApi}/login`, {
      method: 'POST', credentials: 'include',
      body: new URLSearchParams({ username: authUser, password: authPass }),
    });
    return r.ok;
  } catch { return false; }
}

const json = (path, method, payload) => obsidian(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

// ── Input classification ─────────────────────────────────────────────────────
// Video platforms where we want BOTH a watchable file (yt-dlp → _workspace) AND
// synthesized notes (ingest). Everything else that's a URL just goes to /capture.
const VIDEO_HOST_RE = /(?:^|\.)(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)$/i;
const MEDIA_EXT_RE  = /\.(pdf|mp4|mov|mkv|webm|avi|mp3|m4a|wav|ogg|flac)(?:[?#]|$)/i;
const URL_RE        = /^https?:\/\/\S+$/i;

function classify(text) {
  const t = (text || '').trim();
  if (!URL_RE.test(t)) return { kind: 'text', value: t };
  let host = '';
  try { host = new URL(t).host; } catch { /* malformed → treat as text */ return { kind: 'text', value: t }; }
  if (VIDEO_HOST_RE.test(host)) return { kind: 'video', value: t };
  if (MEDIA_EXT_RE.test(t))     return { kind: 'media', value: t };
  return { kind: 'web', value: t };
}

function sanitizeName(raw) {
  const cleaned = (raw || '')
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || `Capture ${new Date().toISOString().slice(0, 10)}`;
}

// ── Auth + config ────────────────────────────────────────────────────────────
async function checkAuth() {
  try { return { ok: (await obsidian('/me')).ok }; }
  catch (e) { return { ok: false, error: String(e) }; }
}

async function login({ username, password }) {
  try {
    const res = await obsidian('/login', {
      method: 'POST',
      body: new URLSearchParams({ username, password }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── Capture actions ────────────────────────────────────────────────────────────
// Raw text/markdown → a Capture: the original is kept as a resource and the ingest
// agent synthesizes proposed notes from it (CAPTURE_ARCH.md). The user amends/files
// them in the Learn queue — AI never auto-files.
async function captureText(text, title) {
  const t = title
    ? sanitizeName(title)
    : sanitizeName(text.split('\n').find(l => l.trim()) || '');
  const res = await json('/capture', 'POST', { text, title: t });
  if (res.status === 401) return { ok: false, status: 401 };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, kind: 'text', detail: `Synthesizing notes from “${t}”` };
}

// A URL → the ingest pipeline (extract → synthesize → Learn inbox).
async function capture(url) {
  const res = await json('/capture', 'POST', { url });
  if (res.status === 401) return { ok: false, status: 401 };
  if (res.status === 409) {   // backend duplicate guard — already in the inbox
    let msg = 'Already in your inbox — not capturing it again.';
    try { msg = (await res.json()).message || msg; } catch { /* keep default */ }
    return { ok: false, duplicate: true, status: 409, detail: msg };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true };
}

// Keep a watchable/readable copy in _workspace (media-file URL).
async function workspaceSave(url) {
  const res = await json('/workspace/save', 'POST', { url });
  if (res.status === 401) return { ok: false, status: 401 };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true };
}

// Keep a watchable copy via yt-dlp (video-platform URL). Fire-and-forget: we don't
// poll the job — the file appears in Learn when it's done.
async function startDownload(url) {
  const res = await json('/download', 'POST', { url });
  if (res.status === 401) return { ok: false, status: 401 };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true };
}

// Google Drive "view" links wrap the file in a JS viewer — no bytes in the HTML, so a
// server-side scrape fails. But the EXTENSION has the user's Google session, so it can pull
// the file straight from Drive's download endpoint (works for private files too), then hand
// the real bytes to ingest. driveFileId → the file id from the common Drive URL shapes.
const DRIVE_FILE_RE = /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|.*\/d\/)([\w-]{20,})/;
function driveFileId(url) { const m = DRIVE_FILE_RE.exec(url || ''); return m ? m[1] : null; }

async function captureDriveFile(url) {
  const id = driveFileId(url);
  if (!id) return { ok: false, error: 'not a drive file url' };
  const dl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  let res;
  try { res = await fetch(dl, { credentials: 'include' }); }
  catch (e) { return { ok: false, error: `drive fetch failed: ${e}` }; }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  // HTML back = virus-scan interstitial or an access wall — we didn't get the file.
  if (!res.ok || ct.includes('text/html')) {
    return { ok: false, error: `drive returned ${res.status} (${ct || 'no type'}) — file may be restricted` };
  }
  const cd = res.headers.get('content-disposition') || '';
  const fnm = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const name = (fnm ? decodeURIComponent(fnm[1].replace(/"/g, '')) : `drive_${id}`).trim() || `drive_${id}`;
  const blob = await res.blob();
  const form = new FormData();
  form.append('file', blob, name);
  const up = await obsidian('/workspace/upload', { method: 'POST', body: form });
  if (up.status === 401) return { ok: false, status: 401 };
  if (!up.ok) return { ok: false, status: up.status, error: await up.text() };
  const { path } = await up.json();
  const cap = await capture(path);   // ingest the stored file → extract_pdf/av on the local bytes
  return cap.ok ? { ok: true, kind: 'media', detail: `Pulled "${name}" from Drive + generating notes` } : cap;
}

// Route a single captured string (used by both popup and context menu).
async function routeText(text) {
  if (driveFileId(text)) return captureDriveFile(text.trim());
  const { kind, value } = classify(text);
  if (kind === 'text') return captureText(value);

  // For URLs, always generate notes via /capture. For media/video, also keep a
  // viewable copy in _workspace so it shows up in Learn's player.
  const captureRes = await capture(value);
  if (!captureRes.ok) return captureRes;

  if (kind === 'media') {
    // Ingest downloads the pdf/media into resources/ itself (note-wired + retention). Link only.
    return { ok: true, kind, detail: 'Generating notes + downloading file' };
  }
  if (kind === 'video') {
    // Ingest downloads the video itself (resources/ → playable in Learn). Link only.
    return { ok: true, kind, detail: 'Generating notes + downloading video for playback' };
  }
  return { ok: true, kind, detail: 'Generating notes from the page' };
}

// ── Smart one-click "capture this page" ─────────────────────────────────────────
// Below this many chars of scraped text the page is JS-rendered / paywalled / mostly
// media → don't ship an empty note; escalate to the agent with the raw URL instead.
const MIN_SCRAPE_CHARS = 200;

// Injected into the page (must be self-contained — executeScript serializes it). Grabs
// the RENDERED main text the user actually sees, which beats server-side scraping on
// logged-in / SPA pages. Strips chrome (nav/scripts/etc).
function extractPageText() {
  // Scan for embedded videos FIRST (the text pass below strips iframes). Absolute URLs.
  const videos = [];
  const push = (u) => {
    try { const a = new URL(u, location.href).href; if (a && !videos.includes(a)) videos.push(a); }
    catch { /* skip malformed */ }
  };
  document.querySelectorAll('video').forEach(v =>
    push(v.currentSrc || v.src || v.querySelector('source')?.src || ''));
  document.querySelectorAll('iframe[src]').forEach(f => {
    if (/(?:youtube(?:-nocookie)?\.com|youtu\.be|player\.vimeo\.com)/i.test(f.src)) push(f.src);
  });
  const og = document.querySelector(
    'meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"],meta[name="twitter:player"]');
  if (og?.content) push(og.content);

  const pick = document.querySelector('article, main, [role="main"]') || document.body;
  if (!pick) return { title: document.title || '', text: '', videos };
  const clone = pick.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,svg,button,form,iframe')
    .forEach(n => n.remove());
  const text = (clone.innerText || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title: document.title || '', text, videos };
}

// A scanned embed URL → a URL the ingest pipeline can actually handle, or null to skip.
// YouTube embeds → canonical watch URL (router only recognizes watch/shorts/live); direct
// media files pass through (ingest §2c downloads them). Others (e.g. vimeo player) skipped
// for now — the ingest can't route them yet.
function normalizeVideoUrl(u) {
  const yt = /(?:youtube(?:-nocookie)?\.com)\/embed\/([\w-]{11})/.exec(u);
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
  if (/(?:^|\.)(youtube\.com|youtu\.be)\b/i.test(u)) return u;
  if (/\.(mp4|webm|mov|m4v|m4a|mp3)(?:[?#]|$)/i.test(u)) return u;
  return null;
}

async function scrapeTab(tabId) {
  try {
    const results = await api.scripting.executeScript({ target: { tabId }, func: extractPageText });
    return results?.[0]?.result || null;
  } catch { return null; }   // restricted page (chrome://, store) or no host permission
}

// Escalate to the agent: hand the raw URL to /capture so the backend ingest pipeline
// (extract → synthesize) tries its own extraction/download. The fallback when the
// client-side smart path can't do it (scrape too thin, download failed).
async function escalate(url, note) {
  const cap = await capture(url);
  if (!cap.ok) return cap;
  return { ok: true, kind: 'agent', detail: note || 'Handed to the agent to extract' };
}

// The smart button: look at the active tab and do the right thing.
//   youtube/video → download (yt-dlp) + notes   ·   pdf/media → download file + notes
//   web page      → scrape the RENDERED text and send it as text
//   anything that fails → escalate to the agent (raw URL → ingest)
async function capturePage({ url, tabId }) {
  if (!url || !URL_RE.test(url)) {
    return { ok: false, error: 'This page can’t be captured (not a web URL).' };
  }
  if (driveFileId(url)) return captureDriveFile(url);   // pull the real file via the user's session
  const { kind, value } = classify(url);

  if (kind === 'video') {
    // Just pass the link — the ingest pipeline downloads the video (into resources/, for
    // in-app playback + keyframes) as part of /capture. No separate /download grab.
    const cap = await capture(value);
    if (cap.duplicate) return cap;
    if (!cap.ok) return escalate(value, 'Capture failed — agent will try the URL');
    return { ok: true, kind, detail: 'Generating notes + downloading video for playback' };
  }
  if (kind === 'media') {   // pdf / direct media file — ingest downloads it into resources/
    const cap = await capture(value);
    if (cap.duplicate) return cap;
    if (!cap.ok) return escalate(value, 'Capture failed — agent will try the URL');
    return { ok: true, kind, detail: 'Generating notes + downloading file' };
  }

  // web page → scrape the rendered text client-side AND detect embedded videos.
  const scraped = tabId != null ? await scrapeTab(tabId) : null;
  // Capture any embedded video(s) so they get the full ingest (download → resources +
  // transcript + keyframes + bounded clips), same as a direct video capture. Deduped,
  // capped so a gallery page can't fan out into dozens of jobs.
  const foundVideos = [...new Set((scraped?.videos || []).map(normalizeVideoUrl).filter(Boolean))].slice(0, 4);
  for (const v of foundVideos) await capture(v);

  const hasText = scraped && (scraped.text || '').length >= MIN_SCRAPE_CHARS;
  if (hasText) {
    const res = await captureText(scraped.text, scraped.title);
    if (foundVideos.length) res.detail = `Notes from page + ${foundVideos.length} embedded video(s)`;
    return res;
  }
  if (foundVideos.length) {
    return { ok: true, kind: 'video', detail: `Captured ${foundVideos.length} embedded video(s) from the page` };
  }
  return escalate(value, 'Page scrape was thin — agent extracting from the URL');
}

// A dropped local file → store in _workspace, then ingest it for notes.
async function uploadFile({ name, type, dataB64 }) {
  try {
    const bytes = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: type || 'application/octet-stream' }), name);
    const res = await obsidian('/workspace/upload', { method: 'POST', body: form });
    if (res.status === 401) return { ok: false, status: 401 };
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
    const { path } = await res.json();
    // Ingest the stored file for notes (vault-relative path is a valid ingest ref).
    await capture(path).catch(() => {});
    return { ok: true, kind: 'file', detail: `Uploaded “${name}” + generating notes` };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── Message router (popup → background) ─────────────────────────────────────────
const HANDLERS = {
  checkAuth: () => checkAuth(),
  login,
  routeText: ({ text }) => routeText(text),
  capturePage,
  uploadFile,
  getConfig: () => getConfig(),
  setConfig: (patch) => setConfig(patch).then(() => { connectAgentWs(); return { ok: true }; }),
};

// ── Agent-escalation browser tools (over the /agent-ws WebSocket) ────────────────
// The escalation agent (embedder) sends {id, tool, args} down this socket; we run the tool
// against the OPEN tab for the failed URL and reply {id, result}. Scoped to the failed tab's
// origin (AGENT_ESCALATION.md security decision). Off unless an agentWsToken is configured.
async function findTabForUrl(url) {
  try {
    const origin = new URL(url).origin;
    const tabs = await api.tabs.query({});
    return tabs.find(t => { try { return new URL(t.url).origin === origin; } catch { return false; } }) || null;
  } catch { return null; }
}

function agentScanDom() {   // injected — self-contained
  const cap = (s, n) => (s || '').trim().slice(0, n);
  const links = [...document.querySelectorAll('a[href]')].slice(0, 80)
    .map(a => ({ text: cap(a.innerText, 60), href: a.href }));
  const buttons = [...document.querySelectorAll('button,[role=button],a[download]')].slice(0, 40)
    .map(b => ({ text: cap(b.innerText || b.getAttribute('aria-label'), 60),
                 download: b.getAttribute('download') || null, href: b.href || null }));
  const meta = {};
  document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')
    .forEach(m => { meta[m.getAttribute('property') || m.getAttribute('name')] = m.content; });
  return { title: document.title, url: location.href, text: cap(document.body?.innerText, 3000),
           links, buttons, meta };
}

function agentScanNetwork() {   // injected — resource URLs the page fetched
  return performance.getEntriesByType('resource').slice(0, 150)
    .map(e => ({ name: e.name, type: e.initiatorType }));
}

async function agentGetDom({ url }) {
  const tab = await findTabForUrl(url);
  if (!tab) return { error: `no open tab for ${url} — the page must be open` };
  const r = await api.scripting.executeScript({ target: { tabId: tab.id }, func: agentScanDom });
  return r?.[0]?.result || { error: 'dom scan failed' };
}
async function agentGetNetwork({ url }) {
  const tab = await findTabForUrl(url);
  if (!tab) return { error: `no open tab for ${url}` };
  const r = await api.scripting.executeScript({ target: { tabId: tab.id }, func: agentScanNetwork });
  return { requests: r?.[0]?.result || [] };
}
// Fetch a resource with the USER'S session and upload it → returns the vault path the agent
// then submits. Origin-scoped: refuses unless a tab on that origin is open.
async function agentBrowserFetch({ url }) {
  if (!(await findTabForUrl(url))) return { error: 'refused — no open tab on that origin (scope)' };
  let res;
  try { res = await fetch(url, { credentials: 'include' }); } catch (e) { return { error: String(e) }; }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok || ct.includes('text/html')) return { status: res.status, content_type: ct, note: 'not a file (HTML/error)' };
  const cd = res.headers.get('content-disposition') || '';
  const fnm = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const name = (fnm ? decodeURIComponent(fnm[1].replace(/"/g, '')) : `agent_${Date.now()}`).trim();
  const form = new FormData();
  form.append('file', await res.blob(), name);
  const up = await obsidian('/workspace/upload', { method: 'POST', body: form });
  if (!up.ok) return { error: `upload failed ${up.status}` };
  const { path } = await up.json();
  return { uploaded: path, content_type: ct, filename: name };
}

// Keep a short rolling log of the agent's lifecycle events so the popup can show what it's
// doing (started / which tool / recovered-or-gave-up). Stored so the popup reads it live.
async function recordAgentEvent(e) {
  const { agentLog = [] } = await api.storage.local.get('agentLog');
  agentLog.push({ ...e, ts: Date.now() });
  await api.storage.local.set({ agentLog: agentLog.slice(-40) });
}

const AGENT_TOOLS = { get_dom: agentGetDom, get_network: agentGetNetwork, browser_fetch: agentBrowserFetch };
let agentWs = null, agentWsTimer = null;

async function connectAgentWs() {
  const { obsidianApi, agentWsToken } = await getConfig();
  if (!agentWsToken) return;   // disabled until a token is set
  const base = (obsidianApi || '').replace(/\/api\/?$/, '').replace(/^http/, 'ws');
  try {
    const ws = new WebSocket(`${base}/agent-ws?token=${encodeURIComponent(agentWsToken)}`);
    agentWs = ws;
    ws.onmessage = async (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.event) { await recordAgentEvent(m); return; }   // status event (start/tool/done)
      const fn = AGENT_TOOLS[m.tool];
      let result;
      try { result = fn ? await fn(m.args || {}) : { error: `unknown tool ${m.tool}` }; }
      catch (e) { result = { error: String(e) }; }
      if (ws.readyState === 1) ws.send(JSON.stringify({ id: m.id, result }));
    };
    ws.onclose = () => { agentWs = null; scheduleAgentReconnect(); };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
  } catch { scheduleAgentReconnect(); }
}
function scheduleAgentReconnect() {
  clearTimeout(agentWsTimer);
  agentWsTimer = setTimeout(connectAgentWs, 15000);   // MV3: SW may sleep; reconnects when woken
}
connectAgentWs();

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) { sendResponse({ ok: false, error: `unknown message: ${msg?.type}` }); return false; }
  Promise.resolve(handler(msg.payload || {})).then(sendResponse);
  return true; // async response
});

// ── Context menu (right-click → Send to Learn) ──────────────────────────────────
const MENU = [
  { id: 'learn-selection', title: 'Send selection to Learn', contexts: ['selection'] },
  { id: 'learn-link',      title: 'Send link to Learn',      contexts: ['link'] },
  { id: 'learn-page',      title: 'Send this page to Learn', contexts: ['page'] },
];

function installMenus() {
  api.contextMenus.removeAll(() => MENU.forEach(m => api.contextMenus.create(m)));
}

async function flashBadge(ok) {
  try {
    await api.action.setBadgeBackgroundColor({ color: ok ? '#4cc38a' : '#e05c5c' });
    await api.action.setBadgeText({ text: ok ? '✓' : '!' });
    setTimeout(() => api.action.setBadgeText({ text: '' }), 2500);
  } catch { /* badge is best-effort */ }
}

api.contextMenus.onClicked.addListener(async (info, tab) => {
  let res;
  if (info.menuItemId === 'learn-page') {
    // whole page → smart capture (scrape rendered text / download / escalate)
    res = await capturePage({ url: info.pageUrl, tabId: tab?.id });
  } else {
    const text = info.menuItemId === 'learn-selection' ? info.selectionText : info.linkUrl;
    if (!text) return;
    res = await routeText(text);
  }
  flashBadge(res.ok);
});

// ── Install: create menus + open the onboarding tab once ────────────────────────
api.runtime.onInstalled.addListener((details) => {
  installMenus();
  if (details.reason === 'install') {
    api.tabs.create({ url: api.runtime.getURL('onboarding.html') });
  }
});

// Firefox event pages can be torn down; rebuild menus on startup too.
api.runtime.onStartup?.addListener(() => { installMenus(); connectAgentWs(); });
