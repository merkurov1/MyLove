-- 🚀 Настройка базы данных для панели управления AI-ассистентом
-- Размерность векторов: 384 (для Hugging Face all-MiniLM-L6-v2)

-- Включение векторного расширения (если еще не включено)
CREATE EXTENSION IF NOT EXISTS vector;

-- Удаляем старые таблицы если они существуют (осторожно в продакшене!)
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS sources;

-- Таблица источников данных
CREATE TABLE sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица документов с векторными эмбеддингами (384 измерения для HuggingFace)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- Hugging Face all-MiniLM-L6-v2 имеет размерность 384
  checksum TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  embedding_provider TEXT DEFAULT 'huggingface', -- Отслеживаем провайдера
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_documents_metadata ON documents USING gin(metadata);
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_documents_source_id ON documents(source_id);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- Индекс для векторного поиска (cosine similarity)
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Функция для поиска похожих документов (универсальная)
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_source_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  source_id uuid,
  embedding_provider text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    d.source_id,
    d.embedding_provider,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  WHERE 
    (filter_source_id IS NULL OR d.source_id = filter_source_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Вставка тестового источника данных
INSERT INTO sources (name, description) 
VALUES 
  ('AI Ассистент', 'Основной источник данных для AI ассистента'),
  ('Документация', 'Техническая документация и инструкции'),
  ('Веб-статьи', 'Статьи и материалы из интернета'),
  ('YouTube', 'Транскрипции видео с YouTube');

-- Функция для получения статистики
CREATE OR REPLACE FUNCTION get_stats()
RETURNS TABLE (
  sources_count bigint,
  documents_count bigint,
  total_content_length bigint,
  providers_used text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sources) as sources_count,
    (SELECT COUNT(*) FROM documents) as documents_count,
    (SELECT SUM(LENGTH(content)) FROM documents) as total_content_length,
    (SELECT ARRAY_AGG(DISTINCT embedding_provider) FROM documents WHERE embedding_provider IS NOT NULL) as providers_used;
END;
$$;

-- Политики безопасности (Row Level Security) - закомментировано для упрощения
-- ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Комментарии к таблицам
COMMENT ON TABLE sources IS 'Источники данных для категоризации документов';
COMMENT ON TABLE documents IS 'Документы с векторными эмбеддингами для семантического поиска';

COMMENT ON COLUMN documents.content IS 'Текстовое содержимое документа или чанка';
COMMENT ON COLUMN documents.embedding IS 'Векторное представление содержимого (384 размерность для HuggingFace all-MiniLM-L6-v2)';
COMMENT ON COLUMN documents.checksum IS 'SHA256 хеш содержимого для предотвращения дубликатов';
COMMENT ON COLUMN documents.metadata IS 'Дополнительные метаданные (URL, заголовок, тип источника и т.д.)';
COMMENT ON COLUMN documents.embedding_provider IS 'Провайдер эмбеддингов (huggingface, ollama, openai, cohere)';

-- Проверка созданных объектов
SELECT 
  'Таблица sources создана с ' || COUNT(*) || ' записями' as status
FROM sources
UNION ALL
SELECT 
  'Таблица documents готова к использованию' as status
UNION ALL
SELECT 
  'Векторное расширение: ' || 
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') 
    THEN '✅ Установлено' 
    ELSE '❌ Не найдено' 
  END as status
UNION ALL
SELECT 
  'Функция search_documents: ✅ Создана' as status
UNION ALL
SELECT 
  'Функция get_stats: ✅ Создана' as status;

-- Получаем ID первого источника для DEFAULT_SOURCE_ID
SELECT 
  '🎯 Используйте этот UUID как DEFAULT_SOURCE_ID:' as info,
  id as source_id
FROM sources 
WHERE name = 'AI Ассистент'
LIMIT 1;