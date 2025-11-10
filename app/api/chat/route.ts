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

    // 1. Query expansion для улучшения поиска
    let expandedQuery = query;
    const lowerQuery = query.toLowerCase();
    
    // Если запрос о "Новой Газете" + "колонки" - расширяем контекст
    // Проверяем разные падежи: новая/новой/новую газета/газете/газету
    const mentionsNovajaGazeta = 
      lowerQuery.includes('новой газет') ||  // родительный: из Новой Газеты
      lowerQuery.includes('новая газет') ||   // именительный: Новая Газета
      lowerQuery.includes('новую газет') ||   // винительный: в Новую Газету
      lowerQuery.includes('нов. газет') ||    // сокращение: Нов. Газета
      lowerQuery.includes('novayagazeta') ||  // латиницей в URL
      lowerQuery.includes('novaya gazeta');
    
    const mentionsSubstack = 
      lowerQuery.includes('substack') ||
      lowerQuery.includes('рассылк') ||
      lowerQuery.includes('newsletter') ||
      lowerQuery.includes('блог');
    
    const mentionsCV = 
      lowerQuery.includes('cv') ||
      lowerQuery.includes('резюме') ||
      lowerQuery.includes('карьер') ||
      lowerQuery.includes('опыт работ') ||
      lowerQuery.includes('биограф');
    
    const mentionsColumns = 
      lowerQuery.includes('колонк') ||
      lowerQuery.includes('статьях') ||
      lowerQuery.includes('публикац');
      
    const mentionsProfile = 
      lowerQuery.includes('профайл') ||
      lowerQuery.includes('психолингв') ||
      lowerQuery.includes('анализ автор');
    
    // Query expansion в зависимости от источника
    if (mentionsNovajaGazeta && (mentionsColumns || mentionsProfile)) {
      expandedQuery = query + ' Новая Газета колонка журналистика публикация медиа';
      console.log('[QUERY EXPANSION] Expanded for Novaya Gazeta columns:', expandedQuery);
    } else if (mentionsSubstack) {
      expandedQuery = query + ' Substack рассылка блог личные размышления';
      console.log('[QUERY EXPANSION] Expanded for Substack:', expandedQuery);
    } else if (mentionsCV) {
      expandedQuery = query + ' резюме опыт работы карьера образование навыки';
      console.log('[QUERY EXPANSION] Expanded for CV:', expandedQuery);
    }

    // 2. Получить embedding для расширенного запроса через Vercel AI SDK
    const searchStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] Generating query embedding with OpenAI...`);
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(expandedQuery);
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

    // 3. Найти релевантные документы через Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Используем гибридный поиск (keyword + vector) для лучшей точности
    let matchCount = 7;
    
    // Увеличиваем match_count для запросов типа "все" или "find all"
    if (lowerQuery.includes('все') || lowerQuery.includes('список') || 
        lowerQuery.includes('find all') || lowerQuery.includes('all')) {
      matchCount = 15; // Увеличиваем для поиска большего количества результатов
      console.log('[SEARCH] "All/find all" query detected, increasing match_count to', matchCount);
    }
    
    // АДАПТИВНЫЕ ВЕСА: в зависимости от типа запроса и длины
    let keyword_weight = 0.3; // по умолчанию
    let semantic_weight = 0.7;
    
    // Короткие запросы (< 20 символов) — больше keyword matching
    if (query.length < 20) {
      keyword_weight = 0.6;
      semantic_weight = 0.4;
      console.log('[HYBRID] Short query detected, using keyword_weight=0.6');
    }
    // Упоминание конкретных источников — больше keyword для точности
    else if (mentionsNovajaGazeta || mentionsSubstack || mentionsCV) {
      keyword_weight = 0.5;
      semantic_weight = 0.5;
      console.log('[HYBRID] Specific source mentioned, using keyword_weight=0.5');
    }
    // Аналитические запросы — больше semantic для понимания контекста
    else if (intent.action === 'analyze' || intent.action === 'compare') {
      keyword_weight = 0.2;
      semantic_weight = 0.8;
      console.log('[HYBRID] Analytical query, using semantic_weight=0.8');
    }
    
    // Для гибридного поиска используем ОБА запроса:
    // - query (original) для keyword matching (точные совпадения "Новая Газета")
    // - expandedQuery embedding для semantic matching (расширенный контекст)
    let { data: matches, error } = await supabase.rpc('hybrid_search', {
      query_text: query,  // Оригинал для keyword matching
      query_embedding: queryEmbedding,  // Расширенный для semantic
      match_count: matchCount,
      keyword_weight,
      semantic_weight
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

    // DEDUPLICATION: Группируем по document_id, берём лучший чанк из каждого документа
    // Это особенно важно для multi_analyze, чтобы не было дублей
    if (matches && matches.length > 0) {
      const docGroups = new Map<string, any[]>();
      
      for (const match of matches) {
        const docId = match.document_id;
        if (!docId) continue;
        
        if (!docGroups.has(docId)) {
          docGroups.set(docId, []);
        }
        docGroups.get(docId)!.push(match);
      }
      
      // Из каждой группы берём чанк с максимальным similarity/final_score
      const deduplicated = Array.from(docGroups.values()).map(group => {
        return group.reduce((best, current) => {
          const bestScore = best.final_score ?? best.similarity;
          const currentScore = current.final_score ?? current.similarity;
          return currentScore > bestScore ? current : best;
        });
      });
      
      // Сортируем по score и ограничиваем топ-7
      matches = deduplicated
        .sort((a, b) => {
          const scoreA = a.final_score ?? a.similarity;
          const scoreB = b.final_score ?? b.similarity;
          return scoreB - scoreA;
        })
        .slice(0, 7);
      
      console.log(`[DEDUPLICATION] Reduced from ${docGroups.size} groups to ${matches.length} unique documents`);
    }

    let contextText = '';
    let filteredMatches = matches || [];
    
    // ФИЛЬТРАЦИЯ: Если запрос о конкретном источнике, фильтруем результаты по source_url
    const needsFiltering = mentionsNovajaGazeta || mentionsSubstack || mentionsCV;
    
    if (needsFiltering && filteredMatches.length > 0) {
      const filterType = mentionsNovajaGazeta ? 'Novaya Gazeta' : 
                         mentionsSubstack ? 'Substack' : 'CV';
      console.log(`[FILTER] Query mentions ${filterType}, filtering by source_url...`);
      const beforeCount = filteredMatches.length;
      
      // Получаем source_url для каждого чанка через document_id
      const documentIds = Array.from(new Set(filteredMatches.map((m: any) => m.document_id).filter(Boolean)));
      if (documentIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, source_url, title')
          .in('id', documentIds);
        
        const docMap = new Map(docs?.map((d: any) => [d.id, { url: d.source_url, title: d.title }]) || []);
        
        // Фильтруем по соответствующему источнику
        filteredMatches = filteredMatches.filter((m: any) => {
          const doc = docMap.get(m.document_id);
          if (!doc) return false;
          
          if (mentionsNovajaGazeta) {
            return doc.url && doc.url.includes('novayagazeta');
          } else if (mentionsSubstack) {
            return doc.url && doc.url.includes('substack');
          } else if (mentionsCV) {
            return doc.title && (doc.title.toLowerCase().includes('cv') || 
                                 doc.title.toLowerCase().includes('резюме'));
          }
          return true;
        });
        
        console.log(`[FILTER] Filtered from ${beforeCount} to ${filteredMatches.length} chunks (${filterType} only)`);
      }
    }
    
    // Специальная обработка для analyze/summarize ALL documents
    if ((intent.action === 'analyze' || intent.action === 'compare') && intent.target === 'all') {
      console.log('[AGENT] Loading ALL documents for multi-document analysis...');
      
      // Получаем все или отфильтрованные документы
      let docsQuery = supabase
        .from('documents')
        .select('id, title, created_at, source_url')
        .order('created_at', { ascending: false });
      
      // Фильтруем по источнику если указан
      if (mentionsNovajaGazeta) {
        console.log('[AGENT] Filtering documents by Novaya Gazeta source...');
        docsQuery = docsQuery.ilike('source_url', '%novayagazeta%');
      } else if (mentionsSubstack) {
        console.log('[AGENT] Filtering documents by Substack source...');
        docsQuery = docsQuery.ilike('source_url', '%substack%');
      } else if (mentionsCV) {
        console.log('[AGENT] Filtering documents by CV/Resume...');
        docsQuery = docsQuery.or('title.ilike.%cv%,title.ilike.%резюме%');
      }
      
      docsQuery = docsQuery.limit(10); // Ограничиваем 10 документами
      
      const { data: allDocs } = await docsQuery;
      
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

    // Настройки генерации в зависимости от типа задачи
    // Аналитика требует больше токенов и меньше креативности
    const isAnalytical = ['analyze', 'multi_analyze', 'compare'].includes(intent.action);
    const temperature = isAnalytical ? 0.4 : 0.6;  // Аналитика: точнее, QA: чуть свободнее
    
    // CONTEXT WINDOW MANAGEMENT: динамически рассчитываем max_tokens
    // gpt-4o-mini имеет context window 128k tokens
    const estimatedContextTokens = Math.ceil(contextText.length / 4); // ~4 chars per token
    const estimatedPromptTokens = Math.ceil(systemPrompt.length / 4);
    const estimatedQueryTokens = Math.ceil(query.length / 4);
    const usedTokens = estimatedContextTokens + estimatedPromptTokens + estimatedQueryTokens + 500; // +500 буфер
    
    const maxContextWindow = 128000; // gpt-4o-mini context window
    
    // CRITICAL: Если контекст слишком большой, обрезаем его
    if (usedTokens > maxContextWindow * 0.9) { // 90% от лимита
      const maxContextLength = Math.floor((maxContextWindow * 0.8 - estimatedPromptTokens - estimatedQueryTokens - 500) * 4);
      contextText = contextText.substring(0, maxContextLength);
      console.log('[CONTEXT TRUNCATED]', { 
        originalLength: contextText.length, 
        truncatedTo: maxContextLength,
        estimatedTokens: Math.ceil(contextText.length / 4)
      });
    }
    
    // Пересчитываем токены после возможной обрезки
    const finalEstimatedContextTokens = Math.ceil(contextText.length / 4);
    const finalUsedTokens = finalEstimatedContextTokens + estimatedPromptTokens + estimatedQueryTokens + 500;
    const availableTokens = maxContextWindow - finalUsedTokens;
    
    // Базовые лимиты по типу задачи
    const baseMaxTokens = isAnalytical ? 3000 : (intent.action === 'summarize' ? 800 : 1500);
    // Но не больше доступного в context window
    const maxTokens = Math.min(baseMaxTokens, Math.max(500, availableTokens));
    
    // GPT-4o-mini для всех задач (экономия бюджета, достаточное качество)
    // gpt-4o только в исключительных случаях
    const modelName = 'gpt-4o-mini';
    
    console.log('[GENERATION PARAMS]', { 
      promptKey, 
      model: modelName,
      temperature, 
      maxTokens,
      contextTokens: estimatedContextTokens,
      availableTokens 
    });

    // PROMPT CACHING: добавляем system message с cache_control для экономии
    // OpenAI автоматически кэширует промпты больше 1024 токенов на 5 минут
    const messages: any[] = [
      { 
        role: 'system', 
        content: systemPrompt
      },
      { 
        role: 'user', 
        content: `Контекст:\n${contextText}\n\nВопрос: ${query}` 
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens
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
