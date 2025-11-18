**Production diagnostic & safe-check guide**

This document explains how to run the diagnostic endpoints safely in production and how to configure the required secret.

1) Set `ADMIN_API_TOKEN` in your production environment (Vercel / other host)
   - Generate a random token locally: `head -c 24 /dev/urandom | base64`
   - In Vercel: Project → Settings → Environment Variables → Add `ADMIN_API_TOKEN` (Production) → paste token → Save
   - In Netlify / Render / other hosts: add equivalent environment variable.

2) Ensure `ADMIN_API_TOKEN` is present in your local shell when testing:
   ```bash
   export ADMIN_API_TOKEN="<paste-token>"
   export BASE_URL="https://your-production-site.example" # change to your prod URL
   ./scripts/run-prod-checks.sh
   ```

3) What the script does
   - Calls `/api/extract/columns` to retrieve candidate column titles (uses heuristics, group-by, examples)
   - Calls `/api/search/playground` with a sample keyword query
   - Both endpoints require header `x-admin-token: <ADMIN_API_TOKEN>` in production and will return `401` if missing or incorrect.

4) If you prefer direct curl calls (example):
   ```bash
   curl -X POST "https://your-production-site.example/api/extract/columns" \
     -H "Content-Type: application/json" \
     -H "x-admin-token: $ADMIN_API_TOKEN" \
     -d '{"limit":400}'
   ```

5) Security notes
   - `ADMIN_API_TOKEN` must never be committed to git.
   - Endpoints remain accessible locally without the token (to allow local dev), but in production the token is enforced.

6) Next steps (optional)
   - Add role-based access in your identity provider and map to `ADMIN_API_TOKEN` rotation policy.
   - Add logging of admin actions to audit who performed checks.
