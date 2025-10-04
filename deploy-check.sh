#!/bin/bash

echo "🚀 Подготовка к продакшен развертыванию MyLove Dashboard"
echo ""

# Проверка наличия необходимых файлов
echo "📋 Проверка файлов..."
if [ ! -f ".env.local" ]; then
    echo "❌ Файл .env.local не найден!"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ Файл package.json не найден!"
    exit 1
fi

echo "✅ Файлы найдены"

# Проверка переменных окружения
echo ""
echo "🔧 Проверка переменных окружения..."
source .env.local

REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "COHERE_API_KEY"
    "BASIC_AUTH_USER"
    "BASIC_AUTH_PASS"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Отсутствуют переменные окружения:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📖 Смотрите VERCEL_SETUP.md для инструкций"
    exit 1
fi

echo "✅ Переменные окружения настроены"

# Проверка сборки
echo ""
echo "🔨 Проверка сборки..."
if npm run build > build.log 2>&1; then
    echo "✅ Сборка прошла успешно"
    rm build.log
else
    echo "❌ Ошибка сборки! Смотрите build.log"
    exit 1
fi

# Проверка базы данных
echo ""
echo "🗄️ Проверка базы данных..."
if node check-db.js > /dev/null 2>&1; then
    echo "✅ База данных настроена"
else
    echo "❌ Проблемы с базой данных"
    echo "   Выполните SQL из supabase-setup.sql в Supabase Dashboard"
fi

echo ""
echo "🎉 Приложение готово к развертыванию!"
echo ""
echo "📚 Следующие шаги:"
echo "1. Зарегистрируйтесь на https://vercel.com"
echo "2. Подключите GitHub репозиторий"
echo "3. Добавьте переменные окружения (см. VERCEL_SETUP.md)"
echo "4. Деплой!"
echo ""
echo "📖 Подробные инструкции в VERCEL_SETUP.md"