-- КОМПЛЕКСНОЕ ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ
-- Выполнить это ОДИН РАЗ в Supabase SQL Editor

-- ==========================================
-- 1. ПЕРЕСОЗДАТЬ ТАБЛИЦУ documents
-- ==========================================
-- Проблема: старая структура с полем "content", нужна новая с "title + description"

DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  source_url text,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX documents_source_id_idx ON documents(source_id);
CREATE INDEX documents_created_at_idx ON documents(created_at DESC);

-- ==========================================
-- 1.5. СОЗДАТЬ ТАБЛИЦЫ ДЛЯ ИСТОРИИ ЧАТОВ
-- ==========================================

CREATE TABLE IF NOT EXISTS conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);

-- ==========================================
-- 2. ПЕРЕСОЗДАТЬ ТАБЛИЦУ document_chunks
-- ==========================================
-- Проблема: embeddings 384d вместо 1536d

DROP TABLE IF EXISTS document_chunks CASCADE;

CREATE TABLE document_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(1536),  -- OPENAI: 1536d
  checksum text,
  metadata jsonb DEFAULT '{}',
  content_tsv tsvector,  -- Для full-text search
  created_at timestamptz DEFAULT now()
);

CREATE INDEX document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX document_chunks_content_tsv_idx ON document_chunks 
  USING gin(content_tsv);

-- ==========================================
-- 3. ТРИГГЕР ДЛЯ АВТОЗАПОЛНЕНИЯ content_tsv
-- ==========================================

CREATE OR REPLACE FUNCTION document_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('russian', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate ON document_chunks;
CREATE TRIGGER tsvectorupdate 
BEFORE INSERT OR UPDATE ON document_chunks
FOR EACH ROW EXECUTE FUNCTION document_chunks_tsv_trigger();

-- ==========================================
-- 4. RPC ФУНКЦИИ
-- ==========================================

-- 4.1 match_documents (векторный поиск)
DROP FUNCTION IF EXISTS match_documents;

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 7
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM document_chunks dc
  WHERE dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4.2 hybrid_search (векторный + полнотекстовый)
DROP FUNCTION IF EXISTS hybrid_search;

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int DEFAULT 7,
  keyword_weight float DEFAULT 0.3,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float,
  keyword_rank float,
  hybrid_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      (1 - (dc.embedding <=> query_embedding))::float as sim_score
    FROM document_chunks dc
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      ts_rank(dc.content_tsv, websearch_to_tsquery('russian', query_text))::float as kw_score
    FROM document_chunks dc
    WHERE dc.content_tsv @@ websearch_to_tsquery('russian', query_text)
    ORDER BY ts_rank(dc.content_tsv, websearch_to_tsquery('russian', query_text)) DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT 
      COALESCE(s.id, k.id) as id,
      COALESCE(s.document_id, k.document_id) as document_id,
      COALESCE(s.content, k.content) as content,
      COALESCE(s.metadata, k.metadata) as metadata,
      COALESCE(s.sim_score, 0.0) as similarity,
      COALESCE(k.kw_score, 0.0) as keyword_rank,
      (COALESCE(s.sim_score, 0.0) * semantic_weight + 
       COALESCE(k.kw_score, 0.0) * keyword_weight) as hybrid_score
    FROM semantic_results s
    FULL OUTER JOIN keyword_results k ON s.id = k.id
  )
  SELECT c.id, c.document_id, c.content, c.metadata, c.similarity, c.keyword_rank, c.hybrid_score
  FROM combined c
  ORDER BY c.hybrid_score DESC
  LIMIT match_count;
END;
$$;

-- ==========================================
-- 5. ПРОВЕРКА
-- ==========================================

-- Показать структуру таблиц
SELECT 
  'documents' as table_name,
  count(*) as row_count
FROM documents
UNION ALL
SELECT 
  'document_chunks' as table_name,
  count(*) as row_count
FROM document_chunks
UNION ALL
SELECT 
  'sources' as table_name,
  count(*) as row_count
FROM sources;

-- ✅ ГОТОВО!
-- После выполнения: document_chunks будет пустая (это нормально)
-- Загрузите файлы через UI - они автоматически:
-- 1. Создадут документ в documents
-- 2. Создадут чанки в document_chunks
-- 3. Сгенерируют embeddings (1536d)
-- 4. Заполнят content_tsv через триггер
