<!-- Copilot / AI agent instructions for the MyLove repository -->
# Quick instructions for AI coding agents

This file is a compact, actionable guide for an AI agent (Copilot-style) to be productive in this repo. Refer to the listed files for examples and implementation details.

- Project type: Next.js 14 app-router TypeScript app using Supabase for persistence and Vercel AI SDK with OpenAI for embeddings and generation.
- Main runtime: server (nodejs) functions (see `app/api/*`); UI uses React server components by default with client components in `components/`.

Important files / entry points
- `app/layout.tsx`, `app/page.tsx` — top-level layout and landing page (server component). Use these to understand app structure and global providers.
- `app/api/*.ts` (notably `app/api/chat/route.ts`) — API routes. Follow the same NextRequest/NextResponse pattern and logging style. Uses `runtime = 'nodejs'` for OpenAI SDK compatibility.
- `lib/embedding-ai.ts` — central embedding implementation using Vercel AI SDK (@ai-sdk/openai). Uses text-embedding-3-small (1536 dimensions).
- `lib/chunking.ts` — text splitting logic used before embedding ingestion.
- `utils/supabase/server.ts` and `utils/supabase/client.ts` — server/service and client Supabase clients. Server code should prefer `server.ts` (uses SERVICE_ROLE_KEY); client/browser code should use `client.ts` (anon key).
- `supabase/*.sql` and `supabase/functions/*` — database setup and stored procedures. The app calls an RPC `match_documents` from `app/api/chat/route.ts` — treat this RPC as the canonical vector-match implementation.

Key conventions and patterns
- Environment variables
  - OPENAI_API_KEY — OpenAI API key used for embeddings via Vercel AI SDK.
  - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — public Supabase values for client access.
  - SUPABASE_SERVICE_ROLE_KEY — service role key used server-side (in `utils/supabase/server.ts`). Never expose this to client code.
  - DEFAULT_SOURCE_ID — default source UUID for document uploads.

- API & runtime
  - All API routes use Node.js runtime (`runtime = 'nodejs'`) for compatibility with OpenAI SDK and Vercel AI SDK.
  - Follow existing logging style in `app/api/chat/route.ts` (timestamped console logs and structured objects). Keep error responses JSON with `{ error: string }`.

- Supabase usage
  - Vector searches are performed via a stored RPC `match_documents` — update or extend that RPC in `supabase/*.sql` rather than rewriting query logic in JS.
  - Use `utils/supabase/server.ts` for server-side operations that require elevated privileges (service role key).

Implementation guidance for common tasks (examples)
- Add a new server API route: copy the pattern from `app/api/chat/route.ts` — use `NextRequest/NextResponse`, include env checks at the top, and return structured JSON errors on failure.
- Modify document ingestion: update chunking in `lib/chunking.ts`, then update ingestion endpoints/components (e.g., `app/api/ingest/route.ts` or `components/FileUploader.tsx`) to call the embedding pipeline via `lib/embedding-ai.ts`.
- All embeddings use OpenAI text-embedding-3-small (1536 dimensions) via Vercel AI SDK. Database vector columns are configured for vector(1536).

Developer workflows / quick commands
- Dev server: `npm run dev` (runs `next dev`).
- Build: `npm run build` then `npm run start` for production run.
- Lint: `npm run lint`.

Testing & safety notes for agents
- All embeddings require OPENAI_API_KEY. Monitor usage to avoid quota limits.
- Do not leak `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` into any client-exposed code. If you need to add server-side secrets, put them in `.env.local` and reference `process.env` in server-only files.

Where to look first when you're stuck
- `app/api/chat/route.ts` — shows end-to-end: embedding → match RPC → LLM call → result parsing.
- `lib/embedding-ai.ts` and `lib/chunking.ts` — core ML/data-processing logic using Vercel AI SDK.
- `utils/supabase/*` — how the project differentiates server vs client Supabase usage.
- `supabase/*.sql` — DB schema and stored procedures used by the app, especially `match_documents`.

If you change DB RPCs or schema
- Update the corresponding `.sql` files under `supabase/` and `supabase/functions/`, and include a migration or note in `DATABASE_MANAGEMENT.md`.

Final note
Be pragmatic: the repo favors clear, small helpers (see `lib/*`) and DB-side vector matching (RPC). When in doubt, mirror the patterns used by `app/api/chat/route.ts` and `utils/supabase/*`.

---
If anything in these instructions is unclear or if you want more examples (e.g., a template for a new API route), tell me which area and I will expand or iterate.
