-- Добавление гибридного поиска (keyword + vector)
-- Это критично для точных совпадений типа "Новая газета", "СОРМ", имена

-- 1. Добавляем tsvector колонку для полнотекстового поиска
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- 2. Создаем индекс для быстрого полнотекстового поиска
CREATE INDEX IF NOT EXISTS document_chunks_content_tsv_idx 
ON document_chunks USING gin(content_tsv);

-- 3. Заполняем tsvector для существующих данных (русский язык)
UPDATE document_chunks 
SET content_tsv = to_tsvector('russian', content)
WHERE content_tsv IS NULL;

-- 4. Создаем триггер для автоматического обновления при вставке/обновлении
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

-- 5. Создаем функцию гибридного поиска
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int DEFAULT 7,
  keyword_weight float DEFAULT 0.3,  -- 30% keyword, 70% semantic
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
IMMUTABLE STRICT
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
    LIMIT match_count * 2  -- Берем в 2 раза больше для объединения
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
  SELECT * FROM combined
  ORDER BY hybrid_score DESC
  LIMIT match_count;
END;
$$;

-- Проверка
SELECT 'Hybrid search setup complete' as status;
