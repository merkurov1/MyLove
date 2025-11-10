-- Fix RLS policies for document management
-- Enable full CRUD access for authenticated users (service role)

-- Documents table policies
DROP POLICY IF EXISTS "Allow full access to documents" ON public.documents;
CREATE POLICY "Allow full access to documents" ON public.documents
FOR ALL USING (true) WITH CHECK (true);

-- Document chunks table policies
DROP POLICY IF EXISTS "Allow full access to document_chunks" ON public.document_chunks;
CREATE POLICY "Allow full access to document_chunks" ON public.document_chunks
FOR ALL USING (true) WITH CHECK (true);

-- Sources table policies (if needed)
DROP POLICY IF EXISTS "Allow full access to sources" ON public.sources;
CREATE POLICY "Allow full access to sources" ON public.sources
FOR ALL USING (true) WITH CHECK (true);

-- Conversations table policies (if needed)
DROP POLICY IF EXISTS "Allow full access to conversations" ON public.conversations;
CREATE POLICY "Allow full access to conversations" ON public.conversations
FOR ALL USING (true) WITH CHECK (true);

-- Messages table policies (if needed)
DROP POLICY IF EXISTS "Allow full access to messages" ON public.messages;
CREATE POLICY "Allow full access to messages" ON public.messages
FOR ALL USING (true) WITH CHECK (true);