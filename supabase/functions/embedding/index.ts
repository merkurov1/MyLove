// supabase/functions/embedding/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0'

// Размещаем pipeline в глобальной области, чтобы модель загружалась только один раз.
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
)

serve(async (req) => {
  try {
    const { text } = await req.json()

    // Генерируем эмбеддинг
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    })

    // Преобразуем данные в обычный массив
    const embedding = Array.from(output.data)

    return new Response(
      JSON.stringify({ embedding }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})