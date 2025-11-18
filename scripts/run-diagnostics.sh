#!/usr/bin/env bash
# scripts/run-diagnostics.sh
# Helper to run the diagnostic steps locally in order.
# Usage:
#   bash scripts/run-diagnostics.sh          # runs structure + embed probe + backfill dry-run (limit 5)
#   bash scripts/run-diagnostics.sh --api    # also runs a minimal API test (calls LLM)
# Notes: set OPENAI_API_KEY in your shell before running or source your .env

set -euo pipefail
API_TEST=0
for arg in "$@"; do
  case "$arg" in
    --api) API_TEST=1; shift ;;
    -h|--help) echo "Usage: bash scripts/run-diagnostics.sh [--api]"; exit 0;;
  esac
done

echo "[1/5] Sanitize .env (replace smart quotes if any)"
if [ -f .env ]; then
  sed -i 's/[“”]/"/g' .env || true
  sed -i "s/[‘’]/'/g" .env || true
  echo "  .env sanitized"
else
  echo "  .env not found, skipping sanitize"
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "WARNING: OPENAI_API_KEY is not set in the environment. Export it before running tests."
  echo "Example: export OPENAI_API_KEY='sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'"
  echo "Aborting.";
  exit 2
fi

echo "[2/5] Inspect SDK shape (no network)"
node scripts/test-openai-client.js || { echo "test-openai-client.js failed"; exit 3; }

if [ "$API_TEST" -eq 1 ]; then
  echo "[3/5] Running minimal API tests (this will call the API)"
  node scripts/test-openai-client.js --api-test || { echo "API test failed"; exit 4; }
else
  echo "[3/5] Skipping direct API chat/responses test (use --api to enable)"
fi

echo "[4/5] Attempt embedding candidate probes (may call API)"
node scripts/test-openai-client.js --embed-test || echo "embed-test ended with non-zero exit (ok if no method matched)"

echo "[5/5] Running backfill dry-run (limit 5) — NO DB writes should occur"
node scripts/backfill-chunks-v2.js --dry-run --limit 5 || { echo "backfill dry-run failed"; exit 5; }


echo "All diagnostics completed. Review output above and paste any errors here."
