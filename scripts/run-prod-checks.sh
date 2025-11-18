#!/usr/bin/env bash
# Simple script to run prod diagnostics endpoints using ADMIN_API_TOKEN

set -euo pipefail

if [ -z "${ADMIN_API_TOKEN-}" ]; then
  echo "ERROR: ADMIN_API_TOKEN is not set in your environment. Export it first."
  echo "Example: export ADMIN_API_TOKEN=\"$(head -c12 /dev/urandom | base64)\""
  exit 2
fi

BASE_URL=${BASE_URL:-"https://your-production-site.example"}

if ! command -v jq >/dev/null 2>&1; then
  echo "Warning: 'jq' not found — responses will be raw JSON. Install jq for pretty output." >&2
fi

echo "Running extract columns..."
curl -sSf -X POST "$BASE_URL/api/extract/columns" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_API_TOKEN" \
  -d '{"limit":400}' | jq '.' || echo "extract failed"

echo
echo "Running search playground (sample query='колонка')..."
curl -sSf -X POST "$BASE_URL/api/search/playground" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_API_TOKEN" \
  -d '{"query":"колонка","mode":"keyword","matchCount":10}' | jq '.' || echo "playground failed"

echo
echo "Done."
