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
    console.log('HuggingFace: Starting embedding generation for text length:', text.length)
    
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('HuggingFace: API key not found')
      throw new Error('HUGGINGFACE_API_KEY не найден')
    }

    console.log('HuggingFace: API key found, making request...')

    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000 // 30 секунд таймаут
        }
      )

      console.log('HuggingFace: Response status:', response.status)
      console.log('HuggingFace: Response data type:', typeof response.data)
      console.log('HuggingFace: Response data length:', Array.isArray(response.data) ? response.data.length : 'not array')
      
      // Hugging Face возвращает массив массивов, берем первый
      const embedding = response.data[0]
      console.log('HuggingFace: Embedding length:', embedding?.length)
      
      return embedding
    } catch (error) {
      console.error('HuggingFace: Full error details:', error)
      if (axios.isAxiosError(error)) {
        console.error('HuggingFace: Response status:', error.response?.status)
        console.error('HuggingFace: Response data:', error.response?.data)
      }
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
  
  console.log('Creating embedding provider:', provider)
  console.log('Available env vars:', {
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'SET' : 'NOT_SET',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET'
  })
  
  switch (provider.toLowerCase()) {
    case 'ollama':
      console.log('Using Ollama provider')
      return new OllamaProvider()
    case 'huggingface':
      console.log('Using HuggingFace provider')
      return new HuggingFaceProvider()
    case 'cohere':
      console.log('Using Cohere provider')
      return new CohereProvider()
    case 'openai':
    default:
      console.log('Using OpenAI provider')
      return new OpenAIProvider()
  }
}