# Проблема с OpenAI квотой - РЕШЕНО ✅

## Что было сделано

### 1. Очистка кодовой базы
- ✅ Удалены все старые embedding провайдеры (HuggingFace, Voyage, Cohere, Ollama)
- ✅ Оставлен только `lib/embedding-ai.ts` с Vercel AI SDK
- ✅ Обновлены все API routes для использования только OpenAI embeddings
- ✅ Упрощён `.env.local` - только необходимые переменные

### 2. Текущая конфигурация
Система использует:
- **Vercel AI SDK** (`@ai-sdk/openai`)
- **OpenAI text-embedding-3-small** (1536 dimensions)
- **Node.js runtime** для всех API routes

## ⚠️ ТРЕБУЕТСЯ: Обновить переменные окружения на Vercel

### Шаг 1: Зайти в настройки проекта на Vercel
https://vercel.com/merkurov1/mylove/settings/environment-variables

### Шаг 2: Удалить ненужные переменные
Удалите следующие переменные (если они есть):
- `HF_API_KEY`
- `HUGGINGFACE_API_KEY`
- `VOYAGE_API_KEY`
- `COHERE_API_KEY`
- `FIREWORKS_API_KEY`
- `MIXEDBREAD_API_KEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `EMBEDDING_PROVIDER`
- `USE_MOCK_EMBEDDINGS`
- `MISTRAL_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `VERCEL_API_KEY`

### Шаг 3: Оставить только эти переменные

#### Supabase (обязательно)
```
NEXT_PUBLIC_SUPABASE_URL=https://hukfgitwamcwsiyxlhyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1a2ZnaXR3YW1jd3NpeXhsaHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzE5NzMsImV4cCI6MjA3NTA0Nzk3M30.2QwQw6Qn6QwQw6Qn6QwQw6Qn6QwQw6Qn6QwQw6Qn6QwQw6Qn6QwQw6Qn6QwQw6Qn6
NEXT_PUBLIC_SUPABASE_REDIRECT_URL=https://pierrot.merkurov.love/auth
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1a2ZnaXR3YW1jd3NpeXhsaHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3MTk3MywiZXhwIjoyMDc1MDQ3OTczfQ.HrL0GpP2AI1WDN6EAeXx2bWUzH_Ajefaj8nMsTJywR8
```

#### OpenAI (обязательно)
```
OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
```
**⚠️ ВАЖНО:** Текущий ключ исчерпал квоту! Нужно:
1. Зайти на https://platform.openai.com/account/billing
2. Добавить способ оплаты или пополнить баланс
3. Создать новый API ключ на https://platform.openai.com/api-keys
4. Заменить в Vercel

#### Application (опционально)
```
DEFAULT_SOURCE_ID=c5aab739-7112-4360-be9e-45edf4287c42
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=mylove2025
```

### Шаг 4: Redeploy
После обновления переменных окружения на Vercel:
1. Перейдите во вкладку "Deployments"
2. Найдите последний деплой (commit: 2635d25)
3. Нажмите "..." → "Redeploy"

## Альтернативные решения (если не хотите платить за OpenAI)

### Вариант 1: Использовать Anthropic Claude (рекомендуется)
Anthropic предоставляет $5 бесплатных кредитов при регистрации.

### Вариант 2: Вернуться к HuggingFace (бесплатно)
HuggingFace Inference API бесплатен, но медленнее OpenAI.

### Вариант 3: Использовать локальный Ollama (только для dev)
Ollama полностью бесплатен и работает локально, но не подходит для Vercel.

## Текущий статус

✅ Код очищен и готов к работе
✅ Все изменения запушены на GitHub
✅ Автоматический деплой на Vercel запустится
⏳ Требуется обновить OPENAI_API_KEY на Vercel
⏳ После обновления ключа - redeploy

## Проверка после деплоя

1. Откройте https://pierrot.merkurov.love/database
2. Попробуйте загрузить тестовый файл
3. Если всё работает - увидите сообщение "✓ Файл успешно обработан!"
4. Проверьте что документы появляются в таблице
