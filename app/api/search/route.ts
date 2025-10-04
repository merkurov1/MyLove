import { NextRequest, NextResponse } from 'next/server'
import { createEmbeddingProvider } from '@/lib/embeddingProviders'
import { supabase } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { query, topK = 5, model } = await request.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Нет поискового запроса' }, { status: 400 })
    }

    // Генерируем эмбеддинг для запроса с учетом выбранной модели
    const embeddingProvider = createEmbeddingProvider(model)
    const queryEmbedding = await embeddingProvider.generateEmbedding(query)

    // Поиск ближайших документов по вектору
    // В Supabase: embedding <-> ARRAY[...] ASC
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: topK
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ results: data })
  } catch (error) {
    return NextResponse.json({ error: 'Внутренняя ошибка поиска' }, { status: 500 })
  }
}
