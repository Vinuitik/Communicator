#!/usr/bin/env bash
# Builds the debug-signed Communicator Android APK and drops it at the fixed
# nginx download path. No host-Node/host-Android-SDK assumption — everything
# (npm install, `cap add/sync android`, the Gradle build) runs inside the
# `communicator-android-builder` image (see android-build/Dockerfile), the
# same way frontend/extension/package.sh keeps its build self-contained.
#
# Usage: bash mobile/capacitor/build.sh
# Prereq: `docker build -t communicator-android-builder -f android-build/Dockerfile android-build/`
set -euo pipefail
cd "$(dirname "$0")"

# Fixed absolute path — the one deliberate cross-boundary write this module
# makes. Other parallel tasks (nginx serving, GetAppPage UI) depend on the
# APK landing at this exact filename on the real host checkout, not inside
# whatever worktree this build ran from.
IMAGE=communicator-android-builder
OUT_APK="/home/victor/Desktop/Communicator/infra/nginx/static/downloads/communicator.apk"
# Persisted across runs (gitignored) so the debug keystore Gradle auto-generates
# on first use doesn't get regenerated with a new key every time this script
# runs in a fresh --rm container. Android refuses to install an update over an
# existing app unless it's signed with the same key, so without this, every
# rebuild would force everyone who already sideloaded the app to fully
# uninstall first — losing their offline-outbox IndexedDB queue in the process.
ANDROID_HOME_CACHE="$(pwd)/.android-home"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Image $IMAGE not found — building it now (one-time, multi-GB, can take 10-20+ min)..."
  docker build -t "$IMAGE" -f android-build/Dockerfile android-build/
fi

mkdir -p "$ANDROID_HOME_CACHE"

# Everything below runs *inside* the builder container, with this directory
# bind-mounted at /project, so npm/cap/gradle outputs land back on the host
# for the final cp step. /root/.android is also bind-mounted so the debug
# keystore persists across separate --rm container runs (see comment above).
docker run --rm \
  -v "$(pwd)":/project \
  -v "$ANDROID_HOME_CACHE":/root/.android \
  -w /project \
  "$IMAGE" \
  bash -euc '
    npm install

    if [ ! -d android ]; then
      npx cap add android
    else
      npx cap sync android
    fi

    cd android
    chmod +x ./gradlew
    ./gradlew assembleDebug --no-daemon
  '

BUILT_APK="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$BUILT_APK" ]; then
  echo "Build finished but $BUILT_APK is missing — check Gradle output above." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_APK")"
cp "$BUILT_APK" "$OUT_APK"
echo "Wrote $OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
