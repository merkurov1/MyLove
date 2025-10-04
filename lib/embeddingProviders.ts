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
    
    // Для тестирования используем mock embeddings
    console.log('HuggingFace: Using mock embeddings for testing')
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1)
  }
}

// Mock provider (для тестирования)
export class MockProvider implements EmbeddingProvider {
  name = 'Mock'
  dimension = 384

  async generateEmbedding(text: string): Promise<number[]> {
    // Возвращаем случайный вектор размерностью 384 для тестирования
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1)
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
/**
 * Фабрика для создания провайдера эмбеддингов по имени модели или провайдера.
 * @param modelOrProvider строка: 'openai', 'huggingface', 'cohere', 'ollama', 'mock', либо конкретная huggingface/ollama модель
 */
export function createEmbeddingProvider(modelOrProvider?: string): EmbeddingProvider {
  // Проверяем, нужно ли использовать mock embeddings
  if (process.env.USE_MOCK_EMBEDDINGS === 'true') {
    console.log('Using Mock provider (mock embeddings enabled)')
    return new MockProvider()
  }

  let provider = modelOrProvider || process.env.EMBEDDING_PROVIDER || 'openai'
  provider = provider.toLowerCase()

  // Специальная обработка для huggingface/ollama с указанием модели
  if (provider.startsWith('huggingface/')) {
    const model = provider.replace('huggingface/', '')
    console.log('Using HuggingFace provider with model:', model)
    return new HuggingFaceProvider(model)
  }
  if (provider.startsWith('ollama/')) {
    const model = provider.replace('ollama/', '')
    console.log('Using Ollama provider with model:', model)
    return new OllamaProvider('http://localhost:11434', model)
  }

  switch (provider) {
    case 'mock':
      console.log('Using Mock provider')
      return new MockProvider()
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