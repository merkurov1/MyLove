-- КРИТИЧНО: Пересоздать document_chunks с правильной размерностью embedding

-- 1. Удалить старую таблицу
DROP TABLE IF EXISTS document_chunks CASCADE;

-- 2. Создать заново с vector(1536) для OpenAI text-embedding-3-small
CREATE TABLE document_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(1536),  -- ВАЖНО: 1536 для OpenAI, не 384!
  checksum text,
  metadata jsonb,
  content_tsv tsvector,  -- Для hybrid search (добавляем сразу)
  created_at timestamptz DEFAULT now()
);

-- 3. Создать индексы
CREATE INDEX document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX document_chunks_content_tsv_idx ON document_chunks 
  USING gin(content_tsv);

-- 4. Пересоздать RPC функцию с правильной размерностью
DROP FUNCTION IF EXISTS match_documents(vector(1536), int);
DROP FUNCTION IF EXISTS match_documents(vector(384), int);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int
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
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Создаем триггер для автоматического заполнения content_tsv
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

-- ✅ Готово! Теперь нужно перезагрузить все документы через UI
-- После загрузки content_tsv будет автоматически заполняться триггером
