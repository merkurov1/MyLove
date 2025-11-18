const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hukfgitwamcwsiyxlhyb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment. Do NOT commit secrets to the repo.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('🔍 Проверяем подключение к базе данных...')
  
  // Проверяем источники данных
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('*')
  
  if (sourcesError) {
    console.error('❌ Ошибка при получении источников:', sourcesError)
  } else {
    console.log('✅ Источники данных:', sources?.length || 0)
    sources?.forEach(source => {
      console.log(`  - ${source.name} (${source.id})`)
    })
  }
  
  // Проверяем документы
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, content, metadata, created_at')
    .limit(5)
  
  if (docsError) {
    console.error('❌ Ошибка при получении документов:', docsError)
  } else {
    console.log(`✅ Документы в базе: ${documents?.length || 0}`)
    documents?.forEach(doc => {
      console.log(`  - ${doc.id}: "${doc.content.substring(0, 50)}..." (${doc.created_at})`)
    })
  }
  
  // Проверяем функции базы данных
  console.log('\n🔧 Проверяем функции базы данных...')
  try {
    // Проверяем функцию match_documents
    const { data: matchResult, error: matchError } = await supabase.rpc('match_documents', {
      query_embedding: Array.from({ length: 384 }, () => Math.random()),
      match_count: 1
    })

    if (matchError) {
      console.error('❌ Ошибка функции match_documents:', matchError.message)
    } else {
      console.log('✅ Функция match_documents работает')
    }
  } catch (error) {
    console.error('❌ Ошибка при вызове match_documents:', error.message)
  }

  // Проверяем размерность векторов
  console.log('\n📏 Проверяем размерность векторов...')
  try {
    const { data: vectorCheck, error: vectorError } = await supabase
      .from('documents')
      .select('id')
      .limit(1)

    if (vectorError) {
      console.error('❌ Ошибка при проверке векторов:', vectorError.message)
    } else {
      console.log('✅ Структура таблицы documents корректна')
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке структуры:', error.message)
  }
}

checkDatabase().catch(console.error)