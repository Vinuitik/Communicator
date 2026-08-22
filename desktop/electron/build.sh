#!/usr/bin/env bash
# Builds the Communicator Electron desktop shell (Windows installer + Linux
# AppImage) and drops both at the fixed download paths nginx serves.
#
# Host has no node/npm on PATH by design — the actual npm install + build
# runs inside electronuserland/builder:wine (already pulled locally), which
# ships Node, Wine (for building the Windows target on Linux) and the
# electron-builder toolchain.
#
# Modeled on frontend/extension/package.sh: plain script, no CI assumptions,
# output path resolved relative to this script so it lands in the right
# place whether run from a full checkout or a worktree.
set -euo pipefail
cd "$(dirname "$0")"

DOWNLOADS_DIR="../../infra/nginx/static/downloads"
WIN_OUT="$DOWNLOADS_DIR/communicator-desktop-setup.exe"
LINUX_OUT="$DOWNLOADS_DIR/communicator-desktop.AppImage"

mkdir -p "$DOWNLOADS_DIR"
rm -rf dist

docker run --rm -v "$(pwd):/project" -w /project electronuserland/builder:wine \
  /bin/bash -c "npm install && npx electron-builder --win nsis --linux AppImage"

# electron-builder's artifactName is pinned in package.json's build config,
# but glob defensively in case a future electron-builder version ignores it
# or names things differently for some target combo.
WIN_SRC="$(find dist -maxdepth 1 -iname '*.exe' | head -n1)"
LINUX_SRC="$(find dist -maxdepth 1 -iname '*.AppImage' | head -n1)"

if [[ -z "$WIN_SRC" ]]; then
  echo "build.sh: no .exe found in dist/ — Windows build failed" >&2
  exit 1
fi
if [[ -z "$LINUX_SRC" ]]; then
  echo "build.sh: no .AppImage found in dist/ — Linux build failed" >&2
  exit 1
fi

cp "$WIN_SRC" "$WIN_OUT"
cp "$LINUX_SRC" "$LINUX_OUT"
chmod +x "$LINUX_OUT"

echo "Wrote $WIN_OUT"
echo "Wrote $LINUX_OUT"
