require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют переменные окружения SUPABASE')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createDefaultSource() {
  console.log('🔧 Создаем источник по умолчанию...')

  const { data, error } = await supabase
    .from('sources')
    .upsert({
      id: 'c5aab739-7112-4360-be9e-45edf4287c42',
      name: 'Основной источник',
      description: 'Основной источник документов для AI-ассистента'
    })
    .select()

  if (error) {
    console.error('❌ Ошибка создания источника:', error)
    return false
  }

  console.log('✅ Источник создан:', data)
  return true
}

createDefaultSource().then(() => {
  console.log('🎉 Готово!')
})