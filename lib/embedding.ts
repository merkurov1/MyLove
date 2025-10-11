import axios from 'axios';

const USE_MOCK_EMBEDDINGS = process.env.USE_MOCK_EMBEDDINGS === 'true';
export async function getEmbedding(text: string): Promise<number[]> {
  if (USE_MOCK_EMBEDDINGS) {
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }
  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) throw new Error('HF_API_KEY is not set');
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/sentence-transformers/paraphrase-MiniLM-L6-v2',
      { inputs: [text] },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          Accept: 'application/json',
        },
      }
    );
    if (Array.isArray(response.data)) {
      if (Array.isArray(response.data[0])) return response.data[0];
      return response.data;
    }
    if (response.data?.embedding) return response.data.embedding;
    throw new Error('No embedding returned from Hugging Face');
  } catch (err: any) {
    if (err.response) {
      console.error('[HF EMBEDDING ERROR BODY]', err.response.data);
    }
    throw new Error(`Hugging Face embedding failed: ${err.message}`);
  }
}

