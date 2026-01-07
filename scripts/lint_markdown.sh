#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Allow installers/automation to bypass the hook explicitly.
if [[ "${SKIP_MD_LINT:-}" == "1" ]]; then
  exit 0
fi

if ! command -v markdownlint >/dev/null 2>&1; then
  echo "markdownlint-cli is required. Install with: npm install -g markdownlint-cli" >&2
  exit 1
fi

md_files=()
while IFS= read -r file; do
  md_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACM | grep -E '\.md$' || true)

if [[ ${#md_files[@]} -eq 0 ]]; then
  exit 0
fi

markdownlint -c "$REPO_ROOT/.markdownlint.json" "${md_files[@]}"
