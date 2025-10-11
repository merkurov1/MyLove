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
  
  // ✅ ПРАВИЛЬНЫЙ URL - без /pipeline/
  const apiUrl = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';

  try {
    const response = await axios.post(
      apiUrl,
      {
        inputs: cleanedText,  // ✅ Просто строка, не массив
        options: { wait_for_model: true }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Ответ обычно приходит как массив чисел или массив массивов
    let embedding: number[];
    
    if (Array.isArray(response.data)) {
      // Если это массив массивов (например, [[0.1, 0.2, ...]]), берем первый
      if (Array.isArray(response.data[0])) {
        embedding = response.data[0];
      } else {
        // Если это просто массив чисел [0.1, 0.2, ...]
        embedding = response.data;
      }
      
      if (embedding.length > 0) {
        console.log(`[HF EMBEDDING SUCCESS] Got ${embedding.length} dimensions`);
        return embedding;
      }
    }

    console.error('[HF EMBEDDING UNEXPECTED FORMAT]', response.data);
    throw new Error('Unexpected response format from Hugging Face API');

  } catch (err: any) {
    if (err.response) {
      console.error('[HF EMBEDDING ERROR]', {
        status: err.response.status,
        data: err.response.data,
        url: apiUrl
      });
    } else {
      console.error('[HF EMBEDDING ERROR]', err.message);
    }
    throw new Error(`Hugging Face embedding failed: ${err.message}`);
  }
}