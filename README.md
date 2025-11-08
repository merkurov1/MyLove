# 🎭 Pierrot AI# Supabase CLI



> **Интеллектуальная система работы с документами на базе RAG (Retrieval-Augmented Generation)**[![Coverage Status](https://coveralls.io/repos/github/supabase/cli/badge.svg?branch=main)](https://coveralls.io/github/supabase/cli?branch=main) [![Bitbucket Pipelines](https://img.shields.io/bitbucket/pipelines/supabase-cli/setup-cli/master?style=flat-square&label=Bitbucket%20Canary)](https://bitbucket.org/supabase-cli/setup-cli/pipelines) [![Gitlab Pipeline Status](https://img.shields.io/gitlab/pipeline-status/sweatybridge%2Fsetup-cli?label=Gitlab%20Canary)

](https://gitlab.com/sweatybridge/setup-cli/-/pipelines)

Персональный AI-ассистент для глубокого анализа текстов, психолингвистических исследований и работы с документами. Использует векторный поиск, LLM и современные техники обработки естественного языка.

[Supabase](https://supabase.io) is an open source Firebase alternative. We're building the features of Firebase using enterprise-grade open source tools.

🌐 **Live Demo**: [pierrot.merkurov.love](https://pierrot.merkurov.love)

This repository contains all the functionality for Supabase CLI.

---

- [x] Running Supabase locally

## ✨ Возможности- [x] Managing database migrations

- [x] Creating and deploying Supabase Functions

### 🔍 Умный поиск- [x] Generating types directly from your database schema

- **Векторный поиск** по семантике, а не по ключевым словам- [x] Making authenticated HTTP requests to [Management API](https://supabase.com/docs/reference/api/introduction)

- **Гибридный поиск** (30% ключевые слова + 70% семантика) для максимальной точности

- **HNSW индекс** для быстрого поиска по 1536-мерным векторам OpenAI## Getting started

- Поддержка русского и английского языков

### Install the CLI

### 💬 Интеллектуальный чат

- **GPT-4o-mini** для генерации ответов с низкой задержкойAvailable via [NPM](https://www.npmjs.com) as dev dependency. To install:

- **Определение намерений**: автоматически распознаёт тип запроса (анализ, сравнение, Q&A)

- **Цитирование источников** с указанием релевантности и прямыми ссылками```bash

- **История разговоров** с возможностью продолжить диалогnpm i supabase --save-dev

- **Markdown-рендеринг** для красивого форматирования ответов```



### 📚 Работа с документамиTo install the beta release channel:

- Поддержка форматов: `.txt`, `.docx` (через библиотеку mammoth)

- Умное разбиение на чанки (до 2000 символов с перекрытием 200)```bash

- Автоматическая очистка от служебных символов и null bytesnpm i supabase@beta --save-dev

- Генерация embeddings через OpenAI text-embedding-3-small (1536d)```

- Full-text search через PostgreSQL tsvector (русский язык)

When installing with yarn 4, you need to disable experimental fetch with the following nodejs config.

### 🧠 Глубокая аналитика

Специализированные промпты для:```

- **Психолингвистический анализ**: языковые паттерны, эмоциональный тон, риторические приёмыNODE_OPTIONS=--no-experimental-fetch yarn add supabase

- **Профайлинг автора**: когнитивный стиль, психологический портрет, мотивация```

- **Анализ коммуникации**: типы дискурса, аргументативные стратегии

- **Сравнение документов**: выявление различий в стиле и содержании> **Note**

For Bun versions below v1.0.17, you must add `supabase` as a [trusted dependency](https://bun.sh/guides/install/trusted) before running `bun add -D supabase`.

### 💰 Бюджет-оптимизация

- **$0.78/месяц** при активном использовании (одним пользователем)<details>

- Условный reranking через LLM (только при similarity < 0.5)  <summary><b>macOS</b></summary>

- Минимизированная телеметрия

- Эффективное кэширование и батчинг запросов  Available via [Homebrew](https://brew.sh). To install:



---  ```sh

  brew install supabase/tap/supabase

## 🏗️ Технологический стек  ```



### Frontend  To install the beta release channel:

- **Next.js 14.2** (App Router, React Server Components)  

- **TypeScript** для типобезопасности  ```sh

- **Tailwind CSS** + **@tailwindcss/typography** для стилизации  brew install supabase/tap/supabase-beta

- **react-markdown** + **remark-gfm** для рендеринга Markdown  brew link --overwrite supabase-beta

- **React Icons** для UI элементов  ```

  

### Backend  To upgrade:

- **Node.js runtime** (для совместимости с OpenAI SDK)

- **Vercel AI SDK** (@ai-sdk/openai) для работы с embeddings  ```sh

- **Next.js API Routes** для серверной логики  brew upgrade supabase

  ```

### База данных</details>

- **Supabase PostgreSQL** с расширением **pgvector**

- **HNSW индекс** для векторного поиска (оптимизирован под 32MB maintenance_work_mem)<details>

- **tsvector** для full-text search на русском языке  <summary><b>Windows</b></summary>

- Хранимые процедуры: `match_documents`, `hybrid_search`

  Available via [Scoop](https://scoop.sh). To install:

### AI/ML

- **OpenAI GPT-4o-mini** ($0.60/месяц для генерации)  ```powershell

- **OpenAI text-embedding-3-small** (1536 размерностей, $0.03 одноразово)  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git

- **Vercel AI SDK** для streamline интеграции  scoop install supabase

  ```

### Deployment

- **Vercel** для хостинга и автоматического деплоя  To upgrade:

- **GitHub Actions** для CI/CD

- **Environment variables** для безопасного хранения ключей  ```powershell

  scoop update supabase

---  ```

</details>

## 📊 Архитектура

<details>

```  <summary><b>Linux</b></summary>

┌─────────────────────────────────────────────────────────────┐

│                     Client (Browser)                         │  Available via [Homebrew](https://brew.sh) and Linux packages.

│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │

│  │ ChatAssistant│  │ FileUploader │  │   Sidebar    │      │  #### via Homebrew

│  └──────────────┘  └──────────────┘  └──────────────┘      │

└────────────────────────────┬────────────────────────────────┘  To install:

                             │

                             ▼  ```sh

┌─────────────────────────────────────────────────────────────┐  brew install supabase/tap/supabase

│                   Next.js API Routes                         │  ```

│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │

│  │  /api/chat   │  │ /api/ingest  │  │/api/conversations│  │  To upgrade:

│  │              │  │              │  │              │      │

│  │ • Intent     │  │ • Mammoth    │  │ • History    │      │  ```sh

│  │ • Vector     │  │ • Chunking   │  │ • Messages   │      │  brew upgrade supabase

│  │ • LLM        │  │ • Embeddings │  │              │      │  ```

│  └──────────────┘  └──────────────┘  └──────────────┘      │

└────────────────────────────┬────────────────────────────────┘  #### via Linux packages

                             │

                             ▼  Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

┌─────────────────────────────────────────────────────────────┐

│                  Supabase PostgreSQL                         │  ```sh

│  ┌──────────────────────────────────────────────────────┐   │  sudo apk add --allow-untrusted <...>.apk

│  │ documents (title, description, source_url)           │   │  ```

│  │ document_chunks (content, embedding vector(1536))    │   │

│  │ conversations (title, created_at, updated_at)        │   │  ```sh

│  │ messages (role, content, metadata)                   │   │  sudo dpkg -i <...>.deb

│  └──────────────────────────────────────────────────────┘   │  ```

│                                                              │

│  ┌──────────────────────────────────────────────────────┐   │  ```sh

│  │ RPC Functions:                                       │   │  sudo rpm -i <...>.rpm

│  │ • match_documents(vector(1536), int)                 │   │  ```

│  │ • hybrid_search(text, vector(1536), int, float)      │   │

│  └──────────────────────────────────────────────────────┘   │  ```sh

│                                                              │  sudo pacman -U <...>.pkg.tar.zst

│  ┌──────────────────────────────────────────────────────┐   │  ```

│  │ Indexes:                                             │   │</details>

│  │ • HNSW (m=16, ef_construction=64)                    │   │

│  │ • GIN (content_tsv) for full-text search             │   │<details>

│  └──────────────────────────────────────────────────────┘   │  <summary><b>Other Platforms</b></summary>

└─────────────────────────────────────────────────────────────┘

                             │  You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

                             ▼

┌─────────────────────────────────────────────────────────────┐  ```sh

│                      OpenAI API                              │  go install github.com/supabase/cli@latest

│  • text-embedding-3-small (1536d)                            │  ```

│  • gpt-4o-mini (128K context)                                │

└─────────────────────────────────────────────────────────────┘  Add a symlink to the binary in `$PATH` for easier access:

```

  ```sh

---  ln -s "$(go env GOPATH)/bin/cli" /usr/bin/supabase

  ```

## 🚀 Быстрый старт

  This works on other non-standard Linux distros.

### Требования</details>

- Node.js 18+

- Supabase аккаунт<details>

- OpenAI API ключ  <summary><b>Community Maintained Packages</b></summary>



### 1. Клонирование репозитория  Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).

```bash  To install in your working directory:

git clone https://github.com/merkurov1/MyLove.git

cd MyLove  ```bash

npm install  pkgx install supabase

```  ```



### 2. Настройка переменных окружения  Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).

</details>

Создайте `.env.local`:

### Run the CLI

```env

# OpenAI```bash

OPENAI_API_KEY=sk-proj-...supabase bootstrap

```

# Supabase

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.coOr using npx:

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...```bash

npx supabase bootstrap

# Optional```

DEFAULT_SOURCE_ID=c5aab739-7112-4360-be9e-45edf4287c42

```The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.



### 3. Настройка базы данных## Docs



Выполните SQL скрипты в Supabase SQL Editor в следующем порядке:Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).



1. **COMPLETE_FIX.sql** - создание основных таблиц## Breaking changes

2. **FIX_MESSAGES_TABLE.sql** - таблица для истории чатов

3. **REINDEX_VECTORS.sql** - векторные индексыWe follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.



```bashHowever, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

# Скрипты находятся в корне проекта

cat COMPLETE_FIX.sql## Developing

cat FIX_MESSAGES_TABLE.sql

cat REINDEX_VECTORS.sqlTo run from source:

```

```sh

### 4. Запуск в development режиме# Go >= 1.22

go run . help

```bash```

npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

### 5. Загрузка первого документа

1. Нажмите "Загрузить документ"
2. Выберите `.txt` или `.docx` файл
3. Дождитесь обработки (создание чанков + генерация embeddings)
4. Задайте вопрос в чате!

---

## 📖 Примеры использования

### Простой Q&A
```
Q: О чем последняя колонка в Новой Газете?
A: [Ответ с цитатами из документа и указанием релевантности]
```

### Психолингвистический анализ
```
Q: Сделай психолингвистический анализ колонки о мессенджере Зосима

A: [Полный анализ с 5 уровнями]
   1. Контент-анализ
   2. Психолингвистический анализ
   3. Профайлинг автора
   4. Стратегии коммуникации
   5. Интегральные выводы
```

### Сравнение документов
```
Q: Сравни риторику в двух последних колонках

A: [Детальное сравнение стилистики, аргументации, эмоционального тона]
```

### Извлечение фактов
```
Q: Who is Anton Merkurov?

A: Anton Merkurov is an Armenian-Jewish artist, internet expert, 
   and great-grandson of famous Soviet sculptor Sergey Merkurov...
   [+ источники с релевантностью 50-54%]
```

---

## 🛠️ Разработка

### Структура проекта

```
MyLove/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Основной чат endpoint
│   │   ├── ingest/route.ts        # Загрузка документов
│   │   ├── conversations/route.ts # История чатов
│   │   ├── documents/route.ts     # Управление документами
│   │   └── stats/route.ts         # Статистика
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Главная страница
├── components/
│   ├── ChatAssistant.tsx          # Компонент чата
│   ├── FileUploader.tsx           # Загрузка файлов
│   ├── Sidebar.tsx                # История разговоров
│   └── ...
├── lib/
│   ├── agent-actions.ts           # Определение намерений
│   ├── chunking.ts                # Разбиение текста
│   ├── embedding-ai.ts            # Генерация embeddings
│   └── reranking.ts               # LLM reranking
├── utils/
│   └── supabase/
│       ├── client.ts              # Client-side Supabase
│       └── server.ts              # Server-side Supabase
├── COMPLETE_FIX.sql               # Основная миграция БД
├── FIX_MESSAGES_TABLE.sql         # История чатов
├── REINDEX_VECTORS.sql            # Векторные индексы
└── package.json
```

### Ключевые файлы

#### `app/api/chat/route.ts`
Основной endpoint чата. Логика:
1. Определение намерения (intent detection)
2. Генерация embedding для запроса
3. Векторный/гибридный поиск
4. Conditional reranking (если similarity < 0.5)
5. Генерация ответа через GPT-4o-mini
6. Сохранение в conversations/messages

#### `lib/embedding-ai.ts`
Умный батчинг для OpenAI embeddings:
- MAX_TOKENS_PER_TEXT = 2000
- MAX_TOKENS_PER_BATCH = 6000
- Автоматическое разбиение oversized текстов
- Рекурсивная обработка ошибок

#### `lib/chunking.ts`
Алгоритм разбиения текста:
- maxChunkSize = 2000 символов (~500 токенов)
- overlapSize = 200 символов
- Force character-based split для текстов без пунктуации

---

## 📈 Производительность

### Метрики (на ~200 документных чанках)

| Операция | Среднее время | Стоимость |
|----------|---------------|-----------|
| Vector search | 50-150ms | $0 |
| Embedding generation | 200-500ms | $0.0001 |
| LLM response (GPT-4o-mini) | 1-3s | $0.003 |
| Reranking (conditional) | +500ms | $0.001 |
| **Полный запрос** | **2-4s** | **$0.004** |

### Бюджет при активном использовании

- **200 запросов/месяц**: $0.80
- **500 запросов/месяц**: $2.00
- **1000 запросов/месяц**: $4.00

**Оптимизация**: 
- Conditional reranking экономит ~40% бюджета
- HNSW индекс быстрее IVFFlat на 2-3x
- Батчинг embeddings снижает latency на 50%

---

## 🐛 Известные проблемы и решения

### Проблема: "memory required is 59 MB, maintenance_work_mem is 32 MB"
**Решение**: Используйте HNSW индекс вместо IVFFlat:
```sql
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Проблема: Векторный поиск не находит новые документы
**Решение**: Пересоздайте индекс после загрузки документов (см. `REINDEX_VECTORS.sql`)

### Проблема: "column messages.role does not exist"
**Решение**: Выполните `FIX_MESSAGES_TABLE.sql` для пересоздания таблицы с правильной структурой

### Проблема: PostgreSQL "22P05: unsupported Unicode escape sequence"
**Решение**: Используйте `cleanTextForPostgres()` из `app/api/ingest/route.ts` для удаления null bytes

---

## 🔐 Безопасность

- ✅ Service role key используется ТОЛЬКО на сервере
- ✅ Anon key для client-side операций
- ✅ Row Level Security (RLS) на таблицах Supabase
- ✅ Environment variables через `.env.local` (не в git)
- ✅ CORS настроен только для production домена

---

## 📚 Документация

- [COMPLETE_FIX.sql](./COMPLETE_FIX.sql) - Полная миграция базы данных
- [FIX_README.md](./FIX_README.md) - Инструкции по исправлению багов
- [DATABASE_MANAGEMENT.md](./DATABASE_MANAGEMENT.md) - Управление БД
- [ADVANCED_QUERIES_EXAMPLES.md](./ADVANCED_QUERIES_EXAMPLES.md) - Примеры запросов

---

## 🤝 Contributing

Проект разработан для личного использования, но если у вас есть идеи:

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📝 Лицензия

MIT License - см. [LICENSE](./LICENSE)

---

## 👤 Автор

**Anton Merkurov**

- Website: [merkurov.love](https://merkurov.love)
- Email: merkurov@gmail.com
- GitHub: [@merkurov1](https://github.com/merkurov1)

---

## 🙏 Благодарности

- [OpenAI](https://openai.com) за GPT-4o-mini и text-embedding-3-small
- [Vercel](https://vercel.com) за AI SDK и хостинг
- [Supabase](https://supabase.com) за PostgreSQL с pgvector
- [pgvector](https://github.com/pgvector/pgvector) за векторные расширения PostgreSQL

---

## 🔮 Roadmap

- [ ] Поддержка PDF файлов
- [ ] Multimodal embeddings (текст + изображения)
- [ ] Fine-tuning GPT для специализированных задач
- [ ] Экспорт диалогов в Markdown/PDF
- [ ] API для внешних интеграций
- [ ] Multi-user support с авторизацией
- [ ] Real-time collaboration
- [ ] Mobile app (React Native)

---

<div align="center">

**Создано с ❤️ используя Next.js, OpenAI и Supabase**

[⬆ Вернуться к началу](#-pierrot-ai)

</div>
