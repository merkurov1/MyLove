<!-- Copilot / AI agent instructions for the MyLove repository -->
# Quick instructions for AI coding agents

This file is a compact, actionable guide for an AI agent (Copilot-style) to be productive in this repo. Refer to the listed files for examples and implementation details.

- Project type: Next.js 14 app-router TypeScript app using Supabase for persistence and Hugging Face (and optionally local Transformers) for embeddings and generation.
- Main runtime: server and edge functions (see `app/api/*`); UI uses React server components by default with client components in `components/`.

Important files / entry points
- `app/layout.tsx`, `app/page.tsx` — top-level layout and landing page (server component). Use these to understand app structure and global providers.
- `app/api/*.ts` (notably `app/api/chat/route.ts`) — API routes. Follow the same NextRequest/NextResponse pattern and logging style. Note `runtime = 'edge'` in some routes: keep code edge-compatible.
- `lib/embedding.ts` — central getEmbedding implementation. Embedding backends: `huggingface`, `transformers` (local), or `mock`. Use `USE_MOCK_EMBEDDINGS` env var for tests.
- `lib/chunking.ts` — text splitting logic used before embedding ingestion.
- `utils/supabase/server.ts` and `utils/supabase/client.ts` — server/service and client Supabase clients. Server code should prefer `server.ts` (uses SERVICE_ROLE_KEY); client/browser code should use `client.ts` (anon key).
- `supabase/*.sql` and `supabase/functions/*` — database setup and stored procedures. The app calls an RPC `match_documents` from `app/api/chat/route.ts` — treat this RPC as the canonical vector-match implementation.

Key conventions and patterns
- Environment variables
  - HF_API_KEY — Hugging Face read/write API key used for embeddings/generation.
  - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — public Supabase values for client access.
  - SUPABASE_SERVICE_ROLE_KEY — service role key used server-side (in `utils/supabase/server.ts`). Never expose this to client code.
  - NEXT_PUBLIC_TRANSFORMERS_API_URL — optional URL for local Transformers API (`/api/transformers`).
  - USE_MOCK_EMBEDDINGS=true — makes `getEmbedding` return deterministic/mock vectors for faster local dev/tests.

- API & runtime
  - Many API routes run on the Edge runtime for lower latency. Avoid Node-only libraries in those files (use fetch instead of node-only http clients), and ensure code is serializable for edge environments.
  - Follow existing logging style in `app/api/chat/route.ts` (timestamped console logs and structured objects). Keep error responses JSON with `{ error: string }`.

- Supabase usage
  - Vector searches are performed via a stored RPC `match_documents` — update or extend that RPC in `supabase/*.sql` rather than rewriting query logic in JS.
  - Use `utils/supabase/server.ts` for server-side operations that require elevated privileges (service role key).

Implementation guidance for common tasks (examples)
- Add a new server API route: copy the pattern from `app/api/chat/route.ts` — use `NextRequest/NextResponse`, include env checks at the top, and return structured JSON errors on failure.
- Add a new embedding backend: extend `lib/embedding.ts` and keep the same `EmbeddingOptions` interface. Honor `USE_MOCK_EMBEDDINGS` for local testability.
- Modify document ingestion: update chunking in `lib/chunking.ts`, then update ingestion endpoints/components (e.g., `app/api/ingest/route.ts` or `components/FileUploader.tsx`) to call the embedding pipeline.

Developer workflows / quick commands
- Dev server: `npm run dev` (runs `next dev`).
- Build: `npm run build` then `npm run start` for production run.
- Lint: `npm run lint`.

Testing & safety notes for agents
- Prefer mock mode or unit tests when running embedding code locally (set `USE_MOCK_EMBEDDINGS=true`).
- Do not leak `SUPABASE_SERVICE_ROLE_KEY` into any client-exposed code. If you need to add server-side secrets, put them in `.env.local` and reference `process.env` in server-only files.

Where to look first when you’re stuck
- `app/api/chat/route.ts` — shows end-to-end: embedding → match RPC → LLM call → result parsing.
- `lib/embedding.ts` and `lib/chunking.ts` — core ML/data-processing logic.
- `utils/supabase/*` — how the project differentiates server vs client Supabase usage.
- `supabase/*.sql` — DB schema and stored procedures used by the app, especially `match_documents`.

If you change DB RPCs or schema
- Update the corresponding `.sql` files under `supabase/` and `supabase/functions/`, and include a migration or note in `DATABASE_MANAGEMENT.md`.

Final note
Be pragmatic: the repo favors clear, small helpers (see `lib/*`) and DB-side vector matching (RPC). When in doubt, mirror the patterns used by `app/api/chat/route.ts` and `utils/supabase/*`.

---
If anything in these instructions is unclear or if you want more examples (e.g., a template for a new API route), tell me which area and I will expand or iterate.
