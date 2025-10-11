import axios from 'axios';

const USE_MOCK_EMBEDDINGS = process.env.USE_MOCK_EMBEDDINGS === 'true';

export async function getEmbedding(text: string): Promise<number[]> {
  if (USE_MOCK_EMBEDDINGS) {
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY is not set in environment variables');
  }

  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // Используем ваш оригинальный, правильный URL
  const apiUrl = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';

  try {
    const response = await axios.post(
      apiUrl,
      // ✅ ИСПРАВЛЕНИЕ: Используем ключ 'sentences', как того требует лог ошибки.
      {
        sentences: [cleanedText],
        options: { wait_for_model: true }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`
        }
      }
    );

    // Этот API возвращает массив векторов, даже если отправлена одна строка.
    // Нам нужен первый элемент.
    if (Array.isArray(response.data) && Array.isArray(response.data[0])) {
      return response.data[0];
    }

    console.error('[HF EMBEDDING UNEXPECTED FORMAT]', response.data);
    throw new Error('Unexpected response format from Hugging Face API');

  } catch (err: any) {
    if (err.response) {
      console.error('[HF EMBEDDING ERROR BODY]', err.response.data);
    }
    throw new Error(`Hugging Face embedding failed: ${err.message}`);
  }
}
