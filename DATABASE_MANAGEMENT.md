# Управление базой данных

## Настройка базы данных

### Полная пересоздание (удалит все данные!)
```bash
# Выполните в Supabase SQL Editor
# Содержимое файла recreate_table.sql
```

### Безопасная настройка (сохранит существующие данные)
```bash
# Выполните в Supabase SQL Editor
# Содержимое файла supabase-setup.sql
```

## Проверка состояния базы данных

### JavaScript скрипт
```bash
node check-db.js
```

### Ручная проверка в Supabase SQL Editor
```sql
-- Проверяем таблицы
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Проверяем размерность векторов
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'documents' AND column_name = 'embedding';

-- Проверяем количество записей
SELECT COUNT(*) FROM sources;
SELECT COUNT(*) FROM documents;

-- Тестируем функцию
SELECT * FROM match_documents(ARRAY[0.1, 0.2, ...]::vector(384), 1);
```

## Загрузка данных

### Через веб-интерфейс
1. Откройте страницу `/documents`
2. Выберите источник
3. Загрузите файл или введите ссылки

### API endpoints
- `POST /api/process` - загрузка файлов и ссылок
- `GET /api/documents` - получение списка документов
- `DELETE /api/documents?id=...` - удаление документа

## Переменные окружения

```bash
# Провайдер эмбеддингов
EMBEDDING_PROVIDER=huggingface  # openai, huggingface, cohere, ollama, mock

# Для тестирования (генерирует случайные векторы)
USE_MOCK_EMBEDDINGS=false

# Источник по умолчанию
DEFAULT_SOURCE_ID=c5aab739-7112-4360-be9e-45edf4287c42
```

## Диагностика проблем

### Ошибка "different vector dimensions"
- Убедитесь, что размерность в базе данных - 384
- Проверьте, что EMBEDDING_PROVIDER=huggingface
- Перезапустите приложение после изменения переменных окружения

### Ошибка подключения к Supabase
- Проверьте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY
- Убедитесь, что ключи не истекли

### Проблемы с эмбеддингами
- Проверьте HUGGINGFACE_API_KEY для Hugging Face
- Или установите USE_MOCK_EMBEDDINGS=true для тестирования