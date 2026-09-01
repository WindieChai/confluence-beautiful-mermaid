#!/usr/bin/env bash
# Create the public GitHub repo and push (requires: gh auth login)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI first: https://cli.github.com/"
  exit 1
fi

gh auth status >/dev/null

gh repo create confluence-beautiful-mermaid \
  --public \
  --source=. \
  --remote=origin \
  --description "Confluence User Macro for rendering Mermaid diagrams with beautiful-mermaid" \
  --push

echo "Done: $(gh repo view --json url -q .url)"
