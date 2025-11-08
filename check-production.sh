#!/bin/bash
# Проверка статуса продакшена

echo "🔍 Проверяю статус https://pierrot.merkurov.love/database ..."
echo ""

# Проверка главной страницы
echo "1. Проверка главной страницы:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://pierrot.merkurov.love/

# Проверка database страницы
echo ""
echo "2. Проверка /database:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://pierrot.merkurov.love/database

# Проверка API endpoints
echo ""
echo "3. Проверка API endpoints:"
echo "   - /api/sources:"
curl -s https://pierrot.merkurov.love/api/sources | jq -r '.sources // .error // "OK"' 2>/dev/null || echo "Failed"

echo "   - /api/documents:"
curl -s https://pierrot.merkurov.love/api/documents | jq -r '.docs // .error // "OK"' 2>/dev/null || echo "Failed"

echo "   - /api/stats:"
curl -s https://pierrot.merkurov.love/api/stats | jq -r '.error // "OK"' 2>/dev/null || echo "Failed"

echo ""
echo "✅ Проверка завершена"
