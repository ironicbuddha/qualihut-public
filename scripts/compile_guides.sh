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
    | sed -E 's/[^a-z0-9[:space:]-]//g; s/[[:space:]]/-/g; s/^-+//; s/-+$//'
}

has_pandoc() { command -v pandoc >/dev/null 2>&1; }
has_pdf_engine() {
  [[ -n "${PANDOC_PDF_ENGINE:-}" ]] && return 0
  command -v tectonic >/dev/null 2>&1 && return 0
  command -v pdflatex >/dev/null 2>&1 && return 0
  command -v xelatex >/dev/null 2>&1 && return 0
  return 1
}

build_pandoc_resource_path() {
  local -a paths=("$ROOT_DIR" "$ROOT_DIR/content")
  local -a img_parents=()

  while IFS= read -r -d '' img_dir; do
    img_parents+=("${img_dir%/images}")
  done < <(find "$ROOT_DIR/content" -type d -name images -print0 2>/dev/null || true)

  if [[ ${#img_parents[@]} -gt 0 ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      paths+=("$line")
    done < <(printf "%s\n" "${img_parents[@]}" | awk '!seen[$0]++' | sort)
  fi

  local joined=""
  joined="$(printf "%s:" "${paths[@]}")"
  echo "${joined%:}"
}

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
  local -a excludes=("$@")
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
  local -a includes=() excludes=()

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

  local -a files=()
  for inc in "${includes[@]}"; do
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      files+=("$f")
    done < <(expand_include "$inc")
  done
  local files_tmp=""
  if [[ ${#files[@]} -gt 0 ]]; then
    files_tmp="$(printf "%s\n" "${files[@]}" | awk '!seen[$0]++' | sort)"
  fi
  files=()
  if [[ -n "$files_tmp" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      files+=("$line")
    done <<< "$files_tmp"
  fi

  local -a filtered=()
  if [[ ${#files[@]} -gt 0 ]]; then
    for f in "${files[@]}"; do
      if is_excluded "$f" "${excludes[@]:-}"; then continue; fi
      filtered+=("$f")
    done
  fi
  files=()
  if [[ ${#filtered[@]} -gt 0 ]]; then
    files=("${filtered[@]}")
  fi

  if [[ ${#files[@]} -eq 0 ]]; then
    {
      echo "# $TITLE"
      echo
      echo "_No entries matched this manifest._"
    } > "$OUT_MD"
    echo "Wrote: $OUT_MD"
    return 0
  fi

  {
    echo "# $TITLE"
    echo
    echo "> This document reflects common knowledge in the world. Rumors, myths, and errors may be present."
    echo
    echo "## Table of Contents"
    echo
  } > "$OUT_MD"

  for f in "${files[@]}"; do
    t="$(extract_title "$f")"
    slug="$(slugify "$t")"
    rel="${f#$ROOT_DIR/}"
    echo "- [$t](#$slug)  \`$rel\`" >> "$OUT_MD"
  done

  {
    echo
    echo "---"
    echo
  } >> "$OUT_MD"

  local last_idx=$(( ${#files[@]} - 1 ))
  for idx in "${!files[@]}"; do
    f="${files[$idx]}"
    t="$(extract_title "$f")"
    rel="${f#$ROOT_DIR/}"
    body="$(strip_frontmatter_and_h1 "$f")"
    {
      echo "## $t"
      echo
      echo "_Source: \`$rel\`_"
      echo
      if [[ -n "$body" ]]; then
        echo "$body"
        echo
      fi
      echo "---"
    } >> "$OUT_MD"

    if [[ "$idx" -lt "$last_idx" ]]; then
      echo >> "$OUT_MD"
    fi
  done

  echo "Wrote: $OUT_MD"
  if has_pandoc; then
    if has_pdf_engine; then
      local pdf_engine_args=()
      if [[ -n "${PANDOC_PDF_ENGINE:-}" ]]; then
        pdf_engine_args=(--pdf-engine="${PANDOC_PDF_ENGINE}")
      elif command -v tectonic >/dev/null 2>&1; then
        pdf_engine_args=(--pdf-engine=tectonic)
      elif command -v xelatex >/dev/null 2>&1; then
        pdf_engine_args=(--pdf-engine=xelatex)
      fi

      local resource_path=""
      resource_path="$(build_pandoc_resource_path)"
      pandoc "$OUT_MD" -o "$OUT_PDF" --resource-path="$resource_path" "${pdf_engine_args[@]}"
      echo "Wrote: $OUT_PDF"
    else
      echo "No TeX PDF engine found; skipping PDF for $OUT_MD (install tectonic or TeX Live)"
    fi
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
