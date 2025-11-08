// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embedding-ai';
import { createClient } from '@supabase/supabase-js';
import { detectIntent, AGENT_PROMPTS, formatResponseWithSources, extractCitations } from '@/lib/agent-actions';

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

    // Определяем намерение пользователя
    const intent = detectIntent(query);
    console.log(`[${new Date().toISOString()}] Detected intent:`, intent);

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

    console.log(`[${new Date().toISOString()}] RPC match_documents called`);
    console.log('[RPC RESULT]', { 
      matchesCount: matches?.length || 0, 
      error: error?.message,
      firstMatch: matches?.[0] ? { 
        id: matches[0].id, 
        similarity: matches[0].similarity,
        contentPreview: matches[0].content?.substring(0, 100) 
      } : null
    });

    if (error) {
      console.error('[SUPABASE RPC ERROR]', { error: error.message, full: error });
      return NextResponse.json({ error: error.message, supabase: true }, { status: 500 });
    }

    let contextText = '';
    let filteredMatches = matches || [];
    
    // Специальная обработка для analyze/summarize latest document
    if ((intent.action === 'analyze' || intent.action === 'summarize') && intent.target === 'latest') {
      console.log('[AGENT] Loading full latest document...');
      
      // Получаем последний документ
      const { data: latestDoc } = await supabase
        .from('documents')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestDoc) {
        console.log('[AGENT] Latest document:', { id: latestDoc.id, title: latestDoc.title });
        
        // Загружаем ВСЕ чанки этого документа
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content, chunk_index')
          .eq('document_id', latestDoc.id)
          .order('chunk_index', { ascending: true });
        
        if (chunks && chunks.length > 0) {
          contextText = chunks.map(c => c.content).join('\n\n');
          console.log('[AGENT] Loaded full document:', { 
            chunks: chunks.length, 
            totalLength: contextText.length 
          });
        }
      }
    } else {
      // Обычный векторный поиск
      if (sourceId) {
        filteredMatches = filteredMatches.filter((doc: any) => doc.source_id === sourceId);
      }
      contextText = filteredMatches.map((doc: any) => doc.content).join('\n---\n').substring(0, 3000);
    }
    
    console.log('[CONTEXT]', { 
      intent: intent.action,
      contextLength: contextText.length,
      contextPreview: contextText.substring(0, 200)
    });

    // 3. Сформировать промпт и получить ответ от OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key не настроен' }, { status: 500 });
    }

    // Выбираем промпт в зависимости от намерения
    const systemPrompt = AGENT_PROMPTS[intent.action];
    console.log('[AGENT] Using system prompt for:', intent.action);

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
    
    // Получаем информацию о документах для цитат
    let sources: any[] = [];
    if (filteredMatches && filteredMatches.length > 0) {
      const documentIds = Array.from(new Set(filteredMatches.map((m: any) => m.document_id).filter(Boolean)));
      
      if (documentIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, title')
          .in('id', documentIds);
        
        const docMap = new Map(docs?.map((d: any) => [d.id, d.title]) || []);
        sources = extractCitations(filteredMatches, docMap);
        
        console.log('[CITATIONS]', { sourcesCount: sources.length });
      }
    }
    
    // Форматируем ответ с цитатами
    const formattedReply = formatResponseWithSources(answer, sources);
    
    // Сохраняем разговор (пока без conversationId, добавим позже)
    // TODO: Implement conversation persistence
    
    return NextResponse.json({ 
      reply: formattedReply,
      sources,
      intent: intent.action
    });

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
