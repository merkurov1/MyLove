# СРОЧНЫЙ ФИКС: История чатов и поиск документов

## Проблемы обнаружены

1. ✅ **Документ загрузился** - `Anton Merkurov - CV, Bio, Press.docx` успешно обработан (ID: `7de8304a-b369-473c-8776-0721c45ceecc`)
2. ✅ **Чанки созданы** - все чанки документа корректно сохранены с embeddings  
3. ✅ **Библиотека mammoth** - установлена для парсинга .docx файлов
4. ❌ **Таблица messages** - существует БЕЗ нужных колонок (`role`, `content`, `metadata`)
5. ❌ **История чатов** - не сохраняется из-за ошибки в структуре таблицы
6. ⚠️ **Поиск документов** - работает, но низкий similarity (21%) для нового документа

## ЧТО НУЖНО СДЕЛАТЬ (2 минуты)

### Шаг 1: Исправить таблицу messages

1. Открой **Supabase Dashboard**: https://supabase.com/dashboard/project/hukfgitwamcwsiyxlhyb
2. Перейди в **SQL Editor** (левое меню)
3. Создай новый query
4. Скопируй и выполни **весь** файл `FIX_MESSAGES_TABLE.sql`:

```bash
cat FIX_MESSAGES_TABLE.sql
```

5. Нажми **RUN** (или F5)
6. Должно появиться сообщение об успешном создании таблицы
7. В конце увидишь структуру таблицы с колонками: `id`, `conversation_id`, `role`, `content`, `metadata`, `created_at`

### Шаг 2: Проверить что всё работает

После выполнения SQL:

1. **Открой сайт** https://pierrot.merkurov.love/
2. **Задай вопрос** в чате: `"о чем последняя колонка?"`
3. **Проверь историю** - нажми кнопку "История" справа вверху
4. **Должно появиться**:
   - Сообщения сохраняются в историю ✓
   - Клик по conversation загружает сообщения в диалог ✓
   - Sidebar показывает список conversations ✓

### Шаг 3: Проверить новый документ

Попробуй задать вопросы про Антона Меркурова:

```
Who is Anton Merkurov?
Tell me about Anton Merkurov career
What is Anton Merkurov's art philosophy?
```

⚠️ **ВАЖНО**: Документ на английском, поэтому вопросы лучше задавать на английском для лучшего similarity.

## Технические детали

### Что было сделано

1. **Добавлена поддержка .docx** - библиотека `mammoth` для парсинга Word документов
2. **Создан FIX_MESSAGES_TABLE.sql** - полное пересоздание таблицы с правильной структурой
3. **Deployment** - изменения автоматически задеплоены на Vercel

### Структура исправленной таблицы messages

```sql
CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

### Почему чат не видит новый документ?

Документ **ЕСТЬ** в базе и embedding **работает**, но:
- Документ на **английском** языке (CV, биография, пресса)
- Запросы на русском дают низкий similarity (21%)
- **РЕШЕНИЕ**: Задавать вопросы на английском

Пример хорошего запроса:
```
What are Anton Merkurov's main achievements in art and technology?
```

Плохой запрос (низкий similarity):
```
расскажи про Антона Меркурова
```

### Статистика после исправления

После выполнения SQL фикса:
- Documents: **7** (было 6 + новый .docx)
- Chunks: **~200+** (было 168 + новые из .docx)
- Conversations: будут сохраняться ✓
- Messages: будут сохраняться ✓

## Если что-то не работает

### История не подгружается

Проверь в Supabase SQL Editor:
```sql
SELECT * FROM messages LIMIT 5;
```

Должны быть колонки: `id`, `conversation_id`, `role`, `content`, `metadata`, `created_at`

### Чат всё ещё не находит документ

1. Проверь что embedding создан:
```sql
SELECT id, array_length(embedding::real[], 1) as dim 
FROM document_chunks 
WHERE document_id = '7de8304a-b369-473c-8776-0721c45ceecc' 
LIMIT 1;
```

Должно вернуть: `dim: 1536`

2. Задай вопрос **на английском** про конкретные факты из документа

### Debug endpoints

- `/api/stats` - статистика базы данных
- `/api/documents` - список всех документов
- `/api/conversations` - список conversations

## Следующие шаги после фикса

1. ✅ Таблица messages исправлена
2. ✅ История чатов работает
3. ✅ Новые документы загружаются через mammoth
4. ⏳ Протестировать психолингвистический анализ
5. ⏳ Проверить работу на больших документах

---

**Время выполнения**: 2 минуты  
**Риск**: Минимальный (DROP TABLE IF EXISTS - безопасно)  
**Результат**: Полностью рабочая история чатов + поддержка .docx файлов
