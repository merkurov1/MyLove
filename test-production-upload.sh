#!/bin/bash
# Быстрая проверка загрузки файла на продакшене после обновления OpenAI ключа

echo "🧪 Тестирую загрузку файла на продакшене..."
echo ""

# Создаём тестовый файл
echo "Тестовый документ для проверки нового OpenAI ключа. Дата: $(date). Этот файл будет обработан через text-embedding-3-small модель OpenAI." > /tmp/test-prod.txt

echo "📤 Загружаю файл на https://pierrot.merkurov.love/api/ingest ..."
echo ""

# Загружаем файл
response=$(curl -s -X POST https://pierrot.merkurov.love/api/ingest \
  -F "file=@/tmp/test-prod.txt" \
  -F "sourceId=c5aab739-7112-4360-be9e-45edf4287c42" \
  -w "\nHTTP_CODE:%{http_code}")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_CODE")

echo "📊 Результат:"
echo "HTTP Status: $http_code"
echo ""
echo "$body" | jq . 2>/dev/null || echo "$body"
echo ""

if [[ $http_code -eq 200 ]] && echo "$body" | grep -q '"success":true'; then
  echo "✅ SUCCESS! Файл успешно загружен и обработан!"
  echo ""
  echo "Проверяю что документ появился в базе..."
  curl -s https://pierrot.merkurov.love/api/documents | jq -r '.docs[0] | "Последний документ: \(.title) (создан \(.created_at))"' 2>/dev/null
  echo ""
  echo "🎉 ВСЁ РАБОТАЕТ! OpenAI ключ обновлён успешно!"
else
  echo "❌ ОШИБКА! Что-то пошло не так."
  if echo "$body" | grep -q "quota"; then
    echo "⚠️  Проблема с квотой OpenAI - возможно ключ ещё не обновился на Vercel"
    echo "Подождите 1-2 минуты после redeploy и попробуйте снова"
  fi
fi

# Очистка
rm -f /tmp/test-prod.txt
