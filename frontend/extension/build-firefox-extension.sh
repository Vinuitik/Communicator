#!/usr/bin/env bash
# Generates extension-firefox/ — a Firefox-loadable copy of extension/.
#
# SSOT: extension/manifest.json is the ONE canonical manifest (name, icons,
# permissions, action, etc). extension/manifest.firefox.overlay.json holds ONLY
# the fields that must differ for Firefox — background and
# browser_specific_settings.gecko — because Chrome MV3 requires
# `background.service_worker` while Firefox MV3 wants `background.scripts`, and
# only Firefox understands `browser_specific_settings`. There is no second full
# manifest to drift out of sync: any change to permissions/icons/name/etc lives
# in manifest.json alone and both browsers pick it up automatically.
#
# Merge semantics: `jq -s '.[0] + .[1]'` is a SHALLOW merge — every top-level key
# present in the overlay (background/browser_specific_settings) fully REPLACES
# that key from the base manifest; it does not recurse into nested objects.
# That's required here: the overlay's `background` object must wholly replace
# the base's, not field-merge with it.
#
# Run after any edit to extension/, then in Firefox:
#   about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> pick
#   frontend/extension-firefox/manifest.json
# (This is a per-session load — it disappears on browser restart until the
# extension is signed via AMO. That's the next step, not done yet.)
#
# Chrome/Edge/Brave keep loading the original extension/ folder unchanged,
# and extension/package.sh (the Chrome zip for /downloads/) is unaffected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SRC="$SCRIPT_DIR"
OUT="$ROOT_DIR/extension-firefox"

command -v jq >/dev/null || { echo "✖ jq is required (sudo apt install jq)"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"

cp -r "$SRC/." "$OUT/"
rm -f "$OUT/manifest.firefox.overlay.json" "$OUT/build-firefox-extension.sh" "$OUT/package.sh"
jq -s '.[0] + .[1]' "$SRC/manifest.json" "$SRC/manifest.firefox.overlay.json" > "$OUT/manifest.json"

echo "Firefox extension ready: $OUT"
echo "Load it: about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> select frontend/extension-firefox/manifest.json"
