#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_DIR="$ROOT_DIR/manifests"

if [[ ! -d "$MANIFEST_DIR" ]]; then
  echo "ERROR: Missing manifests folder: $MANIFEST_DIR" >&2
  exit 1
fi

trim() { sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'; }

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9[:space:]-]//g; s/[[:space:]]+/-/g; s/-+/-/g; s/^-|-$//g'
}

has_pandoc() { command -v pandoc >/dev/null 2>&1; }

extract_title() {
  local file="$1"
  python3 - <<PY
from pathlib import Path
import re
p = Path("$file")
text = p.read_text(encoding="utf-8")
m = re.match(r"^---\\s*\\n(.*?)\\n---\\s*\\n(.*)$", text, re.S)
front = m.group(1) if m else ""
body = m.group(2) if m else text
m_title = re.search(r"^title:\\s*(.+)\\s*$", front, re.M)
if m_title:
    print(m_title.group(1).strip()); raise SystemExit(0)
m_h1 = re.search(r"^#\\s+(.+)$", body, re.M)
print(m_h1.group(1).strip() if m_h1 else p.stem)
PY
}

strip_frontmatter_and_h1() {
  local file="$1"
  python3 - <<PY
from pathlib import Path
import re
text = Path("$file").read_text(encoding="utf-8")
m = re.match(r"^---\\s*\\n(.*?)\\n---\\s*\\n(.*)$", text, re.S)
if m:
    text = m.group(2)
text = re.sub(r"^#\\s+.*\\n", "", text, count=1)
print(text.strip())
PY
}

expand_include() {
  local path="$1"
  if [[ -d "$ROOT_DIR/$path" ]]; then
    find "$ROOT_DIR/$path" -type f -name "*.md" | sort; return 0
  fi
  if [[ "$path" == *"*"* || "$path" == *"?"* || "$path" == *"["* ]]; then
    find "$ROOT_DIR" -type f -name "*.md" -path "$ROOT_DIR/$path" | sort; return 0
  fi
  if [[ -f "$ROOT_DIR/$path" ]]; then
    echo "$ROOT_DIR/$path"; return 0
  fi
  echo "WARN: INCLUDE not found: $path" >&2
  return 0
}

is_excluded() {
  local file="$1"; shift
  local excludes=("${@:-}")
  local rel="${file#$ROOT_DIR/}"
  for pat in "${excludes[@]}"; do
    case "$rel" in
      $pat) return 0 ;;
    esac
  done
  return 1
}

compile_manifest() {
  local manifest="$1"
  local OUTPUT="" TITLE=""
  local includes=() excludes=()

  while IFS= read -r line; do
    line="$(echo "$line" | trim)"
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^# ]] && continue

    if [[ "$line" =~ ^OUTPUT=(.*)$ ]]; then OUTPUT="${BASH_REMATCH[1]}"; continue; fi
    if [[ "$line" =~ ^TITLE=(.*)$ ]]; then TITLE="${BASH_REMATCH[1]}"; continue; fi
    if [[ "$line" =~ ^INCLUDE=(.*)$ ]]; then includes+=("${BASH_REMATCH[1]}"); continue; fi
    if [[ "$line" =~ ^EXCLUDE=(.*)$ ]]; then excludes+=("${BASH_REMATCH[1]}"); continue; fi

    echo "WARN: Unrecognized line in $(basename "$manifest"): $line" >&2
  done < "$manifest"

  [[ -z "$OUTPUT" ]] && { echo "ERROR: Missing OUTPUT= in $manifest" >&2; exit 1; }
  [[ -z "$TITLE" ]] && TITLE="$(basename "$manifest" .manifest)"

  local OUT_MD="$ROOT_DIR/${OUTPUT}.md"
  local OUT_PDF="$ROOT_DIR/${OUTPUT}.pdf"
  mkdir -p "$(dirname "$OUT_MD")"

  local files=()
  for inc in "${includes[@]}"; do
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      files+=("$f")
    done < <(expand_include "$inc")
  done
files_tmp="$(printf "%s
" "${files[@]}" | awk '!seen[$0]++' | sort)"
  files=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    files+=("$line")
  done <<< "$files_tmp"

  local filtered=()
  for f in "${files[@]}"; do
    if is_excluded "$f" "${excludes[@]:-}"; then continue; fi
    filtered+=("$f")
  done
  files=("${filtered[@]}")

  {
    echo "# $TITLE"
    echo
    echo "> This document reflects common knowledge in the world. Rumors, myths, and errors may be present."
    echo
    echo "## Table of Contents"
  } > "$OUT_MD"

  for f in "${files[@]}"; do
    t="$(extract_title "$f")"
    slug="$(slugify "$t")"
    rel="${f#$ROOT_DIR/}"
    echo "- [$t](#$slug)  \`$rel\`" >> "$OUT_MD"
  done

  echo -e "\n---\n" >> "$OUT_MD"

  for f in "${files[@]}"; do
    t="$(extract_title "$f")"
    rel="${f#$ROOT_DIR/}"
    {
      echo "## $t"
      echo
      echo "_Source: \`$rel\`_"
      echo
      strip_frontmatter_and_h1 "$f"
      echo
      echo "---"
      echo
    } >> "$OUT_MD"
  done

  echo "Wrote: $OUT_MD"
  if has_pandoc; then
    pandoc "$OUT_MD" -o "$OUT_PDF"
    echo "Wrote: $OUT_PDF"
  else
    echo "pandoc not found; skipping PDF for $OUT_MD"
  fi
}

shopt -s nullglob
manifests=("$MANIFEST_DIR"/*.manifest)
[[ ${#manifests[@]} -eq 0 ]] && { echo "ERROR: No manifests found in: $MANIFEST_DIR" >&2; exit 1; }

for m in "${manifests[@]}"; do
  echo
  echo "== Compiling $(basename "$m") =="
  compile_manifest "$m"
done

echo
echo "All guides compiled."
