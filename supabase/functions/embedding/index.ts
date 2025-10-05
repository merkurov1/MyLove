// supabase/functions/embedding/index.ts
// @ts-expect-error Deno external import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-expect-error Deno external import
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0'


// Размещаем pipeline в глобальной области, чтобы модель загружалась только один раз.
let extractor: any
try {
  extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  )
} catch (err) {
  console.error('Failed to load pipeline:', err)
  throw err
}

serve(async (req: Request) => {
  try {
    const { text } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Генерируем эмбеддинг
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    })
    // Преобразуем данные в обычный массив
    const embedding = Array.from(output.data)
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      return new Response(JSON.stringify({ error: 'Embedding must be 384-dim vector' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({ embedding }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    // Deno sometimes throws non-Error objects
    const message = (e && typeof e === 'object' && 'message' in e) ? (e as any).message : String(e)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})