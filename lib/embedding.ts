
import axios from 'axios';

const USE_MOCK_EMBEDDINGS = process.env.USE_MOCK_EMBEDDINGS === 'true';

export type EmbeddingBackend = 'huggingface' | 'transformers' | 'mock';

export interface EmbeddingOptions {
  backend?: EmbeddingBackend;
  model?: string;
}

// Universal getEmbedding function
export async function getEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const backend = options.backend || 'huggingface';
  const model = options.model || 'intfloat/multilingual-e5-small';

  if (backend === 'mock' || model === 'mock' || USE_MOCK_EMBEDDINGS) {
    // Always return a random embedding for mock
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }

  const cleanedText = text.replace(/\s+/g, ' ').trim();

  if (backend === 'transformers') {
    // Use local Transformers.js via Edge API route
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_TRANSFORMERS_API_URL || '/api/transformers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanedText, task: 'feature-extraction', model })
        }
      );
      const data = await response.json();
      if (response.ok && data.result) {
        // Transformers.js returns [ [embedding] ]
        if (Array.isArray(data.result) && Array.isArray(data.result[0])) {
          return data.result[0];
        }
        if (Array.isArray(data.result)) {
          return data.result;
        }
      }
      // fallback to mock if error or unexpected
      return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    } catch (err: any) {
      // fallback to mock
      return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    }
  }

  if (backend === 'huggingface') {
    // Use Hugging Face Inference API
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      throw new Error('HF_API_KEY is not set in environment variables');
    }
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
          validateStatus: () => true
        }
      );
      if (typeof response.data === 'string') {
        if (response.data.startsWith('Not Found')) {
          return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
        }
        throw new Error('Hugging Face API returned non-JSON: ' + response.data);
      }
      if (response.status === 404) {
        return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
      }
      if (response.status >= 400) {
        throw new Error('Hugging Face API error: ' + JSON.stringify(response.data));
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
        return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
      }
      throw new Error(`Hugging Face embedding failed: ${err.message}`);
    }
  }

  // fallback to mock if backend is unknown
  return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
}