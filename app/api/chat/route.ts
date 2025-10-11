
import { NextRequest, NextResponse } from 'next/server'
import { getEmbedding } from '@/lib/embedding'

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  // Логируем наличие всех ключей окружения для embedding и supabase
  console.log(`[${new Date().toISOString()}] Chat API request started`)
  console.log('[ENV CHECK] VOYAGE_API_KEY:', !!process.env.VOYAGE_API_KEY)
  console.log('[ENV CHECK] HF_API_KEY:', !!process.env.HF_API_KEY)
  console.log('[ENV CHECK] FIREWORKS_API_KEY:', !!process.env.FIREWORKS_API_KEY)
  console.log('[ENV CHECK] OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY)
  console.log('[ENV CHECK] COHERE_API_KEY:', !!process.env.COHERE_API_KEY)
  console.log('[ENV CHECK] GROQ_API_KEY:', !!process.env.GROQ_API_KEY)
  console.log('[ENV CHECK] MIXEDBREAD_API_KEY:', !!process.env.MIXEDBREAD_API_KEY)
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

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
    // Используем только Hugging Face или mock embeddings
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await getEmbedding(query)
    } catch (embedErr: any) {
      // Логируем ошибку embedding в консоль Vercel
      console.error('[EMBEDDING ERROR]', {
        error: embedErr?.message,
        stack: embedErr?.stack,
        env: {
          // provider removed
          VOYAGE_API_KEY: !!process.env.VOYAGE_API_KEY,
          HF_API_KEY: !!process.env.HF_API_KEY,
          FIREWORKS_API_KEY: !!process.env.FIREWORKS_API_KEY,
          OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
          COHERE_API_KEY: !!process.env.COHERE_API_KEY,
          GROQ_API_KEY: !!process.env.GROQ_API_KEY,
          MIXEDBREAD_API_KEY: !!process.env.MIXEDBREAD_API_KEY,
        }
      })
      return NextResponse.json({
        error: 'Ошибка embedding',
        message: embedErr?.message,
        stack: embedErr?.stack,
        env: {
          // provider removed
          VOYAGE_API_KEY: !!process.env.VOYAGE_API_KEY,
          HF_API_KEY: !!process.env.HF_API_KEY,
          FIREWORKS_API_KEY: !!process.env.FIREWORKS_API_KEY,
          OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
          COHERE_API_KEY: !!process.env.COHERE_API_KEY,
          GROQ_API_KEY: !!process.env.GROQ_API_KEY,
          MIXEDBREAD_API_KEY: !!process.env.MIXEDBREAD_API_KEY,
        }
      }, { status: 500 })
        return NextResponse.json({
          error: 'Ошибка embedding',
          message: embedErr?.message,
          stack: embedErr?.stack,
          debug: embedErr,
          env: {
            // provider removed
            VOYAGE_API_KEY: !!process.env.VOYAGE_API_KEY,
            HF_API_KEY: !!process.env.HF_API_KEY,
            FIREWORKS_API_KEY: !!process.env.FIREWORKS_API_KEY,
            OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
            COHERE_API_KEY: !!process.env.COHERE_API_KEY,
            GROQ_API_KEY: !!process.env.GROQ_API_KEY,
            MIXEDBREAD_API_KEY: !!process.env.MIXEDBREAD_API_KEY,
          }
        }, { status: 500 })
    }

    // 2. Найти релевантные документы через Supabase функцию (через API)
        // (Здесь используем серверный supabase client, если нужно)
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        let matches, error;
        try {
          const rpcResult = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_count: 5
          })
          matches = rpcResult.data;
          error = rpcResult.error;
        } catch (supabaseErr: any) {
          console.error('[SUPABASE ERROR]', {
            error: supabaseErr?.message,
            stack: supabaseErr?.stack,
            full: JSON.stringify(supabaseErr, Object.getOwnPropertyNames(supabaseErr)),
          });
          return NextResponse.json({ error: 'Supabase RPC error', message: supabaseErr?.message, stack: supabaseErr?.stack }, { status: 500 })
        }
        if (error) {
          console.error('[SUPABASE RPC ERROR]', { error: error.message, full: error });
          return NextResponse.json({ error: error.message, supabase: true }, { status: 500 })
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
        let result: any = null;
        try {
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
          result = await response.json()
        } catch (hfErr: any) {
          console.error('[HF GENERATION ERROR]', {
            error: hfErr?.message,
            stack: hfErr?.stack,
            full: JSON.stringify(hfErr, Object.getOwnPropertyNames(hfErr)),
          });
          return NextResponse.json({ error: 'Ошибка HuggingFace', message: hfErr?.message, stack: hfErr?.stack }, { status: 500 })
        }
        if (!Array.isArray(result) || !result[0]?.generated_text) {
          console.error('[HF GENERATION BAD RESULT]', { raw: result });
          return NextResponse.json({ error: 'Ошибка генерации ответа Hugging Face', raw: result }, { status: 500 })
        }
        const answerRaw = result[0].generated_text
        // Извлекаем только ответ после [/INST]
        const answer = answerRaw.split('[/INST]')[1]?.trim() || answerRaw.trim()
        if (!answer) {
          console.error('[HF GENERATION EMPTY ANSWER]', { raw: answerRaw });
          return NextResponse.json({ error: 'Пустой ответ от модели', raw: answerRaw }, { status: 500 })
        }
        return NextResponse.json({ reply: answer })
      } catch (err: any) {
        return NextResponse.json({
          error: err?.message || 'Ошибка генерации ответа',
          stack: err?.stack,
          full: JSON.stringify(err, Object.getOwnPropertyNames(err)),
        }, { status: 500 })
      }
    }

