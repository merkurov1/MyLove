import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEmbedding } from '@/lib/embedding'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] Chat API request started`)

  try {
    const { query } = await req.json()
    console.log(`[${new Date().toISOString()}] Chat API called with:`, {
      query: query?.substring(0, 100),
      queryLength: query?.length
    })

    if (!query || typeof query !== 'string') {
      console.log(`[${new Date().toISOString()}] Invalid query provided`)
      return NextResponse.json({ error: 'Нет запроса' }, { status: 400 })
    }

    if (!process.env.HF_API_KEY) {
      console.error(`[${new Date().toISOString()}] HF_API_KEY not found`)
      return NextResponse.json({ error: 'API ключ Hugging Face не настроен' }, { status: 500 })
    }

    console.log(`[${new Date().toISOString()}] Starting embedding request...`)

    // 1. Получить embedding для запроса через Hugging Face
    const embeddingStart = Date.now()
    const queryEmbedding = await getEmbedding(query)
    const embeddingTime = Date.now() - embeddingStart
    console.log(`[${new Date().toISOString()}] Hugging Face embedding completed in ${embeddingTime}ms, length: ${queryEmbedding.length}`)

    // 2. Найти релевантные документы через Supabase функцию
    console.log(`[${new Date().toISOString()}] Starting Supabase search...`)
    const searchStart = Date.now()
    const { data: matches, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5  // Возвращаем топ-5 документов напрямую
    })
    const searchTime = Date.now() - searchStart
    console.log(`[${new Date().toISOString()}] Supabase search completed in ${searchTime}ms`)

    if (error) {
      console.error(`[${new Date().toISOString()}] Supabase error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[${new Date().toISOString()}] Found ${matches?.length || 0} documents from Supabase`)

    // 3. Формирование контекста из найденных документов
    const context = (matches || []).map((doc: any) => doc.content).join('\n---\n')
    console.log(`[${new Date().toISOString()}] Final context formed from ${matches?.length || 0} documents, total length: ${context.length}`)

    // 4. Сформировать промпт для LLM
    let contextText = context
    if (contextText.length > 3000) {
      console.log(`[${new Date().toISOString()}] Context too long (${contextText.length}), truncating to 3000 chars`)
      contextText = contextText.substring(0, 3000) + '...'
    }

    const prompt = `Ты — экспертный ассистент. Основываясь ИСКЛЮЧИТЕЛЬНО на предоставленном ниже контексте, дай четкий и лаконичный ответ на вопрос пользователя. Если в контексте нет информации для ответа, прямо скажи: "Я не нашел информации по вашему вопросу в своей базе знаний". Не придумывай ничего от себя.\n\nКонтекст:\n---\n${contextText}\n---\n\nВопрос: ${query}`
    console.log(`[${new Date().toISOString()}] Prompt created, length: ${prompt.length}`)

    // 5. Получить ответ от Hugging Face API
    console.log(`[${new Date().toISOString()}] Starting Hugging Face API request`)
    const hfStart = Date.now()

    const hfResponse = await fetch('https://api-inference.huggingface.co/models/gpt2-medium', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 512,
          temperature: 0.2,
          do_sample: true,
          return_full_text: false
        },
        options: {
          wait_for_model: true
        }
      })
    })

    if (!hfResponse.ok) {
      console.error(`[${new Date().toISOString()}] Hugging Face API error:`, hfResponse.status, hfResponse.statusText)
      return NextResponse.json({ error: 'Ошибка Hugging Face API' }, { status: 500 })
    }

    const hfData = await hfResponse.json()
    const hfTime = Date.now() - hfStart
    console.log(`[${new Date().toISOString()}] Hugging Face API request completed in ${hfTime}ms`)

    let answer = ''
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      answer = hfData[0].generated_text
    } else if (hfData.generated_text) {
      answer = hfData.generated_text
    }

    console.log(`[${new Date().toISOString()}] Extracted answer, length: ${answer.length}`)
    console.log(`[${new Date().toISOString()}] Answer preview: ${answer.substring(0, 100)}`)

    if (!answer.trim()) {
      console.error(`[${new Date().toISOString()}] Empty answer extracted from Hugging Face response`)
      return NextResponse.json({ error: 'Получен пустой ответ от Hugging Face API' }, { status: 500 })
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
