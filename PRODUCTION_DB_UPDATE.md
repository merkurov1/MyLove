# Обновление базы данных на продакшене

## Проблема
RPC функция `match_documents` на продакшене использует `vector(768)`, а код отправляет `vector(1536)` от OpenAI.

## Решение
Применить миграцию `supabase/migration-vercel-ai.sql` на продакшен.

## Шаги

### Вариант 1: Через Supabase Dashboard (РЕКОМЕНДУЕТСЯ)

1. Открой https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
2. Скопируй содержимое файла `supabase/migration-vercel-ai.sql`
3. Вставь в SQL Editor
4. Нажми "Run"

### Вариант 2: Через SQL Editor - только функции

Если не хочешь перезаливать всю миграцию, скопируй только эти функции:

```sql
-- Drop old versions
DROP FUNCTION IF EXISTS match_documents(vector, integer);
DROP FUNCTION IF EXISTS match_documents(vector(384), integer);
DROP FUNCTION IF EXISTS match_documents(vector(768), integer);

-- Create new version for OpenAI 1536-dimensional embeddings
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
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Проверка после обновления

```bash
curl -X POST https://pierrot.merkurov.love/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"О чем статья из новой газеты?"}'
```

Должен вернуть ответ с информацией о статье, а не "Я не нашел информации".

## Текущее состояние

- ✅ Документ загружен: `d18636f9-497f-4e26-95e9-6bdd17830a73`
- ✅ Чанков создано: 28
- ✅ Embeddings сохранены (1536 размерность)
- ❌ RPC функция использует старую размерность (768)
- ❌ Чат не находит документы

После применения миграции всё заработает!
