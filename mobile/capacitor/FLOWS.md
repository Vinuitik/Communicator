# Android Shell — Capacitor Wrapper Around the Live Web App
Files: capacitor.config.json, package.json, build.sh, android-build/Dockerfile, www/index.html

This is a thin native shell, not a rewrite: it does not bundle a static snapshot of
`frontend/react`. Every launch loads the live prod URL directly into the WebView, the same
way `desktop/electron`'s `BrowserWindow` does. See `flows/native-app-downloads.md` for the
cross-module picture (nginx `/downloads/` → this APK → live URL) and `pwa/FLOWS.md` for why
the offline-outbox/IndexedDB sync code needs no changes to run inside this WebView.

## Entry point
```
capacitor.config.json: server.url = "https://communicator.work/app/"
  → app launch → Capacitor's WebView navigates straight to that URL
  → www/index.html never actually renders — it only exists because `cap add android`'s
    scaffolding requires a webDir, and Capacitor falls back to it if server.url is ever
    unset (it isn't).
```
`To change the loaded URL: capacitor.config.json's server.url.` No rebuild-per-deploy: like
the Electron shell, changing the prod app doesn't require touching this module at all.

## Build pipeline (`build.sh`)
```
build.sh
  → docker image inspect communicator-android-builder (build it if missing — see below)
  → docker run (bind-mounts this dir at /project)
      npm install
      npx cap add android    [first run only — generates android/]
      npx cap sync android   [subsequent runs — copies www/ + config into android/]
      cd android && ./gradlew assembleDebug --no-daemon
  → cp android/app/build/outputs/apk/debug/app-debug.apk
      → /home/victor/Desktop/Communicator/infra/nginx/static/downloads/communicator.apk
```
`android/` (the generated Gradle project) and `node_modules/` are build output, not checked
in — re-run `build.sh` to regenerate either. The APK's destination is a **fixed absolute
host path**, not a path relative to whichever worktree `build.sh` happens to run from —
other tasks (nginx serving the download, the Get App page UI) depend on that exact filename
existing on the real checkout. `To change the output filename: build.sh`'s `OUT_APK`, and
update the nginx-facing contract (`flows/native-app-downloads.md`, `GetAppPage.tsx`) to
match — don't rename unilaterally.

## `android-build/Dockerfile` — the one-time SDK/toolchain cost
No Android SDK existed anywhere on this machine before this module. The image bundles:
- `eclipse-temurin:21-jdk` as the base (Ubuntu), **not** `node:20` (Debian bookworm) — bookworm's
  apt repos only carry `openjdk-17-jdk`, not 21, and it isn't in `bookworm-backports` either.
  Temurin ships JDK 21 directly; Ubuntu's own repos carry a recent Node.js/npm (22.x at build
  time), so `apt-get install nodejs npm` on top of Temurin avoids needing NodeSource or a
  third-party JDK PPA.
- Android cmdline-tools, with `sdkmanager --licenses` accepted non-interactively (`yes |`),
  then `platform-tools` + `build-tools;34.0.0` + `platforms;android-34` installed.
- ~1.9GB final image size, ~20s build once base layers are cached (longer, 10-20+ min, on a
  fully cold pull — this was flagged as a real one-time cost, not a hang).

`To bump the Android API level or build-tools version: android-build/Dockerfile`'s
`sdkmanager --install` line, matching whatever Capacitor's `@capacitor/android` version
expects. `To rebuild the image from scratch: docker build -t communicator-android-builder
-f android-build/Dockerfile android-build/` (build.sh does this automatically if the tag is
missing, but won't re-build an existing stale tag — delete the image first to force it).

## Technology Notes

**Debug-signed APK is intentional, not a shortcut to fix later.** `./gradlew assembleDebug`
signs with Gradle's auto-generated debug keystore. This is deliberate: the app is distributed
by direct APK download + sideload, not the Play Store, so there is no Play Integrity check or
store-signing requirement to satisfy. A release-signed APK is out of scope — see
`[NOT IMPLEMENTED]` below.

**The debug keystore persists across builds — `build.sh` mounts `.android-home/` (gitignored,
machine-local) to `/root/.android` inside the otherwise-ephemeral `--rm` build container.**
Without this, every rerun of `build.sh` would auto-generate a *new* debug keystore, and Android
refuses to install an update over an existing app unless it's signed with the same key — so
anyone who'd already sideloaded the app would have to fully uninstall before installing the
next build, losing whatever was in that WebView's local storage (the offline-outbox IndexedDB
queue) in the process. `To force a fresh signing identity` (e.g. you suspect the keystore is
corrupted): delete `mobile/capacitor/.android-home/` before rebuilding — but know that this
breaks updates for anyone already on a build signed with the old key.

**The user must enable "install from unknown sources"** on their Android device before the
downloaded APK will install — this is standard sideload friction with no workaround short of
Play Store distribution (explicitly out of scope). `GetAppPage.tsx`'s Android card copy
should say this explicitly (see `flows/native-app-downloads.md`).

**No auto-update mechanism.** Because the shell always loads the live URL, the *web app*
inside it is always current with no shell rebuild needed. The *shell itself* (this APK) only
needs rebuilding if `capacitor.config.json` or native permissions change — there is no
in-app update check, unlike a Play Store release. A user who never re-downloads the APK
still gets a current web app, just via an old WebView/shell binary.

**No device/emulator exists in this build environment.** `build.sh` produces a real, signed
`app-debug.apk`, verified to exist with nonzero size — but install/launch on an actual
Android device was **not verified here** and needs a manual smoke test.

**Cleartext disabled** (`server.cleartext: false`) — the shell only ever loads `https://`,
matching prod; there's no local-dev HTTP loading mode wired up for this shell.

`[NOT IMPLEMENTED]`: iOS target (no `@capacitor/ios`, no `cap add ios` — Apple explicitly
out of scope for this round), release/Play signing, Play Store publishing, in-app update
checks, push notifications / any native plugin beyond the bare WebView shell.

## Change Index
| Change | Where |
|---|---|
| Prod URL the shell loads | `capacitor.config.json`'s `server.url` |
| App identity (package name, display name) | `capacitor.config.json`'s `appId` / `appName` |
| APK output filename/location | `build.sh`'s `OUT_APK` (fixed contract path — coordinate before renaming) |
| Android SDK / build-tools / platform version | `android-build/Dockerfile`'s `sdkmanager --install` line |
| Builder base image / JDK / Node version | `android-build/Dockerfile`'s `FROM` line + apt package list |
| Capacitor core/CLI/android plugin versions | `package.json` dependencies |
| Placeholder webDir content (never actually shown) | `www/index.html` |
| Cross-module download flow (nginx wiring, UI card copy) | `flows/native-app-downloads.md` |
