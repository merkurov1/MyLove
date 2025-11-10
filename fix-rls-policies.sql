-- Fix RLS policies for document management
-- Enable full CRUD access for authenticated users (service role)

-- Documents table policies
DROP POLICY IF EXISTS "Allow full access to documents" ON public.documents;
CREATE POLICY "Allow full access to documents" ON public.documents
FOR ALL USING (true) WITH CHECK (true);

-- Ensure Row Level Security is enabled on tables this policy targets.
-- Without RLS enabled, policies have no effect. In many migration scripts
-- RLS is enabled explicitly (see `update-schema-1536.sql`).
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Document chunks table policies
DROP POLICY IF EXISTS "Allow full access to document_chunks" ON public.document_chunks;
CREATE POLICY "Allow full access to document_chunks" ON public.document_chunks
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Sources table policies (if needed)
DROP POLICY IF EXISTS "Allow full access to sources" ON public.sources;
CREATE POLICY "Allow full access to sources" ON public.sources
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- Conversations table policies (if needed)
DROP POLICY IF EXISTS "Allow full access to conversations" ON public.conversations;
CREATE POLICY "Allow full access to conversations" ON public.conversations
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Messages table policies (if needed)
DROP POLICY IF EXISTS "Allow full access to messages" ON public.messages;
CREATE POLICY "Allow full access to messages" ON public.messages
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- NOTE:
-- The policies above are permissive (USING (true)). This is convenient for
-- development and for service-role usage, but is insecure for production
-- if your anon/guest role can connect directly. Prefer one of the following
-- safer approaches depending on your needs:
-- 1) Keep RLS enabled and create explicit policies for the `anon`/`authenticated`
--    roles that only allow SELECT/INSERT by the right users (use `auth.uid()`)
-- 2) Use the Supabase SERVICE_ROLE_KEY from server-side only — the service
--    role bypasses RLS entirely, so no permissive policies are required for
--    server-side calls. Do NOT expose the service key to clients.
-- 3) If you must allow client-side reads, create scoped policies, for example:
--
--   -- allow read for authenticated users
--   CREATE POLICY "Select documents for authenticated" ON public.documents
--     FOR SELECT USING (auth.role() = 'authenticated');
--
--   -- allow insert for authenticated users and ensure they set a valid source_id
--   CREATE POLICY "Insert documents for authenticated" ON public.documents
--     FOR INSERT WITH CHECK (auth.role() = 'authenticated');
--
-- Adjust the above to your auth claims and ownership model.