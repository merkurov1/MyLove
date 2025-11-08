# Анализ интеграции Vercel AI SDK

## Текущее состояние

### База данных
- **documents**: vector(384) - для Hugging Face embeddings
- **document_chunks**: vector(768) - для Ollama/Fireworks embeddings

### Проблемы
1. `/api/ingest` использует Voyage AI (1024 dim), но БД настроена на 768
2. `/api/process` использует Hugging Face через getEmbedding (384 dim), но сохраняет в documents с 384
3. Нет единообразия в провайдерах

## Vercel AI SDK - рекомендации

### Популярные embedding модели в AI SDK:
- **OpenAI text-embedding-3-small**: 1536 dimensions
- **OpenAI text-embedding-3-large**: 3072 dimensions (можно сократить)
- **Cohere embed-english-v3.0**: 1024 dimensions
- **Voyage AI voyage-2**: 1024 dimensions
- **Mixedbread mxbai-embed-large-v1**: 1024 dimensions

### Рекомендуемая архитектура с Vercel AI:

```typescript
// 1. Единый embedding provider
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

// Для RAG лучше использовать:
// - text-embedding-3-small (1536 dim) - хороший баланс
// - text-embedding-ada-002 (1536 dim) - старая версия
```

### Структура БД для Vercel AI (стандарт):

```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI standard
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Для документов с чанками:
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Варианты решения

### Вариант 1: Использовать OpenAI (рекомендуется Vercel AI)
- ✅ Стандартная интеграция с AI SDK
- ✅ 1536 dimensions - хорошо документировано
- ✅ Высокое качество embeddings
- ❌ Платный (но дешевый)

### Вариант 2: Использовать Cohere/Voyage (1024 dim)
- ✅ Бесплатный tier
- ✅ 1024 dimensions - хороший баланс
- ✅ Работает с AI SDK
- ⚠️ Нужно изменить БД на vector(1024)

### Вариант 3: Использовать HF/Ollama (384/768 dim)
- ✅ Полностью бесплатно
- ✅ Текущая БД уже настроена
- ❌ Не стандарт для AI SDK
- ❌ Ниже качество

## Рекомендация

**Использовать Vercel AI SDK с единым embedding provider:**

1. **Для продакшена**: OpenAI text-embedding-3-small (1536 dim)
2. **Для dev/testing**: Mixedbread или Cohere (1024 dim, бесплатно)
3. **Структура БД**: Унифицировать на 1536 или 1024

### План миграции:

1. Установить `ai` и `@ai-sdk/openai` (или другой провайдер)
2. Создать новую таблицу с правильной размерностью
3. Мигрировать существующие данные (если есть)
4. Обновить все API routes для использования AI SDK
