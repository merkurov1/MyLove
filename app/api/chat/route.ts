import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Используем публичный ключ, а не service_role
)

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Нет запроса' }, { status: 400 })
    }

    // 1. Получить embedding для запроса
    const embeddingRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: query,
        model: 'text-embedding-ada-002',
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    const queryEmbedding = embeddingRes.data.data[0].embedding

    // 2. Найти релевантные документы через Supabase функцию
    const { data: matches, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 7
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const context = (matches || []).map((d: any) => d.content).join('\n---\n')

    // 3. Сформировать промпт для LLM
    const prompt = `Ты — экспертный ассистент. Основываясь ИСКЛЮЧИТЕЛЬНО на предоставленном ниже контексте, дай четкий и лаконичный ответ на вопрос пользователя. Если в контексте нет информации для ответа, прямо скажи: "Я не нашел информации по вашему вопросу в своей базе знаний". Не придумывай ничего от себя.\n\nКонтекст:\n---\n${context}\n---\n\nВопрос: ${query}`

    // 4. Получить ответ от OpenAI Chat API
    const chatRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Ты — экспертный ассистент, отвечай строго по контексту.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.2
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    const answer = chatRes.data.choices[0].message.content.trim()
    return NextResponse.json({ answer })
  } catch (err: any) {
    return NextResponse.json({ error: 'Ошибка генерации ответа' }, { status: 500 })
  }
}
