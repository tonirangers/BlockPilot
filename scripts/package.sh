#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
OUT="$DIST/blockpilot-site.zip"
mkdir -p "$DIST"
rm -f "$OUT"
cd "$ROOT"
zip -r "$OUT" fr en assets data README.md scripts >/dev/null
echo "Created $OUT"
