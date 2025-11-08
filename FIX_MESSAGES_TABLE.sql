-- ==========================================
-- FIX: Пересоздать таблицу messages с правильной структурой
-- ==========================================
-- Проблема 1: таблица messages существует, но БЕЗ колонки role и других полей
-- Проблема 2: История чатов не сохраняется из-за отсутствующих колонок
-- Проблема 3: Новый документ загружен но чат его не находит (similarity слишком низкий)

-- РЕШЕНИЕ: Полностью пересоздать таблицу messages

DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Создаём индекс для быстрого поиска по conversation_id
CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX messages_created_at_idx ON messages(created_at DESC);

-- Проверка структуры таблицы
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Должно вернуть:
-- id | uuid | NO | gen_random_uuid()
-- conversation_id | uuid | YES | NULL
-- role | text | NO | NULL
-- content | text | NO | NULL  
-- metadata | jsonb | YES | '{}'::jsonb
-- created_at | timestamptz | YES | now()
