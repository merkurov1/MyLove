# Диагностика и исправления для iPad/Safari

## Проблемы которые были исправлены

### 1. ✅ localStorage crash (ИСПРАВЛЕНО)
**Симптом**: Страница падает при загрузке на iPad в Safari/Brave  
**Причина**: Safari блокирует `localStorage` в приватном режиме или при "Prevent Cross-Site Tracking"  
**Исправление**: Обернули все `localStorage.getItem/setItem/removeItem` в `try-catch` блоки в `PasswordProtection.tsx`

### 2. ✅ Отсутствие ErrorBoundary (ИСПРАВЛЕНО)
**Симптом**: При любой React-ошибке вся страница становится пустой  
**Причина**: Нет глобального обработчика ошибок React  
**Исправление**: Добавили `ErrorBoundary` компонент с дружественным UI для ошибок

### 3. ✅ Отсутствие обработки ошибок в fetch (ИСПРАВЛЕНО)
**Симптом**: Если API недоступен, компоненты падают  
**Причина**: `fetch().then()` без `.catch()`  
**Исправление**: Добавили `.catch()` обработчики в:
- `app/database/page.tsx` - загрузка sources
- `components/StatsPanel.tsx` - загрузка статистики
- `components/DocumentsTable.tsx` - уже было

### 4. ⚠️ RPC функция с неправильной размерностью (НЕ ИСПРАВЛЕНО)
**Симптом**: Чат не находит документы, хотя они в базе  
**Причина**: `match_documents` ожидает `vector(768)`, но код отправляет `vector(1536)`  
**Решение**: Нужно обновить RPC в Supabase через SQL Editor

## Что делать дальше

### Шаг 1: Проверить iPad после деплоя
Подождать 2-3 минуты пока Vercel задеплоит изменения (commit `8ef830a`), затем:

1. Открыть https://pierrot.merkurov.love/database на iPad
2. Если видна страница входа - ввести пароль `eMunwiL`
3. Если видна страница с данными - всё работает! ✅
4. Если видна красивая страница ошибки с кнопкой "Обновить" - ErrorBoundary сработал, откройте консоль браузера (если возможно)

### Шаг 2: Исправить RPC функцию в базе данных
Это нужно чтобы чат находил документы:

1. Открыть https://supabase.com/dashboard
2. Выбрать проект
3. Зайти в SQL Editor (левое меню)
4. Скопировать содержимое файла `supabase/quick-fix-match-documents.sql`
5. Вставить и нажать "Run"
6. Проверить что чат работает:

```bash
curl -X POST https://pierrot.merkurov.love/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"О чем статья из новой газеты?"}'
```

Должен вернуть информацию о статье, а не "Я не нашел информации".

## Технические детали

### Исправленные файлы в коммите 8ef830a

1. **components/ErrorBoundary.tsx** (новый)
   - React Error Boundary компонент
   - Красивый UI с кнопкой перезагрузки
   - Показывает детали ошибки в <details>

2. **components/ClientProviders.tsx**
   - Обернули всё в `<ErrorBoundary>`
   - Теперь любая React-ошибка не убьет всё приложение

3. **components/PasswordProtection.tsx**
   - `try-catch` вокруг `localStorage.getItem()` в useEffect
   - `try-catch` вокруг `localStorage.setItem()` в handleSubmit
   - `try-catch` вокруг `localStorage.removeItem()` в handleLogout

4. **app/database/page.tsx**
   - Добавлен `.catch()` для fetch sources

5. **components/StatsPanel.tsx**
   - Добавлен `.catch()` для fetch stats

### Предыдущие исправления (commit 05fae9d)

- localStorage защита в PasswordProtection

## Как тестировать на iPad

### Если нет доступа к консоли Safari на iPad:

1. **Через Mac + Safari Developer Tools**:
   - Подключить iPad к Mac через USB
   - Открыть Safari на Mac
   - Develop → [Имя iPad] → [Вкладка]
   - Смотреть консоль в реальном времени

2. **Без Mac - через симптомы**:
   - Белый экран = JavaScript-ошибка до рендера
   - Пустая страница = React компонент упал
   - Экран ErrorBoundary = React ошибка, но ErrorBoundary работает ✅
   - Страница показывается = всё ОК ✅

## Статус

- ✅ localStorage защита - готово
- ✅ ErrorBoundary - готово
- ✅ Обработка ошибок fetch - готово
- ✅ Задеплоено на Vercel (commit 8ef830a)
- ⏳ Проверка на iPad - ждем результатов
- ⏳ Обновление RPC в Supabase - нужно сделать вручную

## Следующие шаги после тестирования

1. Если всё работает на iPad → обновить RPC в базе
2. Если всё еще падает → нужна консоль Safari для диагностики конкретной ошибки
3. Если показывает ErrorBoundary → детали ошибки помогут понять что не так
