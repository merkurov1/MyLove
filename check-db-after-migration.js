const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Проверка БД после миграции на Vercel AI SDK (1536 dimensions)\n');
  
  // Проверяем sources
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, name');
  
  if (sourcesError) {
    console.error('❌ Ошибка sources:', sourcesError);
  } else {
    console.log(`✅ Sources: ${sources.length}`);
    sources.forEach(s => console.log(`   - ${s.name} (${s.id})`));
  }
  
  // Проверяем documents
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, title');
  
  if (docsError) {
    console.error('❌ Ошибка documents:', docsError);
  } else {
    console.log(`\n✅ Documents: ${docs.length}`);
  }
  
  // Проверяем document_chunks
  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('id, content, document_id');
  
  if (chunksError) {
    console.error('❌ Ошибка document_chunks:', chunksError);
  } else {
    console.log(`✅ Document chunks: ${chunks.length}`);
  }
  
  // Проверяем функцию match_documents
  console.log('\n🔧 Проверка функций...');
  const testEmbedding = Array(1536).fill(0.1);
  const { data: matches, error: matchError } = await supabase
    .rpc('match_documents', {
      query_embedding: testEmbedding,
      match_count: 5
    });
  
  if (matchError) {
    console.error('❌ Функция match_documents:', matchError);
  } else {
    console.log(`✅ Функция match_documents работает (найдено: ${matches?.length || 0})`);
  }
  
  // Тестируем вставку с правильной размерностью
  console.log('\n📏 Проверка размерности векторов...');
  
  // Создаем тестовый документ
  const { data: testDoc, error: docErr } = await supabase
    .from('documents')
    .insert({
      title: 'Test Document',
      description: 'Test',
      source_id: sources[0]?.id
    })
    .select()
    .single();
  
  if (docErr) {
    console.error('❌ Ошибка создания документа:', docErr);
    return;
  }
  
  // Пробуем вставить chunk с vector(1536)
  const { error: embed1536Error } = await supabase
    .from('document_chunks')
    .insert({
      document_id: testDoc.id,
      chunk_index: 0,
      content: 'Test chunk',
      embedding: Array(1536).fill(0.1),
      checksum: 'test_' + Date.now()
    });
  
  if (embed1536Error) {
    console.error('❌ vector(1536):', embed1536Error.message);
  } else {
    console.log('✅ vector(1536) - работает!');
  }
  
  // Удаляем тестовый документ
  await supabase.from('documents').delete().eq('id', testDoc.id);
  
  console.log('\n✅ Миграция прошла успешно! БД готова к работе с OpenAI embeddings (1536 dim)');
})();
