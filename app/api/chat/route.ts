
import { NextRequest, NextResponse } from 'next/server'
import { getEmbedding, EmbeddingProvider } from '@/lib/embedding'

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] Chat API request started`)

  try {
  const { query, sourceId, embeddingProvider } = await req.json()
    console.log(`[${new Date().toISOString()}] Chat API called with:`, {
      query: query?.substring(0, 100),
      queryLength: query?.length
    })

    if (!query || typeof query !== 'string') {
      console.log(`[${new Date().toISOString()}] Invalid query provided`)
      return NextResponse.json({ error: 'Нет запроса' }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error(`[${new Date().toISOString()}] NEXT_PUBLIC_SUPABASE_URL not found`)
      return NextResponse.json({ error: 'Supabase не настроен' }, { status: 500 })
    }

    console.log(`[${new Date().toISOString()}] Starting embedding request...`)

    // 1. Получить embedding для запроса через выбранного провайдера
    const embeddingStart = Date.now()
    // Определяем провайдера: из тела запроса, ENV или по умолчанию
    let provider: EmbeddingProvider = 'voyage';
    if (embeddingProvider && ['voyage','huggingface','fireworks','openai','cohere'].includes(embeddingProvider)) {
      provider = embeddingProvider;
    } else if (process.env.EMBEDDING_PROVIDER && ['voyage','huggingface','fireworks','openai','cohere'].includes(process.env.EMBEDDING_PROVIDER)) {
      provider = process.env.EMBEDDING_PROVIDER as EmbeddingProvider;
    }
    const queryEmbedding = await getEmbedding(query, provider)

    // 2. Найти релевантные документы через Supabase функцию (через API)
        // (Здесь используем серверный supabase client, если нужно)
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: matches, error } = await supabase.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_count: 5
        })
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        let filteredMatches = matches || []
        if (sourceId) {
          filteredMatches = filteredMatches.filter((doc: any) => doc.source_id === sourceId)
        }
        const context = filteredMatches.map((doc: any) => doc.content).join('\n---\n')
        let contextText = context
        if (contextText.length > 3000) {
          contextText = contextText.substring(0, 3000) + '...'
        }

        // 3. Формируем промпт для Mistral-7B-Instruct
        const finalPrompt = `[INST] Ты — экспертный ассистент. Используй только следующий контекст для ответа. Отвечай кратко и по делу. Если в контексте нет информации для ответа, скажи: "Я не нашел информации по вашему вопросу в своей базе знаний".\n\nКонтекст:\n${contextText}\n---\nВопрос: ${query} [/INST]`

        // 4. Вызов Hugging Face Inference API (Mistral)
        const response = await fetch(
          'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
          {
            headers: {
              Authorization: `Bearer ${process.env.HF_API_KEY}`,
              'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({ inputs: finalPrompt, parameters: { max_new_tokens: 512 } }),
          }
        )
        const result = await response.json()
        if (!Array.isArray(result) || !result[0]?.generated_text) {
          return NextResponse.json({ error: 'Ошибка генерации ответа Hugging Face' }, { status: 500 })
        }
        const answerRaw = result[0].generated_text
        // Извлекаем только ответ после [/INST]
        const answer = answerRaw.split('[/INST]')[1]?.trim() || answerRaw.trim()
        if (!answer) {
          return NextResponse.json({ error: 'Пустой ответ от модели' }, { status: 500 })
        }
        return NextResponse.json({ reply: answer })
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Ошибка генерации ответа' }, { status: 500 })
      }
    }

