# 🚀 Деплой на Vercel с Hugging Face

## 📋 Пошаговая инструкция

### 1. Получение токена Hugging Face (бесплатно)

1. **Регистрация**: Перейдите на https://huggingface.co/join
2. **Подтверждение email**: Проверьте почту и подтвердите аккаунт
3. **Создание токена**: 
   - Перейдите в https://huggingface.co/settings/tokens
   - Нажмите "New token"
   - Введите название: "MyLove Dashboard"
   - Выберите тип: "Read" (достаточно для API)
   - Нажмите "Generate a token"
   - **ВАЖНО**: Скопируйте токен! Он показывается только один раз

### 2. Обновление .env.local

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://hukfgitwamcwsiyxlhyb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_ключ

# Embedding Provider для Vercel
EMBEDDING_PROVIDER=huggingface

# Hugging Face Token
HUGGINGFACE_API_KEY=hf_ваш_токен_здесь

# Basic Authentication
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=mylove2025

# Default Source ID
DEFAULT_SOURCE_ID=uuid_из_supabase_после_sql
```

### 3. Обновление Supabase (размерность 384)

Выполните в SQL Editor Supabase:

```sql
-- Удалить старую таблицу documents если существует
DROP TABLE IF EXISTS documents;

-- Создать новую таблицу с правильной размерностью для HuggingFace
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- HuggingFace all-MiniLM-L6-v2
  checksum TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  embedding_provider TEXT DEFAULT 'huggingface',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_documents_source_id ON documents(source_id);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- Проверить источники
SELECT * FROM sources;
```

### 4. Деплой на Vercel

#### Через GitHub (рекомендуется)

1. **Push в GitHub**:
   ```bash
   git add .
   git commit -m "Added HuggingFace support for Vercel"
   git push origin main
   ```

2. **Подключение к Vercel**:
   - Перейдите на https://vercel.com
   - Войдите через GitHub
   - Нажмите "Add New Project"
   - Выберите репозиторий "MyLove"
   - Нажмите "Import"

3. **Настройка переменных окружения в Vercel**:
   - В настройках проекта перейдите в "Environment Variables"
   - Добавьте все переменные из `.env.local`:
     ```
     NEXT_PUBLIC_SUPABASE_URL = https://hukfgitwamcwsiyxlhyb.supabase.co
     SUPABASE_SERVICE_ROLE_KEY = ваш_service_role_ключ
     EMBEDDING_PROVIDER = huggingface
     HUGGINGFACE_API_KEY = ваш_huggingface_токен
     BASIC_AUTH_USER = admin
     BASIC_AUTH_PASS = mylove2025
     DEFAULT_SOURCE_ID = uuid_из_sources_таблицы
     ```

4. **Деплой**: Vercel автоматически задеплоит проект

#### Через Vercel CLI

```bash
# Установка Vercel CLI
npm i -g vercel

# Деплой
vercel

# Добавление переменных окружения
vercel env add HUGGINGFACE_API_KEY
vercel env add EMBEDDING_PROVIDER
# ... остальные переменные
```

### 5. Проверка работы

1. **Откройте ваш сайт**: https://your-project.vercel.app
2. **Войдите**: admin / mylove2025  
3. **Протестируйте загрузку файла**
4. **Проверьте в Supabase**: данные должны появиться в таблице documents

## 🎯 Преимущества HuggingFace для Vercel

✅ **Бесплатно**: Без лимитов для Inference API  
✅ **Быстро**: API в облаке, без задержек  
✅ **Serverless**: Отлично работает с Vercel  
✅ **Качество**: Модель all-MiniLM-L6-v2 показывает хорошие результаты  
✅ **Простота**: Один токен, никаких сложных настроек  

## 🔄 Переключение провайдеров

Можете легко переключаться между провайдерами, изменив `EMBEDDING_PROVIDER`:

- **Для локальной разработки**: `ollama` (после установки Ollama)
- **Для Vercel продакшена**: `huggingface` (с токеном)
- **Для премиум качества**: `openai` (с API ключом)
- **Для ограниченного использования**: `cohere` (1000 запросов/месяц)

## 🛠️ Устранение проблем

### Ошибка 401 от HuggingFace
- Проверьте правильность токена
- Убедитесь, что токен имеет права "Read"

### Ошибка размерности вектора
- Убедитесь, что в Supabase таблица создана с `vector(384)`
- Пересоздайте таблицу если нужно

### Ошибка Basic Auth
- Проверьте переменные `BASIC_AUTH_USER` и `BASIC_AUTH_PASS` в Vercel

**Теперь ваше приложение готово для продакшена на Vercel! 🚀**