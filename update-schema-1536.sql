-- 🚨 ОБНОВЛЕНИЕ СХЕМЫ БАЗЫ ДАННЫХ ДЛЯ OpenAI text-embedding-3-small (1536 измерений)
-- ⚠️  ЭТО УДАЛИТ ВСЕ СУЩЕСТВУЮЩИЕ ДАННЫЕ! ДЕЛАЙТЕ РЕЗЕРВНУЮ КОПИЮ!

-- 1. Удаляем старые таблицы
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS sources CASCADE;

-- 2. Создаем таблицу sources
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Создаем таблицу documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Создаем таблицу document_chunks с правильной размерностью
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL, -- OpenAI text-embedding-3-small
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Создаем таблицу conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Создаем таблицу messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- Для сообщений тоже 1536
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Создаем индексы для оптимизации
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_document_chunks_content_fts ON document_chunks USING GIN (to_tsvector('russian', content));
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_sources_name ON sources(name);

-- 8. Создаем функцию match_documents для поиска
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  similarity float
) language plpgsql as $$
begin
  return query
    select
      dc.id,
      dc.document_id,
      dc.content,
      dc.chunk_index,
      1 - (dc.embedding <=> query_embedding) as similarity
    from document_chunks dc
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- 9. Вставляем источник по умолчанию
INSERT INTO sources (id, name, description) VALUES
('c5aab739-7112-4360-be9e-45edf4287c42', 'Основной источник', 'Основной источник документов для AI-ассистента');

-- 10. Применяем RLS политики
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS политики для полного доступа
CREATE POLICY "Allow full access to sources" ON sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to document_chunks" ON document_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- 11. Проверяем результат
SELECT '✅ Схема обновлена до 1536 измерений' as status;