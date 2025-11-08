-- ==========================================
-- REINDEX: Перестроить векторный индекс
-- ==========================================
-- Проблема: Новый документ загружен, но векторный поиск его не находит
-- Причина: IVFFlat индекс не обновился автоматически после добавления новых векторов

-- Решение: Пересоздать индекс

-- Удаляем старый индекс
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Используем HNSW вместо IVFFlat - более экономичен по памяти
-- m = 16 (connections per layer), ef_construction = 64 (quality vs speed)
-- HNSW не требует много maintenance_work_mem и работает лучше на малых датасетах
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Проверка: должно вернуть индекс
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks' 
  AND indexname = 'document_chunks_embedding_idx';

-- Тест: проверить количество векторов в индексе
SELECT COUNT(*) as total_chunks, 
       COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embeddings
FROM document_chunks;
