// re-embed-all-documents.js - Пересоздать embeddings для всех документов
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

// Importing embedding functions
const { getEmbeddings } = require('./lib/embedding-ai.ts');
const { splitIntoChunks } = require('./lib/chunking.ts');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reEmbedAllDocuments() {
  console.log('🔄 Начинаем пересоздание embeddings для всех документов...\n');
  
  // 1. Получаем все документы
  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Ошибка получения документов:', error);
    return;
  }
  
  if (!documents || documents.length === 0) {
    console.log('📭 Нет документов для обработки');
    return;
  }
  
  console.log(`📚 Найдено документов: ${documents.length}\n`);
  
  // 2. Обрабатываем каждый документ
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    console.log(`\n[${i + 1}/${documents.length}] Обработка: ${doc.title || doc.id}`);
    console.log(`   Source URL: ${doc.source_url || 'N/A'}`);
    
    try {
      // Читаем описание документа как контент
      const content = doc.description || '';
      
      if (!content || content.length < 10) {
        console.log('   ⚠️  Пропуск: нет контента');
        continue;
      }
      
      // 3. Разбиваем на чанки
      const chunks = splitIntoChunks(content, 1000, 150);
      console.log(`   📄 Создано чанков: ${chunks.length}`);
      
      // 4. Создаём embeddings
      console.log(`   🔮 Генерация embeddings...`);
      const embeddings = await getEmbeddings(chunks);
      
      // 5. Сохраняем в БД
      const chunksToInsert = chunks.map((chunk, idx) => ({
        document_id: doc.id,
        chunk_index: idx,
        content: chunk,
        embedding: embeddings[idx],
        checksum: crypto.createHash('md5').update(chunk).digest('hex'),
        metadata: {
          document_title: doc.title,
          document_source: doc.source_url,
          chunk_length: chunk.length
        }
      }));
      
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(chunksToInsert);
      
      if (insertError) {
        console.error(`   ❌ Ошибка сохранения: ${insertError.message}`);
      } else {
        console.log(`   ✅ Сохранено ${chunks.length} чанков`);
      }
      
    } catch (err) {
      console.error(`   ❌ Ошибка обработки: ${err.message}`);
    }
  }
  
  // 6. Финальная статистика
  const { count: totalChunks } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n\n✅ Готово!`);
  console.log(`📊 Всего создано чанков: ${totalChunks}`);
  console.log(`📚 Обработано документов: ${documents.length}`);
}

reEmbedAllDocuments().catch(console.error);
