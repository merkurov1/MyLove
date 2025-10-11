import axios from 'axios';

const USE_MOCK_EMBEDDINGS = process.env.USE_MOCK_EMBEDDINGS === 'true';

export async function getEmbedding(text: string): Promise<number[]> {
  if (USE_MOCK_EMBEDDINGS) {
    // Возвращаем моковые данные для тестов, если включено
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY is not set in environment variables');
  }

  // Очищаем текст от лишних пробелов и переносов строк
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // Используем более стабильный URL для "feature-extraction" pipeline
  const apiUrl = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

  try {
    const response = await axios.post(
      apiUrl,
      // ✅ ГЛАВНОЕ ИСПРАВЛЕНИЕ:
      // API ожидает объект с ключом `sentences`, а не `inputs`.
      // Значением должен быть массив строк.
      {
        sentences: [cleanedText],
        options: { wait_for_model: true } // Опция для надежности
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`
        }
      }
    );

    // Проверяем, что ответ имеет ожидаемую структуру (массив векторов)
    if (Array.isArray(response.data) && Array.isArray(response.data[0]) && typeof response.data[0][0] === 'number') {
      return response.data[0]; // Возвращаем первый вектор из ответа
    }

    // Если формат ответа неожиданный
    console.error('[HF EMBEDDING UNEXPECTED FORMAT]', response.data);
    throw new Error('Unexpected response format from Hugging Face API');

  } catch (err: any) {
    if (err.response) {
      // Логируем тело ошибки от Hugging Face для более простой отладки
      console.error('[HF EMBEDDING ERROR BODY]', err.response.data);
    }
    // Пробрасываем ошибку дальше, чтобы ее обработал основной route handler
    throw new Error(`Hugging Face embedding failed: ${err.message}`);
  }
}
