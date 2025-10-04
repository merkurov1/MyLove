# MyLove Dashboard - Отладка и тестирование

## 🚨 Проблема: Чат зависает

Приложение работает локально, но API чата зависает. Добавлена подробная отладочная информация для диагностики.

## 🔍 Диагностика проблемы

### Локальное тестирование

1. **Запуск сервера:**
   ```bash
   npm run dev
   ```

2. **Проверка базовой работоспособности:**
   ```bash
   curl http://localhost:3000/api/test
   ```

3. **Тестирование чата с таймаутом:**
   ```bash
   timeout 30 curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"query": "test", "model": "command-r-plus"}'
   ```

4. **Мониторинг логов:**
   ```bash
   # В отдельном терминале
   tail -f /dev/null & npm run dev 2>&1 | tee server.log
   ```

### Отладочная информация

API логирует каждый шаг с временными метками:
- ✅ Получение запроса
- 🔄 Проверка переменных окружения
- 🔄 Генерация embedding (OpenAI)
- 🔄 Поиск в Supabase
- 🔄 Запрос к Cohere API
- ✅ Возврат ответа

## 🌐 Развертывание на Vercel

### 1. Переменные окружения для Vercel

В Vercel Dashboard добавьте следующие переменные:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hukfgitwamcwsiyxlhyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_ключ
COHERE_API_KEY=ваш_cohere_ключ
OPENAI_API_KEY=ваш_openai_ключ
```

### 2. Деплой

```bash
# Через Vercel CLI
npm i -g vercel
vercel --prod

# Или через GitHub integration
git add .
git commit -m "Added debug logging for chat API"
git push origin main
```

### 3. Тестирование на Vercel

После деплоя протестируйте:
```bash
curl https://your-app.vercel.app/api/test
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "model": "command-r-plus"}'
```

## 🔧 Возможные причины зависания

1. **Cohere API timeout** - запрос занимает >60 сек
2. **OpenAI API rate limit** - превышен лимит запросов
3. **Supabase connection** - проблемы с базой данных
4. **Большие embeddings** - слишком много данных в поиске
5. **Неверный API endpoint** - Cohere изменил API

## 📊 Мониторинг

Логи показывают время выполнения каждого шага:
- Embedding: ~2-5 сек
- Supabase search: ~100-500 мс
- Cohere API: ~5-30 сек

Если Cohere API зависает >60 сек - это таймаут.