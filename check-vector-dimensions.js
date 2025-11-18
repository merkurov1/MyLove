const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hukfgitwamcwsiyxlhyb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment. Do NOT commit secrets to the repo.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Проверка размерности векторов в БД\n');
  
  const test768 = Array(768).fill(0.1);
  const test1024 = Array(1024).fill(0.1);
  
  // Сначала создадим тестовый документ
  const { data: doc, error: docErr } = await supabase.from('documents').insert({
    content: 'test',
    embedding: Array(384).fill(0.1),
    checksum: 'test_doc_' + Date.now()
  }).select().single();
  
  if (!doc) {
    console.log('❌ Не удалось создать тестовый документ:', docErr);
    return;
  }
  
  console.log('✅ Тестовый документ создан');
  
  // Проверяем document_chunks с vector(768)
  const { error: err768 } = await supabase.from('document_chunks').insert({
    document_id: doc.id,
    chunk_index: 0,
    content: 'test',
    embedding: test768,
    checksum: 'test768'
  });
  
  // Проверяем document_chunks с vector(1024)
  const { error: err1024 } = await supabase.from('document_chunks').insert({
    document_id: doc.id,
    chunk_index: 1,
    content: 'test',
    embedding: test1024,
    checksum: 'test1024'
  });
  
  console.log('\n📊 Результаты:');
  console.log('documents - vector(384): ✅ (уже проверено)');
  console.log('document_chunks - vector(768):', err768 ? '❌ ' + err768.message : '✅');
  console.log('document_chunks - vector(1024):', err1024 ? '❌ ' + err1024.message : '✅');
  
  // Удаляем тестовые записи
  await supabase.from('documents').delete().eq('id', doc.id);
  console.log('\n✅ Тестовые данные удалены');
})();
