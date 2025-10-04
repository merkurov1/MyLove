import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { CohereClient } from 'cohere-ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ШАГ 1: Инициализируем всех необходимых клиентов.
// Создаем клиент Cohere для использования Rerank API.
// Это позволит нам улучшить релевантность поиска документов.
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY!,
})

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] Chat API request started`)

  try {
    const { query, model = 'command-r-plus' } = await req.json()
    console.log(`[${new Date().toISOString()}] Chat API called with:`, {
      query: query?.substring(0, 100),
      model,
      queryLength: query?.length
    })

    if (!query || typeof query !== 'string') {
      console.log(`[${new Date().toISOString()}] Invalid query provided`)
      return NextResponse.json({ error: 'Нет запроса' }, { status: 400 })
    }

    if (!process.env.COHERE_API_KEY) {
      console.error(`[${new Date().toISOString()}] COHERE_API_KEY not found`)
      return NextResponse.json({ error: 'API ключ Cohere не настроен' }, { status: 500 })
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error(`[${new Date().toISOString()}] OPENAI_API_KEY not found`)
      return NextResponse.json({ error: 'API ключ OpenAI не настроен' }, { status: 500 })
    }

    console.log(`[${new Date().toISOString()}] Starting embedding request...`)

    // 1. Получить embedding для запроса через унифицированный провайдер
    const { createEmbeddingProvider } = await import('@/lib/embeddingProviders')
    const embeddingProvider = createEmbeddingProvider()
    console.log(`[${new Date().toISOString()}] Using ${embeddingProvider.name} for embeddings`)

    const embeddingStart = Date.now()
    let queryEmbedding = await embeddingProvider.generateEmbedding(query)
    const embeddingTime = Date.now() - embeddingStart
    console.log(`[${new Date().toISOString()}] ${embeddingProvider.name} embedding completed in ${embeddingTime}ms, length: ${queryEmbedding.length}`)

    if (queryEmbedding.length === 0) {
      console.error(`[${new Date().toISOString()}] All embedding providers failed, using mock embeddings`)
      // Используем mock embeddings для тестирования - размерность 384 для совместимости с Supabase
      queryEmbedding = new Array(384).fill(0).map(() => Math.random() - 0.5)
      console.log(`[${new Date().toISOString()}] Mock embedding generated, length: ${queryEmbedding.length}`)
    }

    // ШАГ 2: Найти релевантные документы через Supabase функцию
    // Запрашиваем избыточное количество документов (25 штук),
    // чтобы предоставить Cohere Rerank достаточно данных для анализа релевантности.
    // Это больше, чем нужно для финального ответа, но позволит выбрать самые релевантные.
    console.log(`[${new Date().toISOString()}] Starting Supabase search...`)
    const searchStart = Date.now()
    const { data: matches, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 25  // Увеличиваем количество для переранжирования
    })
    const searchTime = Date.now() - searchStart
    console.log(`[${new Date().toISOString()}] Supabase search completed in ${searchTime}ms`)

    if (error) {
      console.error(`[${new Date().toISOString()}] Supabase error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[${new Date().toISOString()}] Found ${matches?.length || 0} documents from Supabase`)

    // ШАГ 3: Переранжирование с помощью Cohere Rerank.
    // Это самый важный шаг новой логики. Мы передаем исходный вопрос пользователя
    // и все найденные документы в Cohere Rerank API. Модель проанализирует релевантность
    // каждого документа по отношению к вопросу и вернет отсортированный список,
    // где самые релевантные документы будут наверху.
    console.log(`[${new Date().toISOString()}] Starting Cohere Rerank...`)
    const rerankStart = Date.now()

    // Подготавливаем документы для переранжирования
    const documents = (matches || []).map((doc: any) => doc.content)

    const rerankResponse = await cohere.rerank({
      model: 'rerank-english-v2.0', // или 'rerank-multilingual-v2.0' для многоязычного контента
      query: query,
      documents: documents,
      topN: 5, // Возвращаем топ-5 самых релевантных документов
    })

    const rerankTime = Date.now() - rerankStart
    console.log(`[${new Date().toISOString()}] Cohere Rerank completed in ${rerankTime}ms`)
    console.log(`[${new Date().toISOString()}] Rerank returned ${rerankResponse.results.length} top documents`)

    // ШАГ 4: Формирование финального контекста.
    // Берем только топ-5 документов из переранжированного списка.
    // Это гарантирует, что в финальный промпт попадет только самая качественная и релевантная информация.
    const topDocuments = rerankResponse.results.map((result: any) => {
      const originalDoc = matches![result.index]
      return {
        content: originalDoc.content,
        score: result.relevanceScore
      }
    })

    const context = topDocuments.map((doc: any) => doc.content).join('\n---\n')
    console.log(`[${new Date().toISOString()}] Final context formed from ${topDocuments.length} top documents, total length: ${context.length}`)

    // ШАГ 5: Сформировать промпт для LLM
    // Теперь мы используем высококачественный контекст, отфильтрованный Cohere Rerank.
    // Это гарантирует, что модель получит только самую релевантную информацию для генерации ответа.
    let contextText = context
    if (contextText.length > 3000) {
      console.log(`[${new Date().toISOString()}] Context too long (${contextText.length}), truncating to 3000 chars`)
      contextText = contextText.substring(0, 3000) + '...'
    }

    const prompt = `Ты — экспертный ассистент. Основываясь ИСКЛЮЧИТЕЛЬНО на предоставленном ниже контексте, дай четкий и лаконичный ответ на вопрос пользователя. Если в контексте нет информации для ответа, прямо скажи: "Я не нашел информации по вашему вопросу в своей базе знаний". Не придумывай ничего от себя.\n\nКонтекст:\n---\n${contextText}\n---\n\nВопрос: ${query}`
    console.log(`[${new Date().toISOString()}] Prompt created with reranked context, length: ${prompt.length}`)

    // ШАГ 6: Получить ответ от Cohere API
    // Отправляем тщательно подготовленный промпт с отфильтрованным контекстом в Cohere для генерации финального ответа.
    // Благодаря переранжированию, модель получает только самую релевантную информацию.
    console.log(`[${new Date().toISOString()}] Starting Cohere API request with model: ${model}`)
    console.log(`[${new Date().toISOString()}] Prompt length: ${prompt.length} characters`)
    const cohereStart = Date.now()

    const chatRes = await axios.post(
      'https://api.cohere.ai/v1/generate',
      {
        prompt: prompt,
        model: 'command', // Используем более стабильную модель
        stream: false,
        temperature: 0.2,
        max_tokens: 512,
        return_likelihoods: 'NONE'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 second timeout for Cohere
      }
    )

    const cohereTime = Date.now() - cohereStart
    console.log(`[${new Date().toISOString()}] Cohere API request completed in ${cohereTime}ms`)
    console.log(`[${new Date().toISOString()}] Cohere API response status:`, chatRes.status)
    console.log(`[${new Date().toISOString()}] Cohere API response data keys:`, Object.keys(chatRes.data))

    // Cohere Chat API возвращает ответ в разных форматах
    let answer = ''
    if (chatRes.data.text) {
      answer = chatRes.data.text
    } else if (chatRes.data.message && chatRes.data.message.content) {
      answer = chatRes.data.message.content
    } else if (chatRes.data.generations && chatRes.data.generations[0]) {
      answer = chatRes.data.generations[0].text || chatRes.data.generations[0].generated_text || ''
    } else if (chatRes.data.response && chatRes.data.response.text) {
      answer = chatRes.data.response.text
    }

    console.log(`[${new Date().toISOString()}] Extracted answer, length: ${answer.length}`)
    console.log(`[${new Date().toISOString()}] Answer preview: ${answer.substring(0, 100)}`)

    if (!answer.trim()) {
      console.error(`[${new Date().toISOString()}] Empty answer extracted from Cohere response`)
      return NextResponse.json({ error: 'Получен пустой ответ от Cohere API' }, { status: 500 })
    }

    const totalTime = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] Chat API request completed successfully in ${totalTime}ms`)

    return NextResponse.json({ answer: answer.trim() })
  } catch (err: any) {
    const totalTime = Date.now() - startTime
    console.error(`[${new Date().toISOString()}] Chat API error after ${totalTime}ms:`, {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      stack: err.stack?.substring(0, 500)
    })

    // Return appropriate error message
    if (err.code === 'ECONNABORTED') {
      return NextResponse.json({ error: 'Таймаут запроса' }, { status: 408 })
    } else if (err.response?.status === 401) {
      return NextResponse.json({ error: 'Ошибка аутентификации API' }, { status: 401 })
    } else if (err.response?.status === 429) {
      return NextResponse.json({ error: 'Превышен лимит запросов API' }, { status: 429 })
    } else {
      return NextResponse.json({ error: 'Ошибка генерации ответа' }, { status: 500 })
    }
  }
}
