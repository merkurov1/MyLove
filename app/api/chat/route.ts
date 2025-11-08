// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embedding-ai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs'; // Changed from edge to support OpenAI SDK

export async function POST(req: NextRequest) {
  console.log(`[${new Date().toISOString()}] Chat API request started`);
  console.log('[ENV CHECK] OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const { query, sourceId } = await req.json();
    console.log(`[${new Date().toISOString()}] Chat API called with:`, {
      query: query?.substring(0, 100),
      queryLength: query?.length,
      sourceId
    });

    if (!query || typeof query !== 'string') {
      console.log(`[${new Date().toISOString()}] Invalid query provided`);
      return NextResponse.json({ error: 'Нет запроса' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${new Date().toISOString()}] Supabase config missing`);
      return NextResponse.json({ error: 'Supabase не настроен' }, { status: 500 });
    }

    // 1. Получить embedding для запроса через Vercel AI SDK
    console.log(`[${new Date().toISOString()}] Generating query embedding with OpenAI...`);
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(query);
      console.log(`[${new Date().toISOString()}] Query embedding generated (dimension: ${queryEmbedding.length})`);
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
      process.env.SUPABASE_SERVICE_ROLE_KEY
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

    // 3. Сформировать промпт и получить ответ от OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key не настроен' }, { status: 500 });
    }

    const systemPrompt = `Ты — экспертный ассистент. Используй только предоставленный контекст для ответа. Отвечай кратко и по делу на русском языке. Если в контексте нет информации для ответа, скажи: "Я не нашел информации по вашему вопросу в своей базе знаний".`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Контекст:\n${contextText}\n\nВопрос: ${query}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OPENAI API ERROR]', { status: response.status, error: errorData });
      return NextResponse.json({ 
        error: 'Ошибка генерации ответа от OpenAI', 
        details: errorData 
      }, { status: 500 });
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      console.error('[OPENAI EMPTY ANSWER]', { result });
      return NextResponse.json({ error: 'Пустой ответ от модели' }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Response generated successfully`);
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
