-- ==========================================
-- REINDEX: Перестроить векторный индекс
-- ==========================================
-- Проблема: Новый документ загружен, но векторный поиск его не находит
-- Причина: IVFFlat индекс не обновился автоматически после добавления новых векторов

-- Решение: Пересоздать индекс

-- Удаляем старый индекс
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Создаём новый индекс с актуальными данными
-- lists = 100 подходит для ~1000-10000 векторов
-- У нас сейчас ~200 векторов, но оставим запас
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Проверка: должно вернуть индекс
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks' 
  AND indexname = 'document_chunks_embedding_idx';

-- Тест: проверить что индекс используется
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, content, 1 - (embedding <=> '[0.1, 0.2]'::vector) as similarity
FROM document_chunks
ORDER BY embedding <=> '[0.1, 0.2]'::vector
LIMIT 5;
