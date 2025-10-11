import axios from 'axios';

const USE_MOCK_EMBEDDINGS = process.env.USE_MOCK_EMBEDDINGS === 'true';

export async function getEmbedding(text: string, model: string = "intfloat/multilingual-e5-small"): Promise<number[]> {
  if (model === "mock" || USE_MOCK_EMBEDDINGS) {
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY is not set in environment variables');
  }

  const cleanedText = text.replace(/\s+/g, ' ').trim();
  const apiUrl = `https://api-inference.huggingface.co/models/${model}`;

  try {
    const response = await axios.post(
      apiUrl,
      {
        inputs: [cleanedText],
        options: { wait_for_model: true }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Позволяет обрабатывать любые коды ответа
      }
    );

    if (typeof response.data === 'string') {
      if (response.data.startsWith('Not Found')) {
        // fallback на mock
        return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
      }
      throw new Error('Hugging Face API вернул не-JSON ответ: ' + response.data);
    }
    if (response.status === 404) {
      // fallback на mock
      return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    }
    if (response.status >= 400) {
      throw new Error('Ошибка Hugging Face API: ' + JSON.stringify(response.data));
    }

    let embedding: number[] | undefined = undefined;
    if (Array.isArray(response.data)) {
      if (Array.isArray(response.data[0])) {
        embedding = response.data[0];
      } else {
        embedding = response.data;
      }
      if (embedding && embedding.length > 0) {
        return embedding;
      }
    }
    throw new Error('Unexpected response format from Hugging Face API');
  } catch (err: any) {
    if (err.message && (err.message.includes('Not Found') || err.message.includes('Модель не поддерживается'))) {
      // fallback на mock
      return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    }
    throw new Error(`Hugging Face embedding failed: ${err.message}`);
  }
}