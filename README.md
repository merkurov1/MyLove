# Панель управления AI-ассистентом

Веб-приложение для загрузки и обработки данных в векторную базу данных Supabase.

## Возможности

- 🔐 Защищенный доступ с Basic Auth
- 📁 Загрузка файлов (PDF, TXT, MD)
- 🔗 Обработка ссылок (веб-статьи, YouTube)
- 🗃️ Автоматическое разбиение на чанки
- 🔍 Генерация эмбеддингов через OpenAI
- 💾 Сохранение в Supabase с дедупликацией

## Технологический стек

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL с векторным расширением)
- **AI Embeddings**: Поддержка множественных провайдеров:
  - 🦙 **Ollama** (локально, бесплатно) - рекомендуется
  - 🤖 OpenAI (платно, высокое качество)
  - 🤗 Hugging Face (бесплатно, онлайн)
  - 🔮 Cohere (1000 запросов/месяц бесплатно)
- **Authentication**: Basic Auth через middleware

## Быстрый старт

1. **Установка зависимостей**:
   ```bash
   npm install
   ```

2. **Настройка переменных окружения**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Заполните переменные в `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` - URL вашего Supabase проекта
   - `SUPABASE_SERVICE_ROLE_KEY` - Service Role ключ из Supabase
   - `EMBEDDING_PROVIDER` - провайдер эмбеддингов (ollama/openai/huggingface/cohere)
   - При использовании Ollama: установите Ollama и запустите `ollama pull nomic-embed-text`
   - При использовании OpenAI: `OPENAI_API_KEY` - ключ API OpenAI
   - При использовании HuggingFace: `HUGGINGFACE_API_KEY` - токен HuggingFace
   - При использовании Cohere: `COHERE_API_KEY` - ключ API Cohere
   - `BASIC_AUTH_USER` и `BASIC_AUTH_PASS` - данные для входа

3. **Настройка базы данных Supabase**:
   
   Создайте таблицы в Supabase:
   
   ```sql
   -- Таблица источников
   CREATE TABLE sources (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Включение векторного расширения
   CREATE EXTENSION IF NOT EXISTS vector;
   
   -- Таблица документов (768 измерений для Ollama)
   CREATE TABLE documents (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     content TEXT NOT NULL,
     embedding vector(768), -- Ollama nomic-embed-text
     checksum TEXT NOT NULL UNIQUE,
     source_id UUID REFERENCES sources(id),
     metadata JSONB,
     embedding_provider TEXT DEFAULT 'ollama',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Индексы для оптимизации
   CREATE INDEX ON documents USING gin(metadata);
   CREATE INDEX ON documents(checksum);
   CREATE INDEX ON documents(source_id);
   ```

4. **Добавление тестового источника**:
   ```sql
   INSERT INTO sources (name, description) 
   VALUES ('Тестовый источник', 'Источник для тестирования загрузки данных');
   ```

5. **Запуск приложения**:
   ```bash
   npm run dev
   ```

6. **Открытие в браузере**:
   Перейдите на http://localhost:3000
   
   Введите данные для входа (из `.env.local`):
   - Пользователь: admin
   - Пароль: mylove2025

## Структура проекта

```
├── app/
│   ├── api/
│   │   ├── auth/route.ts          # Basic Auth endpoint
│   │   └── process/route.ts       # API для обработки данных
│   ├── globals.css                # Стили Tailwind
│   ├── layout.tsx                 # Основной layout
│   └── page.tsx                   # Главная страница
├── components/
│   ├── FileUploader.tsx           # Компонент загрузки файлов
│   ├── LinkProcessor.tsx          # Компонент обработки ссылок
│   └── SourceSelector.tsx         # Выбор источника данных
├── lib/
│   └── supabaseClient.ts          # Клиент Supabase
├── middleware.ts                  # Basic Auth middleware
└── .env.local                     # Переменные окружения
```

## API Endpoints

### POST /api/process

Обрабатывает файлы и ссылки.

**Для файлов** (multipart/form-data):
```javascript
const formData = new FormData()
formData.append('file', file)
formData.append('type', 'file')
```

**Для ссылок** (application/json):
```javascript
{
  "type": "links",
  "links": ["https://example.com", "https://youtube.com/watch?v=..."]
}
```

