const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
// lib/embedding.ts
import axios from 'axios';

const USE_MOCK_EMBEDDINGS = process.env.USE_MOCK_EMBEDDINGS === 'true';

const HF_API_KEY = process.env.HF_API_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;



export type EmbeddingProvider = 'voyage' | 'huggingface' | 'fireworks' | 'openai' | 'cohere' | 'mixedbread' | 'groq' | 'gemini' | 'mistral';

export async function getEmbedding(text: string, provider: EmbeddingProvider = 'voyage'): Promise<number[]> {
  if (USE_MOCK_EMBEDDINGS) {
    // Возвращаем случайный вектор фиксированной длины (например, 384)
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }
  try {
    switch (provider) {
    case 'gemini': {
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/embedding-001:embedText?key=${GEMINI_API_KEY}`,
        { text: text },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!response.data?.embedding?.values) throw new Error('No embedding returned from Gemini');
      return response.data.embedding.values;
    }
    case 'groq': {
      if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
      // Пример: https://console.groq.com/docs/api-reference/embeddings
      const response = await axios.post(
        'https://api.groq.com/openai/v1/embeddings',
        { model: 'text-embedding-ada-002', input: text },
        { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.data?.[0]?.embedding) throw new Error('No embedding returned from Groq');
      return response.data.data[0].embedding;
    }
    case 'mixedbread': {
      const MIXEDBREAD_API_KEY = process.env.MIXEDBREAD_API_KEY;
      if (!MIXEDBREAD_API_KEY) throw new Error('MIXEDBREAD_API_KEY is not set');
      // Mixedbread API: https://docs.mixedbread.ai/reference/post_v1-embeddings
      const response = await axios.post(
        'https://api.mixedbread.ai/v1/embeddings',
        { model: 'mixedbread-ai/mxbai-embed-large-v1', input: text },
        { headers: { Authorization: `Bearer ${MIXEDBREAD_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.data?.[0]?.embedding) throw new Error('No embedding returned from Mixedbread');
      return response.data.data[0].embedding;
    }
    case 'voyage': {
      if (!VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY is not set');
      const response = await axios.post(
        'https://api.voyageai.com/v1/embeddings',
        { model: 'voyage-2', input: text },
        { headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.data?.[0]?.embedding) throw new Error('No embedding returned from Voyage AI');
      return response.data.data[0].embedding;
    }
    case 'huggingface': {
      if (!HF_API_KEY) throw new Error('HF_API_KEY is not set');
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
        { inputs: text },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            Accept: 'application/json',
          },
        }
      );
      // Hugging Face может вернуть массив массивов (batch), либо массив (single)
      if (Array.isArray(response.data)) {
        if (Array.isArray(response.data[0])) return response.data[0];
        return response.data;
      }
      if (response.data?.embedding) return response.data.embedding;
      throw new Error('No embedding returned from Hugging Face');
    }
    case 'fireworks': {
      if (!FIREWORKS_API_KEY) throw new Error('FIREWORKS_API_KEY is not set');
      const response = await axios.post(
        'https://api.fireworks.ai/inference/v1/embeddings',
        { model: 'nomic-ai/nomic-embed-text-v1.5', input: text },
        { headers: { Authorization: `Bearer ${FIREWORKS_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.data?.[0]?.embedding) throw new Error('No embedding returned from Fireworks');
      return response.data.data[0].embedding;
    }
    case 'openai': {
      if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        { model: 'text-embedding-ada-002', input: text },
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.data?.[0]?.embedding) throw new Error('No embedding returned from OpenAI');
      return response.data.data[0].embedding;
    }
    case 'cohere': {
      if (!COHERE_API_KEY) throw new Error('COHERE_API_KEY is not set');
      const response = await axios.post(
        'https://api.cohere.ai/v1/embed',
        { texts: [text], model: 'embed-english-v3.0' },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.embeddings?.[0]) throw new Error('No embedding returned from Cohere');
      return response.data.embeddings[0];
    }
    case 'mistral': {
      if (!MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is not set');
      // Mistral API: https://docs.mistral.ai/api/
      const response = await axios.post(
        'https://api.mistral.ai/v1/embeddings',
        { model: 'mistral-embed', input: text },
        { headers: { Authorization: `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.data?.data?.[0]?.embedding) throw new Error('No embedding returned from Mistral');
      return response.data.data[0].embedding;
    }
    default:
      throw new Error('Unknown embedding provider: ' + provider);
    }
  } catch (err: any) {
    // Универсальное логирование ошибок
    if (err.response) {
      console.error(`[EMBEDDING ERROR][${provider}]`, err.response.data);
    } else {
      console.error(`[EMBEDDING ERROR][${provider}]`, err.message);
    }
    throw new Error(`Embedding provider '${provider}' failed: ${err.message}`);
  }
}
