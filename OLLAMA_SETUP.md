# 🦙 Установка Ollama (Бесплатная альтернатива OpenAI)

Ollama - это локальное решение для работы с языковыми моделями, включая модели для генерации эмбеддингов. **Полностью бесплатно!**

## 🚀 Быстрая установка

### Linux / WSL / dev container
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### macOS
```bash
# Через Homebrew
brew install ollama

# Или скачать с сайта
# https://ollama.ai/download
```

### Windows
Скачайте установщик с https://ollama.ai/download

## 🔧 Настройка для эмбеддингов

1. **Запустите Ollama**:
   ```bash
   ollama serve
   ```

2. **Установите модель для эмбеддингов**:
   ```bash
   # Рекомендуемая модель (768 измерений)
   ollama pull nomic-embed-text
   
   # Альтернативы:
   # ollama pull mxbai-embed-large  # 1024 измерения
   # ollama pull all-minilm         # 384 измерения
   ```

3. **Проверьте работу**:
   ```bash
   curl http://localhost:11434/api/embeddings \
     -d '{
       "model": "nomic-embed-text",
       "prompt": "Hello world"
     }'
   ```

## ⚙️ Настройка проекта

В вашем `.env.local` установите:
```env
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
```

## 🔄 Обновление размерности в Supabase

Если у вас уже есть данные с OpenAI эмбеддингами (1536 размерность), нужно обновить схему:

```sql
-- Создать новую таблицу с правильной размерностью
CREATE TABLE documents_new AS 
SELECT id, content, checksum, source_id, metadata, created_at,
       'ollama' as embedding_provider
FROM documents;

-- Добавить колонку для новых эмбеддингов
ALTER TABLE documents_new ADD COLUMN embedding vector(768);

-- Удалить старую таблицу и переименовать
DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

-- Восстановить индексы
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
-- ... остальные индексы
```

## 🆚 Сравнение провайдеров

| Провайдер | Стоимость | Размерность | Качество | Локальный |
|-----------|-----------|-------------|----------|-----------|
| **Ollama** | 🆓 Бесплатно | 768 | ⭐⭐⭐⭐ | ✅ Да |
| OpenAI | 💰 $0.0001/1K токенов | 1536 | ⭐⭐⭐⭐⭐ | ❌ Нет |
| HuggingFace | 🆓 Бесплатно | 384 | ⭐⭐⭐ | ❌ Нет |
| Cohere | 🆓 1K запросов/месяц | 1024 | ⭐⭐⭐⭐ | ❌ Нет |

## 🎯 Переключение между провайдерами

Просто измените `EMBEDDING_PROVIDER` в `.env.local`:

```env
# Для Ollama (рекомендуется)
EMBEDDING_PROVIDER=ollama

# Для OpenAI (если есть ключ)
EMBEDDING_PROVIDER=openai

# Для Hugging Face (нужен токен)
EMBEDDING_PROVIDER=huggingface

# Для Cohere (нужен API ключ)
EMBEDDING_PROVIDER=cohere
```

## 🛠️ Устранение проблем

### Ollama не запускается
```bash
# Проверить статус
ps aux | grep ollama

# Перезапустить
killall ollama
ollama serve
```

### Модель не найдена
```bash
# Список установленных моделей
ollama list

# Переустановить модель
ollama rm nomic-embed-text
ollama pull nomic-embed-text
```

### Ошибка подключения
- Убедитесь что Ollama запущен на `localhost:11434`
- Проверьте firewall и антивирус
- В dev container может потребоваться `host.docker.internal:11434`

## 🚀 Преимущества Ollama

✅ **Полностью бесплатно** - никаких лимитов и токенов  
✅ **Приватность** - все данные остаются локально  
✅ **Быстрота** - нет сетевых задержек  
✅ **Надежность** - не зависит от внешних сервисов  
✅ **Простота** - одна команда для установки  

**Ollama - идеальный выбор для разработки и тестирования!**