## 🆓 Бесплатные альтернативы OpenAI

### 🦙 Ollama (Рекомендуется)
**Полностью локальный и бесплатный**

1. **Установка**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Запуск и установка модели**:
   ```bash
   ollama serve
   ollama pull nomic-embed-text
   ```

3. **Настройка** в `.env.local`:
   ```env
   EMBEDDING_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=nomic-embed-text
   ```

### 🤗 Hugging Face (Бесплатный API)
1. Получите токен на https://huggingface.co/settings/tokens
2. Установите в `.env.local`:
   ```env
   EMBEDDING_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=ваш_токен
   ```

### 🔮 Cohere (1000 запросов/месяц бесплатно)
1. Получите ключ на https://dashboard.cohere.ai/api-keys
2. Установите в `.env.local`:
   ```env
   EMBEDDING_PROVIDER=cohere
   COHERE_API_KEY=ваш_ключ
   ```

**📋 Подробные инструкции по Ollama**: см. `OLLAMA_SETUP.md`

## Поддерживаемые форматы

### Файлы
- `.pdf` - PDF документы (требует дополнительную настройку)
- `.txt` - Текстовые файлы
- `.md` - Markdown файлы

### Ссылки
- **YouTube видео** - автоматическое извлечение транскрипции
- **Веб-статьи** - извлечение основного текста

## Безопасность

- Basic Authentication защищает весь сайт
- Service Role ключ Supabase безопасно используется только на сервере
- Checksum предотвращает дублирование данных
- Валидация типов файлов и форматов

## Развертывание

### 🚀 Vercel (рекомендуется для продакшена)

**Используйте Hugging Face для Vercel** (Ollama не работает на serverless платформах):

1. **Получите токен Hugging Face**: https://huggingface.co/settings/tokens
2. **Установите** `EMBEDDING_PROVIDER=huggingface` в переменных окружения
3. **Подключите репозиторий к Vercel**
4. **Добавьте все переменные окружения** в настройках Vercel проекта
5. **Деплой произойдет автоматически**

📋 **Подробная инструкция**: см. `VERCEL_SETUP.md`

### 🏠 Локальная разработка

**Используйте Ollama для локальной разработки** (полностью бесплатно):

1. **Установите Ollama**: `curl -fsSL https://ollama.ai/install.sh | sh`
2. **Запустите**: `ollama serve`
3. **Установите модель**: `ollama pull nomic-embed-text`
4. **Установите** `EMBEDDING_PROVIDER=ollama` в `.env.local`

📋 **Подробная инструкция**: см. `OLLAMA_SETUP.md`

### 🌐 Другие платформы

| Платформа | Ollama | HuggingFace | OpenAI | Cohere |
|-----------|---------|-------------|---------|---------|
| **Vercel** | ❌ | ✅ | ✅ | ✅ |
| **Netlify** | ❌ | ✅ | ✅ | ✅ |
| **Railway** | ✅ | ✅ | ✅ | ✅ |
| **DigitalOcean** | ✅ | ✅ | ✅ | ✅ |
| **AWS Amplify** | ❌ | ✅ | ✅ | ✅ |
| **Локально** | ✅ | ✅ | ✅ | ✅ |

**Рекомендации:**
- 🏠 **Локальная разработка**: Ollama (бесплатно, быстро, приватно)
- ☁️ **Serverless (Vercel/Netlify)**: HuggingFace (бесплатно) или Cohere (лимит)
- 🏢 **Продакшн с бюджетом**: OpenAI (лучшее качество)
- 🐳 **Docker/VPS**: Ollama или любой другой

## Известные ограничения

1. **PDF файлы**: Требуется дополнительная библиотека для парсинга
2. **Размер файлов**: Ограничен настройками Next.js (по умолчанию 1MB)
3. **Rate limiting**: Нет ограничений на количество запросов
4. **Мониторинг**: Нет встроенного логирования и метрик

## Планы развития

- [ ] Поддержка PDF файлов
- [ ] Прогресс-бар для длительных операций
- [ ] Админ-панель для управления источниками
- [ ] API для поиска по векторной БД
- [ ] Поддержка других форматов (DOCX, RTF)
- [ ] Настройка размера чанков
- [ ] Batch обработка больших файлов

---
*Последнее обновление: 04.10.2025 - Готово к деплою!* 
