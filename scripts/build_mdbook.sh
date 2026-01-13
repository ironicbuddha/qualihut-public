#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MANIFEST="${1:-$ROOT_DIR/manifests/theplayerguide.manifest}"
OUT_SRC_DIR="${OUT_SRC_DIR:-$ROOT_DIR/.mdbook-src}"
OUT_SITE_DIR="${OUT_SITE_DIR:-$ROOT_DIR/site}"

python3 "$ROOT_DIR/scripts/generate_mdbook.py" \
  --root "$ROOT_DIR" \
  --manifest "$MANIFEST" \
  --out-src "$OUT_SRC_DIR" \
  --title "Qualihut Player Guide"

if command -v mdbook >/dev/null 2>&1; then
  rm -rf "$OUT_SITE_DIR"
  mdbook build "$OUT_SRC_DIR" -d "$OUT_SITE_DIR"
  echo "Wrote site: $OUT_SITE_DIR/index.html"
else
  echo "mdbook is not installed; generated sources only: $OUT_SRC_DIR"
  echo "Install: https://rust-lang.github.io/mdBook/ (or via your package manager)"
fi

