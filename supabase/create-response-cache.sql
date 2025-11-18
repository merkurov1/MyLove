-- Создание таблицы кэша ответов LLM
CREATE EXTENSION IF NOT EXISTS vector;

-- Таблица для семантического кэша ответов
CREATE TABLE IF NOT EXISTS response_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query_embedding vector(1536) NOT NULL,
  llm_response jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Индекс для векторного поиска (cosine)
CREATE INDEX IF NOT EXISTS idx_response_cache_embedding ON response_cache USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);

-- RPC: найти кэшированный ответ по эмбеддингу, порог сходства по умолчанию 0.99
CREATE OR REPLACE FUNCTION find_cached_response(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.99
)
RETURNS TABLE (
  id uuid,
  llm_response jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.llm_response,
    1 - (r.query_embedding <=> query_embedding) as similarity
  FROM response_cache r
  WHERE 1 - (r.query_embedding <=> query_embedding) > similarity_threshold
  ORDER BY r.query_embedding <=> query_embedding
  LIMIT 1;
END;
$$;

-- Комментарий
COMMENT ON TABLE response_cache IS 'Кэш ответов LLM для быстрой выдачи похожих вопросов';
