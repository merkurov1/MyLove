// Тест загрузки файла через API /api/ingest
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testFileUpload() {
  console.log('=== Тест загрузки файла ===\n');
  
  const form = new FormData();
  form.append('file', fs.createReadStream('test-upload.txt'));
  
  try {
    console.log('Отправка файла на /api/ingest...');
    const response = await axios.post('http://localhost:3000/api/ingest', form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    
    console.log('✅ Успех!');
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Детали:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testLinkProcessing() {
  console.log('\n=== Тест обработки ссылок ===\n');
  
  const testData = {
    type: 'links',
    links: ['https://example.com'],
    sourceId: 'c5aab739-7112-4360-be9e-45edf4287c42'
  };
  
  try {
    console.log('Отправка ссылок на /api/process...');
    const response = await axios.post('http://localhost:3000/api/process', testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    console.log('✅ Успех!');
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Детали:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function checkDatabaseConnection() {
  console.log('\n=== Проверка соединения с БД ===\n');
  
  try {
    const response = await axios.get('http://localhost:3000/api/documents', {
      timeout: 10000
    });
    
    console.log('✅ Соединение с БД работает!');
    console.log('Количество документов:', response.data.length || 0);
  } catch (error) {
    console.error('❌ Ошибка соединения с БД:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('Запуск тестов...\n');
  console.log('Убедитесь, что сервер запущен (npm run dev)\n');
  
  await checkDatabaseConnection();
  await testFileUpload();
  await testLinkProcessing();
  
  console.log('\n=== Тесты завершены ===');
}

runTests();
