-- КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Явная типизация vector(1536)
-- Проблема: функция match_documents не имеет явного типа параметра

-- Удаляем функцию БЕЗ указания типа параметра
DROP FUNCTION IF EXISTS match_documents(vector, integer);
DROP FUNCTION IF EXISTS match_documents(vector, int);

-- Создаем с ЯВНЫМ указанием vector(1536)
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
IMMUTABLE STRICT
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float as similarity
  FROM document_chunks dc
  WHERE dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Проверка: эта команда должна показать vector(1536)
SELECT 
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as return_type
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'match_documents'
  AND n.nspname = 'public';

-- Тестовый вызов (замени на реальный вектор 1536 чисел)
-- Это должно работать без ошибок
SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL;
