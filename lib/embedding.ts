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
  
  // ✅ Используем модель для feature-extraction (эмбеддинги)
  const apiUrl = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

  try {
    const response = await axios.post(
      apiUrl,
      {
        inputs: cleanedText,  // Одна строка, не массив
        options: { wait_for_model: true }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Ответ может быть массивом массивов, берем первый элемент
    if (Array.isArray(response.data)) {
      const embedding = Array.isArray(response.data[0]) ? response.data[0] : response.data;
      
      if (Array.isArray(embedding) && embedding.length > 0) {
        return embedding;
      }
    }

    console.error('[HF EMBEDDING UNEXPECTED FORMAT]', response.data);
    throw new Error('Unexpected response format from Hugging Face API');

  } catch (err: any) {
    if (err.response) {
      console.error('[HF EMBEDDING ERROR]', {
        status: err.response.status,
        data: err.response.data
      });
    }
    throw new Error(`Hugging Face embedding failed: ${err.message}`);
  }
}