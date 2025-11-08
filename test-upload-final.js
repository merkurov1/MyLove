// Тест загрузки файла с новой системой embeddings
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testFileUpload() {
  console.log('🧪 Тест загрузки файла через /api/ingest\n');
  console.log('Используется:', process.env.USE_MOCK_EMBEDDINGS === 'true' ? 'Mock embeddings' : 'OpenAI embeddings');
  console.log('OpenAI Key:', process.env.OPENAI_API_KEY ? 'SET ✅' : 'NOT SET ❌');
  
  const form = new FormData();
  form.append('file', fs.createReadStream('test-upload.txt'));
  form.append('sourceId', process.env.DEFAULT_SOURCE_ID);
  
  try {
    console.log('\n📤 Отправка файла на localhost:3000/api/ingest...');
    const response = await axios.post('http://localhost:3000/api/ingest', form, {
      headers: form.getHeaders(),
      timeout: 60000
    });
    
    console.log('\n✅ Успех!');
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
    
    // Проверяем, что данные попали в БД
    console.log('\n🔍 Проверка данных в БД...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: docs } = await supabase.from('documents').select('id, title');
    const { data: chunks } = await supabase.from('document_chunks').select('id, content');
    
    console.log(`✅ Documents в БД: ${docs?.length || 0}`);
    console.log(`✅ Chunks в БД: ${chunks?.length || 0}`);
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Детали:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFileUpload();
