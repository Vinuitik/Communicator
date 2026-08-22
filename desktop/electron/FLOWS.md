# Desktop Shell — Electron wrapper around the live web app

Files: main.js, package.json, build.sh, icon.png

This is a native window, nothing more. There is no local copy of the React
app anywhere in this module — `main.js` always loads `https://communicator.work/app/`
fresh, every launch. No webpack, no bundler, no offline cache. If the
frontend or backend deploy changes, desktop users see it on their very next
launch with zero action on this module's part.

## Launch flow
```
app.whenReady()
  → createWindow() [main.js]
      → new BrowserWindow({...})
      → win.webContents.setWindowOpenHandler(...)   // popups
      → win.webContents.on('will-navigate', ...)     // in-place nav
      → win.loadURL('https://communicator.work/app/')
```
`To change the URL loaded: main.js`'s `PROD_URL` constant.`

## Navigation policy
Two hooks, same rule (cross-origin → hand off to the OS browser; same-origin
→ let it happen in this window):
```
setWindowOpenHandler({url})
  → hostname === 'communicator.work'  → { action: 'deny' }   (no second window)
  → else                              → shell.openExternal(url), { action: 'deny' }

will-navigate (event, url)
  → hostname === 'communicator.work'  → no-op, navigation proceeds normally
  → else                              → event.preventDefault() + shell.openExternal(url)
```
The Google Drive OAuth flow (`<a href="/backup/oauth/url">`, same-tab,
same-origin at the point of click, cross-origin once Google's consent screen
loads) is **not** special-cased here on purpose: it's a normal top-level
navigation, and Google's domain is a different hostname, so the
`will-navigate` hook would send the user's own OAuth consent screen out to
their system browser. That's a known rough edge, not yet fixed — see
`## Change Index` if this needs tightening (e.g. allow-listing
`accounts.google.com` in addition to `communicator.work`).
`[NOT IMPLEMENTED]`: OAuth-aware navigation allow-list.

## build.sh — produces the two files nginx serves at /downloads/
```
build.sh
  → docker run electronuserland/builder:wine
      → npm install
      → npx electron-builder --win nsis --linux AppImage
  → find dist/ for the produced .exe / .AppImage
  → cp → infra/nginx/static/downloads/communicator-desktop-setup.exe
  → cp → infra/nginx/static/downloads/communicator-desktop.AppImage
```
Host has no node/npm on PATH by design (matches the rest of this repo's
frontend build story) — everything Node-related for this module happens
inside the `electronuserland/builder:wine` container. Wine is only needed
to cross-build the Windows NSIS installer from Linux; the AppImage target
doesn't need it but the same container has it anyway.

Like `frontend/extension/package.sh`, the built artifact is meant to be
committed and served statically by nginx (`infra/nginx/Dockerfile` bakes
`nginx/static/` into the image at build time) — re-run `build.sh` and
commit the two output files after any change under `desktop/electron/`.

`To change the output filenames: package.json`'s `build.win.artifactName` /
`build.linux.artifactName`, AND `build.sh`'s `WIN_OUT` / `LINUX_OUT` — other
parts of the app (the downloads page) depend on these exact names, so don't
change one without the other.`

## Technology Notes

**Unsigned binaries — expected, not a bug.** Neither binary is code-signed:
- Windows: no code-signing certificate exists for this project. Users will
  see the SmartScreen "Windows protected your PC" warning and have to click
  "More info" → "Run anyway". This is standard for unsigned installers, not
  a broken build.
- Linux: the AppImage has no signature either, and AppImages generally
  aren't executable as downloaded — the user (or a future installer script)
  needs `chmod +x communicator-desktop.AppImage` before it will run.

**No auto-updater, and there doesn't need to be one.** Unlike the PWA's
`frontend/react/src/pwa/registerSW.ts` (which has to detect a new
service-worker version and show an "update available" banner because it
caches app code locally), this shell caches nothing — `loadURL()` re-fetches
the live site on every launch. A new deploy is live for desktop users
immediately, with no update flow, banner, or version check to build or
maintain. The only thing that would ever need re-downloading is the shell
binary itself (e.g. if `main.js`'s navigation policy changes), and there's
no mechanism for that today.

**Electron version drift.** `package.json` pins `electron` and
`electron-builder` with `^` ranges — a fresh `npm install` months from now
can pull a newer Electron than what was tested here. `setWindowOpenHandler`
is the modern (Electron 15+) API for this; if it's ever removed/renamed
upstream, `build.sh`'s docker build will fail loudly at compile/package
time rather than silently, since electron-builder pulls the actual binary
during packaging.

**Container image weight.** `electronuserland/builder:wine` is ~6.3GB. It's
assumed pre-pulled on this host; `build.sh` does not pull it and will just
fail with a normal docker "image not found" error on a machine that doesn't
have it, which is a reasonable failure mode for a manual, non-CI build
script.

`[NOT IMPLEMENTED]`: macOS build target, code signing / notarization
(Windows or macOS), auto-update mechanism, OAuth-aware navigation
allow-listing (see above).

## Change Index

| Touchable thing | Where |
|---|---|
| Prod URL loaded on launch | `main.js` → `PROD_URL` constant |
| Window title / size | `main.js` → `createWindow()`'s `BrowserWindow` options |
| App icon | `icon.png` (copied from `frontend/react/public/logo512.png`) + `package.json`'s `build.win.icon` / `build.linux.icon` |
| External vs. in-window navigation rule | `main.js` → `setWindowOpenHandler` and `will-navigate` handler |
| Build/output filenames (must match downloads page links) | `package.json` → `build.win.artifactName` / `build.linux.artifactName`, and `build.sh` → `WIN_OUT` / `LINUX_OUT` |
| Build targets (Win/Linux only, no macOS) | `package.json` → `build.win` / `build.linux`, and `build.sh`'s `electron-builder` flags |
| Docker build image | `build.sh` → `electronuserland/builder:wine` |
| Electron / electron-builder versions | `package.json` → `devDependencies` |
