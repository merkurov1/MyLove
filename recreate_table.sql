-- 🚨 ВНИМАНИЕ: Этот скрипт УДАЛИТ все существующие данные!
-- Сделайте бэкап перед выполнением!

-- Включаем векторное расширение
CREATE EXTENSION IF NOT EXISTS vector;

-- Удаляем старые таблицы
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS sources CASCADE;

-- Создаем таблицу источников
CREATE TABLE sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставляем источник по умолчанию
INSERT INTO sources (id, name, description) VALUES
('c5aab739-7112-4360-be9e-45edf4287c42', 'Основной источник', 'Основной источник документов для AI-ассистента');

-- Создаем таблицу документов с правильной размерностью 384
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- Правильная размерность для all-MiniLM-L6-v2
  checksum TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  embedding_provider TEXT DEFAULT 'huggingface',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем таблицу с правильной размерностью 384
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- Правильная размерность для all-MiniLM-L6-v2
  checksum TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  embedding_provider TEXT DEFAULT 'huggingface',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индексы
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_documents_source_id ON documents(source_id);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- Создаем функцию match_documents
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(384),
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
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Проверяем результат
SELECT 
  'Таблица documents пересоздана с размерностью 384' as status,
  (SELECT COUNT(*) FROM documents) as document_count;
