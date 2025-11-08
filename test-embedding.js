// Проверка работы getEmbedding
require('dotenv').config({ path: '.env.local' });
const { getEmbedding } = require('./lib/embedding');

(async () => {
  console.log('🧪 Тест функции getEmbedding\n');
  console.log('USE_MOCK_EMBEDDINGS:', process.env.USE_MOCK_EMBEDDINGS);
  console.log('HF_API_KEY:', process.env.HF_API_KEY ? 'SET' : 'NOT SET');
  
  try {
    const embedding = await getEmbedding('Тестовый текст для проверки');
    console.log('\n✅ Embedding получен!');
    console.log('Размерность:', embedding.length);
    console.log('Первые 5 значений:', embedding.slice(0, 5));
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
  }
})();
