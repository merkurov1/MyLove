// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embedding-ai';
import { createClient } from '@supabase/supabase-js';
import { detectIntent, AGENT_PROMPTS, formatResponseWithSources, extractCitations } from '@/lib/agent-actions';
import { fastRerank } from '@/lib/reranking';
import { trackQuery, checkAnomalies, type QueryMetrics } from '@/lib/telemetry';

export const runtime = 'nodejs'; // Changed from edge to support OpenAI SDK

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Chat API request started`);
  console.log('[ENV CHECK] OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const { query, sourceId, conversationId } = await req.json();
    console.log(`[${new Date().toISOString()}] Chat API called with:`, {
      query: query?.substring(0, 100),
      queryLength: query?.length,
      sourceId,
      conversationId
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
    const searchStartTime = Date.now();
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

    // Используем гибридный поиск (keyword + vector) для лучшей точности
    let matchCount = 7;
    
    // Пробуем гибридный поиск сначала
    let { data: matches, error } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      keyword_weight: 0.3,
      semantic_weight: 0.7
    });
    
    // Fallback на обычный векторный если гибридный недоступен
    if (error && error.message?.includes('function hybrid_search')) {
      console.log('[SEARCH] Hybrid search not available, falling back to vector-only');
      ({ data: matches, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_count: matchCount
      }));
    }

    console.log(`[${new Date().toISOString()}] Search completed (hybrid)`);
    const topSimilarity = matches?.[0]?.similarity || 0;
    console.log('[RPC RESULT]', { 
      matchesCount: matches?.length || 0, 
      error: error?.message,
      topSimilarity,
      firstMatch: matches?.[0] ? { 
        id: matches[0].id, 
        similarity: matches[0].similarity,
        contentPreview: matches[0].content?.substring(0, 100) 
      } : null
    });
    
    // Fallback: если similarity < 0.35, загрузим больше чанков для лучшего контекста
    if (topSimilarity < 0.35 && matches && matches.length > 0) {
      console.log('[FALLBACK] Low similarity, expanding search to 12 chunks...');
      const { data: expandedMatches } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_count: 12
      });
      if (expandedMatches) {
        matches.length = 0;
        matches.push(...expandedMatches);
      }
    }

    if (error) {
      console.error('[SUPABASE RPC ERROR]', { error: error.message, full: error });
      return NextResponse.json({ error: error.message, supabase: true }, { status: 500 });
    }

    // RERANKING: Используем LLM для переранжирования результатов ТОЛЬКО для сложных случаев
    // Экономия бюджета: только если similarity < 0.5 (неуверенный поиск)
    const shouldRerank = matches && matches.length > 0 && 
                         intent.action === 'qa' && 
                         topSimilarity < 0.5;  // Только для сложных запросов
    
    if (shouldRerank) {
      console.log('[RERANKING] Low similarity detected, applying fast rerank...');
      try {
        const reranked = await fastRerank(query, matches, 7);
        if (reranked && reranked.length > 0) {
          matches = reranked;
          console.log('[RERANKING] Success. New top similarity:', reranked[0].final_score.toFixed(3));
        }
      } catch (rerankError: any) {
        console.error('[RERANKING] Failed, using original results:', rerankError.message);
      }
    }

    let contextText = '';
    let filteredMatches = matches || [];
    
    // Специальная обработка для analyze/summarize ALL documents
    if ((intent.action === 'analyze' || intent.action === 'compare') && intent.target === 'all') {
      console.log('[AGENT] Loading ALL documents for multi-document analysis...');
      
      // Получаем все документы
      const { data: allDocs } = await supabase
        .from('documents')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(10); // Ограничиваем 10 документами
      
      if (allDocs && allDocs.length > 0) {
        console.log('[AGENT] Found documents:', allDocs.length);
        
        // Загружаем по 3 чанка от каждого документа (для обзора)
        const allChunks = [];
        for (const doc of allDocs) {
          const { data: chunks } = await supabase
            .from('document_chunks')
            .select('content, chunk_index')
            .eq('document_id', doc.id)
            .order('chunk_index', { ascending: true })
            .limit(3);
          
          if (chunks && chunks.length > 0) {
            allChunks.push(`\n\n=== ${doc.title} (${doc.created_at.substring(0, 10)}) ===\n${chunks.map(c => c.content).join('\n')}`);
          }
        }
        
        contextText = allChunks.join('\n\n---\n');
        console.log('[AGENT] Loaded multi-document context:', { 
          documents: allDocs.length,
          totalLength: contextText.length 
        });
      }
    }
    // Специальная обработка для analyze/summarize LATEST document
    else if ((intent.action === 'analyze' || intent.action === 'summarize') && intent.target === 'latest') {
      console.log('[AGENT] Loading latest document...');
      
      // Получаем последний документ
      const { data: latestDoc } = await supabase
        .from('documents')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestDoc) {
        console.log('[AGENT] Latest document:', { id: latestDoc.id, title: latestDoc.title });
        
        // Для summarize берем первые 10 чанков (~10k tokens), для analyze - все
        const chunkLimit = intent.action === 'summarize' ? 10 : undefined;
        const query = supabase
          .from('document_chunks')
          .select('content, chunk_index')
          .eq('document_id', latestDoc.id)
          .order('chunk_index', { ascending: true });
        
        if (chunkLimit) {
          query.limit(chunkLimit);
        }
        
        const { data: chunks } = await query;
        
        if (chunks && chunks.length > 0) {
          // Добавляем метаданные о документе в начало
          const docMetadata = `[ДОКУМЕНТ: "${latestDoc.title}", создан: ${latestDoc.created_at.substring(0, 10)}]\n\n`;
          contextText = docMetadata + chunks.map(c => c.content).join('\n\n');
          console.log('[AGENT] Loaded document:', { 
            chunks: chunks.length,
            limited: !!chunkLimit,
            totalLength: contextText.length 
          });
        }
      }
    } else {
      // Обычный векторный поиск
      if (sourceId) {
        filteredMatches = filteredMatches.filter((doc: any) => doc.source_id === sourceId);
      }
      
      // Получаем названия документов для контекста (если есть document_id)
      const chunksWithDocs = [];
      for (const match of filteredMatches) {
        if (match.document_id) {
          const { data: doc } = await supabase
            .from('documents')
            .select('title, created_at')
            .eq('id', match.document_id)
            .single();
          
          if (doc) {
            chunksWithDocs.push(`[Из: "${doc.title}"]\n${match.content}`);
          } else {
            chunksWithDocs.push(match.content);
          }
        } else {
          chunksWithDocs.push(match.content);
        }
      }
      
      // Увеличили лимит с 3000 до 8000 для лучших ответов
      contextText = chunksWithDocs.join('\n\n---\n\n').substring(0, 8000);
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
    const promptKey = (intent.action === 'analyze' || intent.action === 'compare') && intent.target === 'all' 
      ? 'multi_analyze' 
      : intent.action;
    const systemPrompt = AGENT_PROMPTS[promptKey as keyof typeof AGENT_PROMPTS];
    console.log('[AGENT] Using system prompt for:', promptKey);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Умнее чем 3.5, дешевле чем GPT-4
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Контекст:\n${contextText}\n\nВопрос: ${query}` }
        ],
        temperature: 0.7,
        max_tokens: 1000 // Увеличили для более полных ответов
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
    
    // Сохраняем диалог в базу
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
      // Создаем новую conversation
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ 
          title: query.substring(0, 100),
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      currentConversationId = newConv?.id;
    }
    
    // Сохраняем сообщения
    if (currentConversationId) {
      const { error: msgError } = await supabase.from('messages').insert([
        {
          conversation_id: currentConversationId,
          role: 'user',
          content: query,
          created_at: new Date().toISOString()
        },
        {
          conversation_id: currentConversationId,
          role: 'assistant',
          content: formattedReply,
          metadata: { sources: formattedReply.includes('━━━━━') ? 'included' : 'none' },
          created_at: new Date().toISOString()
        }
      ]);
      
      if (msgError) {
        console.error('[CONVERSATION] Failed to save messages:', msgError);
      } else {
        console.log('[CONVERSATION] Messages saved successfully');
      }
      
      // Обновляем updated_at в conversations
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversationId);
      
      if (updateError) {
        console.error('[CONVERSATION] Failed to update timestamp:', updateError);
      }
      
      console.log('[CONVERSATION] Saved to DB:', currentConversationId);
    }
    
    // Track metrics
    const totalLatency = Date.now() - startTime;
    const searchLatency = Date.now() - searchStartTime;
    
    const metrics: QueryMetrics = {
      timestamp: new Date().toISOString(),
      query,
      query_length: query.length,
      intent_action: intent.action,
      intent_confidence: intent.confidence,
      search_type: 'hybrid',
      results_count: filteredMatches?.length || 0,
      top_similarity: filteredMatches?.[0]?.similarity || 0,
      reranking_applied: intent.action === 'qa',
      search_latency_ms: searchLatency,
      llm_latency_ms: totalLatency - searchLatency,
      total_latency_ms: totalLatency,
      context_length: contextText.length,
      sources_count: sources.length,
      model_used: 'gpt-4o-mini',
      tokens_estimated: Math.ceil((contextText.length + query.length) / 4),
      has_answer: !!answer && answer.length > 10
    };
    
    trackQuery(metrics);
    checkAnomalies(metrics);
    
    return NextResponse.json({ 
      reply: formattedReply,
      sources,
      intent: intent.action,
      conversationId: currentConversationId
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
