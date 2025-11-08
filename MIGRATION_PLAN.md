# План миграции на Vercel AI SDK

## Шаг 1: Установка зависимостей
```bash
npm install ai @ai-sdk/openai
```

## Шаг 2: Миграция БД на vector(1536)

### SQL миграция:
```sql
-- Создаем новую таблицу с правильной размерностью
CREATE TABLE documents_new (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536),
  checksum TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  embedding_provider TEXT DEFAULT 'openai',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE document_chunks_new (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Удаляем старые таблицы (если нет данных)
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;

-- Переименовываем новые
ALTER TABLE documents_new RENAME TO documents;
ALTER TABLE document_chunks_new RENAME TO document_chunks;

-- Индексы
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_l2_ops);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
```

## Шаг 3: Обновить API routes

### lib/embedding-ai.ts (новый файл):
```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function getEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });
  return embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(
    texts.map(text => getEmbedding(text))
  );
  return results;
}
```

## Шаг 4: Обновить match_documents функцию

```sql
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
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Шаг 5: Протестировать

```bash
# 1. Применить SQL миграцию
# 2. Запустить тест загрузки
npm run dev
curl -X POST http://localhost:3000/api/ingest -F "file=@test-upload.txt"
```
