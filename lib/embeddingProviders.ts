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
  dimension = 768
  
  constructor(
    private model: string = 'facebook/bart-base'
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    console.log('HuggingFace: Starting embedding generation for text length:', text.length)
    
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('HuggingFace: API key not found')
      throw new Error('HUGGINGFACE_API_KEY не найден')
    }

    // Очищаем API ключ от возможных пробелов и невидимых символов
    const apiKey = process.env.HUGGINGFACE_API_KEY.trim()
    console.log('HuggingFace: API key found and cleaned, making request...')

    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.model}`,
        { 
          inputs: text
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000 // 30 секунд таймаут
        }
      )

      console.log('HuggingFace: Response status:', response.status)
      console.log('HuggingFace: Response data type:', typeof response.data)
      console.log('HuggingFace: Response data structure:', Array.isArray(response.data))
      
      // HuggingFace models API возвращает массив эмбеддингов
      let embedding;
      if (Array.isArray(response.data) && Array.isArray(response.data[0])) {
        // Если это массив массивов, берем первый
        embedding = response.data[0];
      } else if (Array.isArray(response.data)) {
        // Если это просто массив чисел
        embedding = response.data;
      } else {
        throw new Error('Unexpected response format from HuggingFace');
      }
      
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
/**
 * Фабрика для создания провайдера эмбеддингов по имени модели или провайдера.
 * @param modelOrProvider строка: 'openai', 'huggingface', 'cohere', 'ollama', либо конкретная huggingface/ollama модель
 */
export function createEmbeddingProvider(modelOrProvider?: string): EmbeddingProvider {
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