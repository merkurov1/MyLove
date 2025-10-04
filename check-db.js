const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hukfgitwamcwsiyxlhyb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1a2ZnaXR3YW1jd3NpeXhsaHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3MTk3MywiZXhwIjoyMDc1MDQ3OTczfQ.HrL0GpP2AI1WDN6EAeXx2bWUzH_Ajefaj8nMsTJywR8'

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
  
  // Проверяем общее количество документов
  const { count, error: countError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error('❌ Ошибка при подсчете документов:', countError)
  } else {
    console.log(`📊 Общее количество документов: ${count}`)
  }
}

checkDatabase().catch(console.error)