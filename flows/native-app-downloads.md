# Flow: Native App Downloads (Electron desktop shell + Capacitor Android shell)

Two new download options on the existing Get App page — a Windows/Linux desktop app and a
sideloadable Android APK — sitting **alongside**, not replacing, the pre-existing PWA install
path. Both are thin shells: neither bundles a static snapshot of the app, both load the live
prod site fresh on every launch. Added because the PWA install path fails outright on Firefox
desktop and is generally high-friction; rather than keep patching install detection, this gives
users two more concrete ways to get the app onto their machine.

Backend mechanics (nginx) and each shell's own build/wiring: [desktop/electron/FLOWS.md](../desktop/electron/FLOWS.md),
[mobile/capacitor/FLOWS.md](../mobile/capacitor/FLOWS.md) (written in parallel — not duplicated
here). This doc is the cross-module narrative: how a click on the Get App page turns into a
running native-ish shell.

Spans **UI → nginx `/downloads/` → COPY-baked binary → shell → live prod URL** for both shells.

---

## Stage 1 — Get App page, card click

```
User opens Get App page                                    [GetAppPage.tsx]
 → "Desktop app" card (Windows / Linux badge) — hidden on mobile
     click "Windows" → GET /downloads/communicator-desktop-setup.exe
     click "Linux"   → GET /downloads/communicator-desktop.AppImage
 → "Android APK" card (Android badge) — shown only on real Android
     click → GET /downloads/communicator.apk
```
These sit next to the existing PWA install card and the browser-extension zip download on the
same page — three unrelated download mechanisms, one page. See `frontend/react/src/pwa/FLOWS.md`'s
Change Index for exactly where each card lives in `GetAppPage.tsx`.

## Stage 2 — nginx serves a baked-in binary, no build step at request time

```
GET /downloads/<filename>
 → nginx location /downloads/  [infra/nginx/nginx.conf]
     Content-Disposition: attachment  (forces a download, no MIME-type awareness needed —
       same mechanism `communicator-extension.zip` already uses, see frontend/extension/PROTO.md)
     serves the file straight from infra/nginx/static/downloads/, COPY-baked into the nginx
       image at Docker build time (infra/nginx/Dockerfile)
```
Fixed filename contract (pinned so the UI, the two build scripts, and this doc never drift):

| File | Path |
|---|---|
| Windows installer | `infra/nginx/static/downloads/communicator-desktop-setup.exe` |
| Linux installer | `infra/nginx/static/downloads/communicator-desktop.AppImage` |
| Android APK | `infra/nginx/static/downloads/communicator.apk` |

Nothing about `/downloads/` itself changed to support these — it was already filename-agnostic.
The only thing that gets a new binary is the Docker build context; landing a new file there and
committing it is what makes nginx pick it up (rebuilt by the repo's post-commit hook).

## Stage 3 — installed shell loads the live site, not a bundled copy

```
Windows/Linux installer run  →  Electron app launches
    desktop/electron/main.js: BrowserWindow.loadURL('https://communicator.work/app/')

APK sideloaded + opened  →  Capacitor WebView launches
    mobile/capacitor/capacitor.config.json: server.url = 'https://communicator.work/app/'
```
Same prod URL both shells point at, confirmed against `infra/nginx/nginx.conf`'s `location /app/`
proxy and `frontend/react/package.json`'s `homepage: "/app"`. Every subsequent app screen is just
that live page rendering inside a native window/webview — there is no offline-first bundled
build in either shell, no local static assets beyond a placeholder scaffold page Capacitor's
tooling requires. A network outage looks the same in either shell as it would in a browser tab.

## Why neither shell needs the PWA's service-worker update flow

`frontend/react/src/pwa/FLOWS.md`'s "Flow — update detection + click-to-apply (registerSW.ts)"
section exists to solve one problem: a PWA install caches a specific build and needs a mechanism
to detect a newer one waiting and let the user apply it. Neither new shell has that problem —
they never cache a build at all. Every launch is a fresh `loadURL`/`server.url` hit against
whatever's live in prod at that moment, so "waiting service worker" / `applyUpdate()` /
`registration.waiting` simply don't apply here. Shipping a newer app version is just a normal
deploy; existing installs of the desktop/Android shell pick it up on next launch automatically,
with no update-detection code of their own to maintain.

---

## The one-time build-tooling costs

Each shell needs its own build environment, built once and reused for subsequent builds — these
are documented in depth in each module's own FLOWS.md, called out here only so a reader knows
they exist and roughly how heavy they are:

- **Desktop**: `desktop/electron/build.sh` cross-builds both the Windows `.exe` and Linux
  `.AppImage` from this Linux host using the `electronuserland/builder:wine` Docker image
  (bundles Node + electron-builder + wine) — no separate Windows machine needed.
- **Android**: `mobile/capacitor/build.sh` needs an Android SDK + Gradle Docker image that does
  not exist anywhere yet, tagged `communicator-android-builder`. Building this image from scratch
  is a genuinely heavy one-time cost — several GB of downloads (cmdline-tools, platform-tools,
  build-tools, platform sources) — not a quick pull like the Electron image.

## Precedent: this isn't the first downloadable build artifact in this repo

`frontend/extension/PROTO.md` documents the browser extension: a script-driven build
(`package.sh`) producing a downloadable zip, served the exact same way (`/downloads/`,
`Content-Disposition: attachment`, COPY-baked into the nginx image, committed to git rather than
built by CI). The desktop and Android shells follow the same shape — own build script, own
FLOWS/PROTO doc, output landing in the same `infra/nginx/static/downloads/` directory — just
with heavier build tooling and larger binaries.

## Scope

`[NOT IMPLEMENTED]`: macOS desktop build/signing (no Mac available to build or sign on) and iOS
(would require Apple's App Store or TestFlight process, not worth the overhead yet). Both are
explicitly deferred, not silently dropped — see `desktop/electron/FLOWS.md` and
`mobile/capacitor/FLOWS.md` for their own scope notes on this.

---

## Change Index

| Want to change… | Where |
|---|---|
| Get App page cards (copy, gating, badges) | `GetAppPage.tsx` (see `frontend/react/src/pwa/FLOWS.md`'s Change Index) |
| Download URL / filename contract | `infra/nginx/static/downloads/` filenames — must match `GetAppPage.tsx`'s hardcoded URLs, `desktop/electron/build.sh`'s output copy step, and `mobile/capacitor/build.sh`'s output copy step, all at once |
| How `/downloads/` serves files (force-download, no MIME awareness) | `infra/nginx/nginx.conf`'s `location /downloads/` (shared with `communicator-extension.zip`, see `frontend/extension/PROTO.md`) |
| When nginx picks up a new binary | `infra/nginx/Dockerfile` (COPY step) + `.git/hooks/post-commit` (rebuilds the stack on every commit) |
| Desktop shell entry point / build | `desktop/electron/FLOWS.md` |
| Android shell entry point / build | `mobile/capacitor/FLOWS.md` |
| Why no SW update-detection logic is needed here | this file's "Why neither shell needs the PWA's service-worker update flow" section — contrast with `frontend/react/src/pwa/FLOWS.md`'s `registerSW.ts` flow |
| Precedent for this artifact shape (script → zip/binary → `/downloads/`) | `frontend/extension/PROTO.md` |
| macOS / iOS scope decision | this file's "Scope" section; per-shell detail in `desktop/electron/FLOWS.md` / `mobile/capacitor/FLOWS.md` |
