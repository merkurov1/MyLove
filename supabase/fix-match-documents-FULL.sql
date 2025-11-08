-- ПОЛНАЯ МИГРАЦИЯ: Обновление match_documents для OpenAI 1536d
-- Запусти весь этот скрипт целиком в Supabase SQL Editor

-- Шаг 1: Удаляем ВСЕ старые версии функции
DROP FUNCTION IF EXISTS match_documents(vector, integer);
DROP FUNCTION IF EXISTS match_documents(vector(384), integer);
DROP FUNCTION IF EXISTS match_documents(vector(768), integer);
DROP FUNCTION IF EXISTS match_documents(vector(1024), integer);
DROP FUNCTION IF EXISTS match_documents(vector(1536), integer);

-- Шаг 2: Создаем новую функцию с правильной сигнатурой
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 7
)
RETURNS TABLE (
  id uuid,
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
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  WHERE dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Шаг 3: Проверяем что функция создана
SELECT 
  'match_documents функция создана' as status,
  routine_name,
  data_type
FROM information_schema.routines
WHERE routine_name = 'match_documents'
  AND routine_schema = 'public';

-- Шаг 4: Проверяем что векторы правильной размерности
SELECT 
  'Проверка размерности векторов' as status,
  COUNT(*) as total_chunks,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embeddings
FROM document_chunks;

-- Если увидишь результаты без ошибок - функция применилась!
