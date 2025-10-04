const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hukfgitwamcwsiyxlhyb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1a2ZnaXR3YW1jd3NpeXhsaHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3MTk3MywiZXhwIjoyMDc1MDQ3OTczfQ.HrL0GpP2AI1WDN6EAeXx2bWUzH_Ajefaj8nMsTJywR8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function showStats() {
  console.log('📊 Статистика базы данных AI-ассистента')
  console.log('=' .repeat(50))
  
  // Общая статистика
  const { count: totalDocs } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
  
  console.log(`📚 Всего документов: ${totalDocs}`)
  
  // Статистика по источникам
  const { data: sourceStats } = await supabase
    .from('documents')
    .select(`
      source_id,
      sources!inner (
        name
      )
    `)
  
  const sourceCounts = {}
  sourceStats?.forEach(doc => {
    const sourceName = doc.sources.name
    sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1
  })
  
  console.log('\n📂 По источникам:')
  Object.entries(sourceCounts).forEach(([source, count]) => {
    console.log(`  - ${source}: ${count} документов`)
  })
  
  // Статистика по типам контента
  const { data: typeStats } = await supabase
    .from('documents')
    .select('metadata')
  
  const typeCounts = {}
  typeStats?.forEach(doc => {
    const type = doc.metadata?.source_type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })
  
  console.log('\n🔍 По типам контента:')
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count} документов`)
  })
  
  // Последние добавленные
  const { data: recent } = await supabase
    .from('documents')
    .select('content, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(3)
  
  console.log('\n🕒 Последние добавления:')
  recent?.forEach((doc, i) => {
    const filename = doc.metadata?.filename || doc.metadata?.url || 'Unknown'
    const preview = doc.content.substring(0, 50) + '...'
    console.log(`  ${i + 1}. ${filename}`)
    console.log(`     "${preview}"`)
    console.log(`     ${doc.created_at}`)
  })
}

showStats().catch(console.error)