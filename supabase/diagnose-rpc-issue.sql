-- Диагностика проблемы с match_documents
-- Запусти это в Supabase SQL Editor

-- 1. Проверяем существующие функции match_documents
SELECT 
  routine_name,
  routine_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%match%'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- 2. Проверяем структуру таблицы document_chunks
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'document_chunks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Проверяем размерность векторов в базе
SELECT 
  id,
  chunk_index,
  LENGTH(embedding::text) as embedding_text_length,
  array_length(embedding::real[], 1) as embedding_dimension
FROM document_chunks
LIMIT 5;

-- 4. Проверяем что чанки существуют
SELECT 
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embedding,
  AVG(LENGTH(content)) as avg_content_length
FROM document_chunks;

-- 5. Смотрим первый чанк чтобы понять структуру
SELECT 
  id,
  document_id,
  chunk_index,
  LEFT(content, 100) as content_preview,
  metadata,
  created_at
FROM document_chunks
ORDER BY created_at DESC
LIMIT 3;
