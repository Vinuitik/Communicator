#!/usr/bin/env bash
# One-command Firefox extension deploy: edit code → run this → Firefox auto-updates.
#
# Pipeline: bump patch version → build extension-firefox/ → sign via AMO (unlisted,
# in a throwaway node container) → publish the signed .xpi + a regenerated
# updates.json into ../ext-dist/, which nginx serves at /ext/. The installed add-on
# polls .../ext/updates.json (its gecko.update_url) and upgrades itself — no manual
# "Install Add-on From File" after the first time.
#
# ── One-time setup (do these ONCE, in order) ─────────────────────────────────
#   1. manifest.firefox.overlay.json already carries gecko.update_url →
#      https://communicator.work/ext/updates.json, and docker-compose.yml mounts
#      ./ext-dist:/ext-dist:ro with nginx's /ext/ route (see nginx/nginx.conf).
#   2. Rebuild/restart nginx so that route + mount go live:
#        docker compose up -d nginx
#   3. Set your AMO API creds (https://addons.mozilla.org/developers/addon/api/key/,
#      reusable from ObsidianOptimizer if you already have one) in .env:
#        AMO_KEY=<JWT issuer>
#        AMO_SECRET=<JWT secret>
#   4. Run this script once, then install the produced .xpi ONCE from
#      about:addons → ⚙ → Install Add-on From File (so Firefox learns the update_url).
#
# ── Every time after that ────────────────────────────────────────────────────
#   edit extension/ code → ./extension/deploy-extension.sh
#   → in Firefox: about:addons → ⚙ → Check for Updates  (instant; or just wait).
#
# Notes / failure modes:
#   * --timeout=240000 keeps the signing JWT under AMO's 5-min exp cap (sign-addon#1273).
#   * AMO refuses a duplicate version, so the patch bump is mandatory each run.
#   * The node container runs as YOU (--user) so artifacts aren't root-owned;
#     the npx/web-ext download is cached in ../.web-ext-cache to keep re-signs fast.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

MANIFEST="extension/manifest.firefox.overlay.json"
EXT_ID="communicator-extension@communicator.work"
BASE_URL="https://communicator.work/ext"
DIST="ext-dist"

# AMO creds: prefer a value already exported in the shell, otherwise pull it from
# .env. We read ONLY these two keys (not `source .env`) because .env holds values
# with spaces/# that would break under `set -e` — compose parses .env with its own
# parser, so a shell `source` is not equivalent. `:=` means an exported shell value
# wins; `tr -d '\r'` guards against CRLF line endings.
if [ -f "$ROOT_DIR/.env" ]; then
  : "${AMO_KEY:=$(grep -E '^AMO_KEY=' "$ROOT_DIR/.env" | tail -1 | cut -d= -f2- | tr -d '\r')}"
  : "${AMO_SECRET:=$(grep -E '^AMO_SECRET=' "$ROOT_DIR/.env" | tail -1 | cut -d= -f2- | tr -d '\r')}"
  export AMO_KEY AMO_SECRET
fi

: "${AMO_KEY:?set AMO_KEY (JWT issuer) in .env or export it — https://addons.mozilla.org/developers/addon/api/key/}"
: "${AMO_SECRET:?set AMO_SECRET (JWT secret) in .env or export it}"

# ── 1. bump patch version (0.1.0 → 0.1.1) ────────────────────────────────────
CUR=$(grep -oP '"version"\s*:\s*"\K[^"]+' "$MANIFEST")
IFS=. read -r MA MI PA <<<"$CUR"
NEW="$MA.$MI.$((PA + 1))"
sed -i "s/\"version\": \"$CUR\"/\"version\": \"$NEW\"/" "$MANIFEST"
echo "▶ version $CUR → $NEW"

# ── 2. build the Firefox-loadable folder from extension/ ─────────────────────
bash "$SCRIPT_DIR/build-firefox-extension.sh" >/dev/null
echo "▶ built extension-firefox/"

# ── 3. sign via AMO (unlisted) in a throwaway node container ─────────────────
rm -rf extension-firefox/web-ext-artifacts
# Pre-create the cache dir as us — otherwise Docker auto-creates a missing bind
# mount source as root, and the container's non-root --user then can't write to it.
mkdir -p "$ROOT_DIR/.web-ext-cache"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e AMO_KEY -e AMO_SECRET \
  -v "$ROOT_DIR/extension-firefox":/ext -w /ext \
  -v "$ROOT_DIR/.web-ext-cache":/tmp/.npm \
  node:20-alpine \
  npx --yes web-ext@latest sign \
  --channel=unlisted \
  --timeout=240000 \
  --api-key="$AMO_KEY" \
  --api-secret="$AMO_SECRET"

XPI=$(ls -t extension-firefox/web-ext-artifacts/*.xpi 2>/dev/null | head -1 || true)
[ -n "$XPI" ] || {
  echo "✖ no .xpi produced — signing failed (see output above)"
  exit 1
}
echo "▶ signed: $XPI"

# ── 4. publish: copy .xpi + regenerate updates.json ──────────────────────────
mkdir -p "$DIST"
DEST_XPI="$DIST/communicator-extension-$NEW.xpi"
cp "$XPI" "$DEST_XPI"
# Stable, unversioned alias — GetAppPage links here so the "Install for Firefox"
# button never needs updating when a new version ships.
cp "$XPI" "$DIST/communicator-extension-latest.xpi"
HASH="sha256:$(sha256sum "$DEST_XPI" | cut -d' ' -f1)"

cat >"$DIST/updates.json" <<JSON
{
  "addons": {
    "$EXT_ID": {
      "updates": [
        {
          "version": "$NEW",
          "update_link": "$BASE_URL/communicator-extension-$NEW.xpi",
          "update_hash": "$HASH"
        }
      ]
    }
  }
}
JSON

echo "▶ published → $DEST_XPI"
echo
echo "✅ v$NEW live at $BASE_URL/communicator-extension-$NEW.xpi"
echo "   Firefox auto-updates on its next poll — force it now:"
echo "   about:addons → ⚙ → Check for Updates"
echo "   (FIRST time only: install $DEST_XPI once from ⚙ → Install Add-on From File)"
