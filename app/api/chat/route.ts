// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embedding';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge'; // Рекомендуется для Vercel для лучшей производительности

export async function POST(req: NextRequest) {
  console.log(`[${new Date().toISOString()}] Chat API request started`);
  console.log('[ENV CHECK] HF_API_KEY:', !!process.env.HF_API_KEY);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const { query, sourceId } = await req.json();
    console.log(`[${new Date().toISOString()}] Chat API called with:`, {
      query: query?.substring(0, 100),
      queryLength: query?.length
    });

    if (!query || typeof query !== 'string') {
      console.log(`[${new Date().toISOString()}] Invalid query provided`);
      return NextResponse.json({ error: 'Нет запроса' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(`[${new Date().toISOString()}] Supabase config missing`);
      return NextResponse.json({ error: 'Supabase не настроен' }, { status: 500 });
    }

    // 1. Получить embedding для запроса
    console.log(`[${new Date().toISOString()}] Starting embedding request...`);
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (embedErr: any) {
      console.error('[EMBEDDING ERROR]', {
        error: embedErr?.message,
        stack: embedErr?.stack
      });
      return NextResponse.json({
        error: 'Ошибка при создании embedding',
        message: embedErr?.message
      }, { status: 500 });
    }

    // 2. Найти релевантные документы через Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: matches, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5
    });

    if (error) {
      console.error('[SUPABASE RPC ERROR]', { error: error.message, full: error });
      return NextResponse.json({ error: error.message, supabase: true }, { status: 500 });
    }

    let filteredMatches = matches || [];
    if (sourceId) {
      filteredMatches = filteredMatches.filter((doc: any) => doc.source_id === sourceId);
    }
    const contextText = filteredMatches.map((doc: any) => doc.content).join('\n---\n').substring(0, 3000);

    // 3. Сформировать промпт и получить ответ от LLM
    const finalPrompt = `[INST] Ты — экспертный ассистент. Используй только следующий контекст для ответа. Отвечай кратко и по делу. Если в контексте нет информации для ответа, скажи: "Я не нашел информации по вашему вопросу в своей базе знаний".\n\nКонтекст:\n${contextText}\n---\nВопрос: ${query} [/INST]`;

    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({ inputs: finalPrompt, parameters: { max_new_tokens: 512 } })
      }
    );

    const result = await response.json();

    if (!response.ok || !Array.isArray(result) || !result[0]?.generated_text) {
      console.error('[HF GENERATION BAD RESULT]', { raw: result });
      return NextResponse.json({ error: 'Ошибка генерации ответа от Hugging Face', raw: result }, { status: 500 });
    }

    const answerRaw = result[0].generated_text;
    const answer = answerRaw.split('[/INST]')[1]?.trim() || answerRaw.trim();

    if (!answer) {
      console.error('[HF GENERATION EMPTY ANSWER]', { raw: answerRaw });
      return NextResponse.json({ error: 'Пустой ответ от модели', raw: answerRaw }, { status: 500 });
    }

    return NextResponse.json({ reply: answer });

  } catch (err: any) {
    console.error('[GLOBAL CATCH ERROR]', {
      message: err.message,
      stack: err.stack
    });
    return NextResponse.json({
      error: err?.message || 'Неизвестная ошибка сервера'
    }, { status: 500 });
  }
}
