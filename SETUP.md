# 🚀 Инструкция по запуску панели управления AI-ассистентом

## 📋 Пошаговая настройка

### 1. Настройка Supabase

1. **Перейдите в ваш Supabase проект**: https://hukfgitwamcwsiyxlhyb.supabase.co
2. **Откройте SQL Editor** в боковом меню
3. **Выполните SQL-скрипт** из файла `supabase-setup.sql`
4. **Получите Service Role ключ**:
   - Перейдите в Settings → API
   - Скопируйте `service_role` ключ (НЕ `anon` ключ!)

### 2. Настройка OpenAI

1. **Перейдите на** https://platform.openai.com/api-keys
2. **Создайте новый API ключ**
3. **Скопируйте ключ** (он показывается только один раз!)

### 3. Настройка переменных окружения

1. **Скопируйте файл с примером**:
   ```bash
   cp .env.local.example .env.local
   ```

2. **Отредактируйте `.env.local`**:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://hukfgitwamcwsiyxlhyb.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_ключ_здесь
   
   # OpenAI Configuration
   OPENAI_API_KEY=ваш_openai_ключ_здесь
   
   # Basic Authentication
   BASIC_AUTH_USER=admin
   BASIC_AUTH_PASS=mylove2025
   
   # Default Source ID (получится после выполнения SQL)
   DEFAULT_SOURCE_ID=uuid_из_таблицы_sources
   ```

### 4. Установка и запуск

1. **Установите зависимости**:
   ```bash
   npm install
   ```

2. **Запустите в режиме разработки**:
   ```bash
   npm run dev
   ```

3. **Откройте в браузере**: http://localhost:3000

4. **Введите данные для входа**:
   - Пользователь: `admin`
   - Пароль: `mylove2025`

## 🎯 Первый тест

1. **Загрузите тестовый файл** (.txt или .md)
2. **Вставьте ссылку** на статью или YouTube видео
3. **Проверьте в Supabase**, что данные сохранились в таблице `documents`

## 🛠️ Устранение проблем

### Ошибка "Cannot find module"
```bash
npm install
```

### Ошибка подключения к Supabase
- Проверьте `SUPABASE_SERVICE_ROLE_KEY` 
- Убедитесь, что используете service_role, а не anon ключ

### Ошибка OpenAI API
- Проверьте `OPENAI_API_KEY`
- Убедитесь, что у вас есть доступ к API и средства на счету

### Ошибка аутентификации
- Проверьте `BASIC_AUTH_USER` и `BASIC_AUTH_PASS`
- Очистите кэш браузера

## 📊 Проверка данных в Supabase

После загрузки данных выполните в SQL Editor:

```sql
-- Проверка источников
SELECT * FROM sources;

-- Проверка документов
SELECT 
  id,
  LEFT(content, 100) as content_preview,
  metadata,
  created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- Статистика
SELECT 
  s.name as source_name,
  COUNT(d.id) as documents_count
FROM sources s
LEFT JOIN documents d ON s.id = d.source_id
GROUP BY s.id, s.name;
```

## 🚀 Деплой в продакшн

### Vercel (рекомендуется)

1. **Подключите репозиторий к Vercel**
2. **Добавьте переменные окружения** в настройках проекта
3. **Деплой произойдет автоматически**

### Другие платформы

Проект совместим с:
- Netlify
- Railway  
- DigitalOcean App Platform
- AWS Amplify

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в консоли браузера
2. Проверьте логи в терминале Next.js
3. Убедитесь в правильности всех API ключей
4. Проверьте статус Supabase и OpenAI сервисов