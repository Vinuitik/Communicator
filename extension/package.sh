#!/usr/bin/env bash
# Rebuilds the downloadable extension zip served by nginx at /downloads/.
# Run this after ANY change under extension/ and commit the result —
# nginx/Dockerfile bakes nginx/static/ into the image at build time (see
# nginx/FLOWS.md), so the zip has to be checked in, not generated on the fly.
set -euo pipefail
cd "$(dirname "$0")"

OUT="../nginx/static/downloads/communicator-extension.zip"
rm -f "$OUT"
zip -r "$OUT" . -x ".*" -x "package.sh" -x "*.md"
echo "Wrote $OUT"
