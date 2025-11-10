-- Проверить текущие RLS политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Проверить размерность векторов в таблицах
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.column_name = 'embedding'
    AND t.table_name IN ('documents', 'document_chunks', 'messages');

-- Проверить последние документы
SELECT id, title, description, source_url, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 5;

-- Применить RLS политики (если не применены)
DROP POLICY IF EXISTS "Allow full access to documents" ON public.documents;
CREATE POLICY "Allow full access to documents" ON public.documents
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to document_chunks" ON public.document_chunks;
CREATE POLICY "Allow full access to document_chunks" ON public.document_chunks
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to sources" ON public.sources;
CREATE POLICY "Allow full access to sources" ON public.sources
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to conversations" ON public.conversations;
CREATE POLICY "Allow full access to conversations" ON public.conversations
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to messages" ON public.messages;
CREATE POLICY "Allow full access to messages" ON public.messages
FOR ALL USING (true) WITH CHECK (true);