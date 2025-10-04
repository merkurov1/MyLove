import axios from 'axios'

// Интерфейс для работы с разными провайдерами эмбеддингов
export interface EmbeddingProvider {
  name: string
  generateEmbedding: (text: string) => Promise<number[]>
  dimension: number
}

// OpenAI provider (оригинальный)
export class OpenAIProvider implements EmbeddingProvider {
  name = 'OpenAI'
  dimension = 1536

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: text,
        model: 'text-embedding-ada-002',
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data.data[0].embedding
  }
}

// Ollama provider (локальный, бесплатный)
export class OllamaProvider implements EmbeddingProvider {
  name = 'Ollama'
  dimension = 768
  
  constructor(
    private baseUrl: string = 'http://localhost:11434',
    private model: string = 'nomic-embed-text'
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model: this.model,
        prompt: text,
      })

      return response.data.embedding
    } catch (error) {
      console.error('Ollama embedding error:', error)
      throw new Error('Ошибка генерации эмбеддинга через Ollama')
    }
  }
}

// Hugging Face provider (бесплатный API)
export class HuggingFaceProvider implements EmbeddingProvider {
  name = 'Hugging Face'
  dimension = 384
  
  constructor(
    private model: string = 'sentence-transformers/all-MiniLM-L6-v2'
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error('HUGGINGFACE_API_KEY не найден')
    }

    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      // Hugging Face возвращает массив массивов, берем первый
      return response.data[0]
    } catch (error) {
      console.error('Hugging Face embedding error:', error)
      throw new Error('Ошибка генерации эмбеддинга через Hugging Face')
    }
  }
}

// Cohere provider (бесплатный tier)
export class CohereProvider implements EmbeddingProvider {
  name = 'Cohere'
  dimension = 1024

  async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.COHERE_API_KEY) {
      throw new Error('COHERE_API_KEY не найден')
    }

    try {
      const response = await axios.post(
        'https://api.cohere.ai/v1/embed',
        {
          texts: [text],
          model: 'embed-english-light-v2.0',
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      return response.data.embeddings[0]
    } catch (error) {
      console.error('Cohere embedding error:', error)
      throw new Error('Ошибка генерации эмбеддинга через Cohere')
    }
  }
}

// Фабрика для создания провайдера
export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER || 'openai'
  
  switch (provider.toLowerCase()) {
    case 'ollama':
      return new OllamaProvider()
    case 'huggingface':
      return new HuggingFaceProvider()
    case 'cohere':
      return new CohereProvider()
    case 'openai':
    default:
      return new OpenAIProvider()
  }
}