// supabase/functions/generate/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0'

// Размещаем pipeline в глобальной области, чтобы модель загружалась только один раз.
const generator = await pipeline(
  'text-generation',
  'Xenova/gpt2'
)

serve(async (req) => {
  try {
    const { prompt, max_length = 512, temperature = 0.2 } = await req.json()

    // Генерируем текст
    const output = await generator(prompt, {
      max_length: max_length,
      temperature: temperature,
      do_sample: true,
      return_full_text: false,
      pad_token_id: generator.tokenizer.eos_token_id
    })

    // Извлекаем сгенерированный текст
    const generatedText = output[0].generated_text

    return new Response(
      JSON.stringify({ generated_text: generatedText }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})