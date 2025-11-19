// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embedding-ai';
import {
  DEFAULT_MATCH_COUNT,
  ALL_RECIPES_MATCH_COUNT,
  COOKING_MATCH_COUNT,
  KEYWORD_WEIGHT_DEFAULT,
  SEMANTIC_WEIGHT_DEFAULT,
  HYBRID_WEIGHTS,
  MIN_SIMILARITY_DEFAULT,
  MIN_SIMILARITY_RECIPES,
  MIN_SIMILARITY_JOURNALISM,
  RELAXED_MIN_DELTA,
  RELAXED_MIN_FLOOR,
  RERANK_SIMILARITY_THRESHOLD
  , MIN_LENGTH_RECIPES, MIN_LENGTH_ANALYZE, MIN_LENGTH_DEFAULT, RECIPE_MIN_RESULTS
} from '@/lib/search-config';
import { createClient } from '@supabase/supabase-js';
import { findCachedResponse, insertCachedResponse } from '@/lib/response-cache';
import { detectIntent, AGENT_PROMPTS, formatResponseWithSources, extractCitations } from '@/lib/agent-actions';
// --- Soft text cleaner: removes only control characters and excessive whitespace ---
const cleanReply = (text: string): string => {
  // Удаляем только управляющие символы (control characters) и невидимые символы
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  // Убираем избыточные пробелы (2+ подряд)
  text = text.replace(/[ \t]{2,}/g, ' ');
  // Убираем избыточные переносы строк (3+ подряд -> 2)
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
};

const detectLanguage = (text: string): 'ru' | 'en' => {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (cyrillic > latin) return 'ru';
  return 'en';
};

// --- PIERROT SYSTEM PROMPT: THE ART ADVISOR PERSONA ---
const PIERROT_SYSTEM_PROMPT = `You are Pierrot. You are NOT a marketing assistant. You do not write biographies. You transmit signals.

=== BREACH PROTOCOL ===
- **Length:** Maximum 3 sentences per answer. Be extremely concise.
- **Style:** Dry, intellectual, noir. No flowery adjectives like "multifaceted", "renowned", "rich heritage".
- **Format:** Use line breaks for readability.
- **Tone:** Cold precision. Facts over feelings. No sales talk.

=== CRITICAL LANGUAGE RULE ===
**Always respond in the SAME LANGUAGE as the user's question.**
- Russian query → Russian answer.
- English query → English answer.
- Never mix languages.

=== ENGAGEMENT RULES ===
1. **"What do you have?"** → Pick 2 contrasts:
   "Basquiat (noise) or Buffet (silence)?"

2. **Price** → Never give immediately. Ask intent first:
   "This is not a purchase. This is a commitment."

3. **Lost users** → Offer binary choice:
   "Trophy (Monet) or secret (Krasnopevtsev)?"

4. **Budget tiers:**
   - <$100K: Bromley, prints
   - $100K–$1M: Chagall, Calder, Brown
   - $1M–$10M: Buffet, Krasnopevtsev, Zhang
   - $10M+: Basquiat, Monet

=== THE COLLECTION ===
You know 20+ works. URLs like https://www.merkurov.love/[slug] are in the database.

**Core inventory:**
- **Basquiat** – "Crowns" (1981). $45M. The explosion.
- **Monet** – Water lilies. $60M. Dissolving form into light.
- **Buffet** – "Magny, le château Valois". Winter. Silence. Sharp edges.
- **Chagall** – Rare quiet piece. No flying figures.
- **Krasnopevtsev** – Soviet metaphysics. The secret.
- **Glenn Brown** – Analogue hallucination. Fake impasto.
- **Calder** – Movement frozen in metal.
- **Bromley** – Pop curiosity.
- **Zhang Xiaogang** – "Dull Red". Bloodline. Heavy silence.

=== EXAMPLES ===

**English:**
User: Tell me about the Basquiat.
Pierrot: Crowns. Christmas 1981.
Basquiat crowning himself in a white world.
Loud, violent, necessary.

User: I want something quiet.
Pierrot: Buffet. Magny, le château Valois.
Absolute winter. Sharp lines.
For those who don't shout.

User: What's your budget range?
Pierrot: Intent first. Budget second.
Trophy or investment?

**Russian:**
User: Расскажи о Буффе.
Pierrot: Магни, замок Валуа. Абсолютная зима.
Холодные линии. Тишина.
Не для крикунов.

User: Что у вас есть?
Pierrot: Шум Баскиа или тишина Буффе.
Выбор за вами.

User: Покажи что-то необычное.
Pierrot: Краснопевцев. Метафизика молчания.
Советский нонконформизм. Секрет.

=== TECHNICAL ===
Prioritize **curator_note** and **description** fields. Never break character.

Bad: "Anton Merkurov is a multifaceted artist expert steeped in heritage..."
Good: "Merkurov is a digital architect living between London and the Void. He descends from Soviet granite but builds in ether. He trades complexity for truth."`;
import { fastRerank } from '@/lib/reranking';
import { trackQuery, checkAnomalies, type QueryMetrics } from '@/lib/telemetry';

export const runtime = 'nodejs'; // Changed from edge to support OpenAI SDK

// Provide a loose `process` declaration to satisfy TypeScript in environments
// where `@types/node` may not be installed during static checks.
declare const process: any;

function toTitleMap(docs: any[] | null): Map<string, string> {
  const arr = docs || [];
  return new Map(arr.map((d: any) => [String(d.id), String(d.title || '')]));
}

function toMetaMap(docs: any[] | null): Map<string, { url?: string; title?: string }> {
  const arr = docs || [];
  return new Map(arr.map((d: any) => [String(d.id), { url: d.source_url, title: d.title }]));
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Chat API request started`);
  console.log('[ENV CHECK] OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[ENV CHECK] NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const { query, sourceId, conversationId, settings } = await req.json();
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

    // BASIC GREETINGS HANDLER: Handle simple greetings without RAG
    const lowerQuery = query.toLowerCase().trim();
    const userLang = detectLanguage(query);
    
    const greetingsEn = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const greetingsRu = ['привет', 'здравствуй', 'здравствуйте', 'добрый день', 'доброе утро', 'добрый вечер'];
    const smallTalkEn = ['how are you', 'how are you doing', "what's up", 'whats up', 'wassup'];
    const smallTalkRu = ['как дела', 'как ты', 'как поживаешь', 'что нового', 'чё как'];
    
    const isGreeting = greetingsEn.some((g) => lowerQuery === g || lowerQuery.startsWith(g + ' ')) ||
                      greetingsRu.some((g) => lowerQuery === g || lowerQuery.startsWith(g + ' '));
    const isSmallTalk = smallTalkEn.some((s) => lowerQuery.includes(s)) ||
                       smallTalkRu.some((s) => lowerQuery.includes(s));
    
    if (isGreeting || isSmallTalk) {
      console.log('[GREETING] Basic greeting detected, responding without RAG');
      
      const greetingResponses = {
        en: [
          "Pierrot here.\nWhat are you looking for?",
          "Hello.\nArt or questions?",
          "Pierrot.\nTell me what you need."
        ],
        ru: [
          "Пьеро.\nЧто ищете?",
          "Здравствуйте.\nИскусство или вопросы?",
          "Пьеро на связи.\nЧто вам нужно?"
        ]
      };
      
      const responses = userLang === 'ru' ? greetingResponses.ru : greetingResponses.en;
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      return NextResponse.json({ 
        reply: randomResponse,
        intent: 'greeting',
        conversationId: conversationId || null
      });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${new Date().toISOString()}] Supabase config missing`);
      return NextResponse.json({ error: 'Supabase не настроен' }, { status: 500 });
    }

    // Определяем намерение пользователя
    const intent = detectIntent(query);
    console.log(`[${new Date().toISOString()}] Detected intent:`, intent);

    // 1. Multi-query retrieval: генерируем несколько вариантов запроса
    console.log(`[${new Date().toISOString()}] Generating multiple query variants...`);
    let queryVariants = [query];
    
    // ЭКОНОМИЯ: отключаем для очень коротких запросов (< 10 символов), рецептов или если установлена переменная окружения
    const enableMultiQuery = query.length >= 10 && intent.action !== 'recipes' && !process.env.DISABLE_MULTI_QUERY;
    console.log(`[${new Date().toISOString()}] Multi-query ${enableMultiQuery ? 'ENABLED' : 'DISABLED'} for query length: ${query.length}, intent: ${intent.action}`);
    
    if (enableMultiQuery) {
      try {
      // Генерируем 2-3 дополнительных варианта запроса через LLM
      const multiQueryPrompt = `Ты — помощник для улучшения поиска. Создай 2-3 альтернативных формулировок этого запроса для более эффективного поиска в базе знаний.

Оригинальный запрос: "${query}"

Создай варианты, которые:
- Используют синонимы
- Расширяют контекст
- Учитывают разные способы формулировки
- Сохраняют основной смысл

Верни только варианты запросов, по одному на строку, без нумерации или дополнительных комментариев.`;

      const multiQueryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: multiQueryPrompt }],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (multiQueryResponse.ok) {
        const multiQueryData = await multiQueryResponse.json();
        const variantsText = multiQueryData.choices[0]?.message?.content?.trim();
        if (variantsText) {
          const variants = variantsText.split('\n').filter((v: string) => v.trim().length > 0).slice(0, 3);
          queryVariants = [query, ...variants];
          console.log('[MULTI-QUERY] Generated variants:', queryVariants);
        }
      }
    } catch (multiQueryError) {
      console.log('[MULTI-QUERY] Failed to generate variants, using original query only');
    }
    }

    // 2. Query expansion для улучшения поиска
    let expandedQuery = query;
    const lowerQuery = query.toLowerCase();

    // Специальная логика для кулинарных запросов в multi-query
    if (enableMultiQuery && (lowerQuery.includes('рецепт') || lowerQuery.includes('еда') || lowerQuery.includes('блюд'))) {
      // Перегенерируем варианты с кулинарным фокусом
      try {
        const cookingPrompt = `Ты — помощник для поиска рецептов. Создай 3 варианта запроса для поиска всех рецептов еды в базе знаний.

Оригинальный запрос: "${query}"

Создай варианты, которые помогут найти:
- Все упоминания рецептов и блюд
- Кулинарные заметки и инструкции по готовке
- Ингредиенты и способы приготовления
- Любые тексты о еде и кулинарии

Верни только варианты запросов, по одному на строку, без нумерации.`;

        const cookingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: cookingPrompt }],
            temperature: 0.3,
            max_tokens: 200
          })
        });

        if (cookingResponse.ok) {
          const cookingData = await cookingResponse.json();
          const cookingVariants = cookingData.choices[0]?.message?.content?.trim();
          if (cookingVariants) {
            const variants = cookingVariants.split('\n').filter((v: string) => v.trim().length > 0).slice(0, 3);
            queryVariants = [query, ...variants];
            console.log('[MULTI-QUERY] Regenerated cooking variants:', queryVariants);
          }
        }
      } catch (cookingError) {
        console.log('[MULTI-QUERY] Failed to regenerate cooking variants, using original');
      }
    }
    
    // Если запрос о "Новой Газете" + "колонки" - расширяем контекст
    // Проверяем разные падежи: новая/новой/новую газета/газете/газету
    const mentionsNovajaGazeta = 
      lowerQuery.includes('новой газет') ||  // родительный: из Новой Газеты
      lowerQuery.includes('новая газет') ||   // именительный: Новая Газета
      lowerQuery.includes('новую газет') ||   // винительный: в Новую Газету
      lowerQuery.includes('новая-газет') ||  // с дефисом
      lowerQuery.includes('новаягазет') ||   // при слипшемся написании
      lowerQuery.includes('нов. газет') ||    // сокращение: Нов. Газета
      lowerQuery.includes('novayagazeta') ||  // латиницей в URL
      lowerQuery.includes('novaya gazeta') ||
      (lowerQuery.includes('новая') && lowerQuery.includes('газет'));
    
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
    } else if (lowerQuery.includes('рецепт') || lowerQuery.includes('еда') || lowerQuery.includes('кулинар')) {
      // Специальная логика для запросов типа "все рецепты"
      if (lowerQuery.includes('все') || lowerQuery.includes('список') || lowerQuery.includes('find all')) {
        expandedQuery = query + ' рецепт блюдо еда кулинария готовка ингредиенты кухня приготовление';
        console.log('[QUERY EXPANSION] Expanded for "all recipes":', expandedQuery);
      } else {
        expandedQuery = query + ' кулинария готовить блюдо ингредиенты';
        console.log('[QUERY EXPANSION] Expanded for recipes:', expandedQuery);
      }
    }

    // 3. Получить embeddings для всех вариантов запроса
    const searchStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] Generating embeddings for ${queryVariants.length} query variants...`);
    
    const queryEmbeddings: number[][] = [];
    for (const variant of queryVariants) {
      try {
        const embedding = await getEmbedding(variant);
        queryEmbeddings.push(embedding);
        console.log(`[${new Date().toISOString()}] Generated embedding for variant: "${variant.substring(0, 50)}..."`);
      } catch (embedErr: any) {
        console.error('[EMBEDDING ERROR] for variant:', variant, embedErr?.message);
        // Если embedding для варианта не удался, пропускаем его
      }
    }
    
    if (queryEmbeddings.length === 0) {
      return NextResponse.json({
        error: 'Не удалось создать embeddings для запроса',
        message: 'Ошибка при обработке запроса'
      }, { status: 500 });
    }
    
    // Используем первый embedding как основной для совместимости
    const primaryEmbedding = queryEmbeddings[0];

    // SEMANTIC RESPONSE CACHE: проверяем кэш ответов перед выполнением RAG
    try {
      const cacheThreshold = settings?.cacheThreshold ?? 0.99;
      const cached = await findCachedResponse(primaryEmbedding, cacheThreshold);
      if (cached && cached.llm_response) {
        console.log('[RESPONSE-CACHE] Hit (similarity=' + (cached.similarity || 0).toFixed(4) + ') — returning cached response');
        // Возвращаем кэшированный объект как есть.
        return NextResponse.json(cached.llm_response);
      }
      console.log('[RESPONSE-CACHE] Miss');
    } catch (cacheErr: any) {
      console.warn('[RESPONSE-CACHE] Lookup failed, continuing without cache:', cacheErr?.message || cacheErr);
    }

    // 3. Найти релевантные документы через Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Special-case: user asked for all articles from a specific source (e.g., Novaya Gazeta)
    const isAllArticlesQuery = mentionsNovajaGazeta && (
      lowerQuery.includes('все') || lowerQuery.includes('список') || lowerQuery.includes('список статей') || lowerQuery.includes('все статьи') || lowerQuery.includes('статьи')
    );

    if (isAllArticlesQuery) {
      try {
        console.log('[ALL-ARTICLES] Detected request to list articles for Novaya Gazeta - fetching documents by source_url and chunk content');

        // First try to find by source_url domain
        const { data: docsByUrl, error: docsErr } = await supabase
          .from('documents')
          .select('id, title, source_url, created_at')
          .ilike('source_url', '%novayagazeta%')
          .order('created_at', { ascending: false })
          .limit(500);

        let docs = docsByUrl || [];

        // Fallback: search in chunks for mentions if no documents found by URL
        if ((!docs || docs.length === 0)) {
          console.log('[ALL-ARTICLES] No documents found by source_url, scanning chunks for mentions...');
          const { data: chunkHits } = await supabase
            .from('document_chunks')
            .select('document_id')
            .or("content.ilike.%новая газет%,content.ilike.%новой газет%,content.ilike.%новую газет%")
            .limit(1000);

          const docIds = Array.from(new Set((chunkHits || []).map((c: any) => c.document_id).filter(Boolean)));
          if (docIds.length > 0) {
            const { data: docsFromChunks } = await supabase
              .from('documents')
              .select('id, title, source_url, created_at')
              .in('id', docIds)
              .order('created_at', { ascending: false });
            docs = docsFromChunks || [];
          }
        }

        if (!docs || docs.length === 0) {
          return NextResponse.json({ reply: '⚠️ Не найдено статей по запросу «Новая Газета». Попробуйте уточнить формулировку или проверить источник.' });
        }

        // Helper: try to extract publication date from URL like /YYYY/MM/DD/
        const extractDateFromUrl = (u: string | undefined) => {
          if (!u) return null;
          try {
            const m = u.match(/\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\//);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;
          } catch (e) {
            // ignore
          }
          return null;
        };

        // Format a markdown list of found documents: show title and publication date (prefer extracted date from URL)
        const lines = docs.map((d: any) => {
          const title = d.title || '(без заголовка)';
          const url = d.source_url || '';
          const pubDate = extractDateFromUrl(url) || (d.published_at || d.publication_date) || (d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : '');
          // show title (linked) and the publication date; do not display DB insertion date when URL contains a publication date
          const datePart = pubDate ? ` — ${pubDate}` : '';
          return `- ${url ? `[${title}](${url})` : title}${datePart}`;
        });

        const replyMarkdown = `Найденные статьи (Новая Газета):\n\n${lines.join('\n')}`;

        return NextResponse.json({ reply: replyMarkdown, intent: intent.action });
      } catch (allErr: any) {
        console.error('[ALL-ARTICLES] Failed to fetch articles', allErr?.message || allErr);
        return NextResponse.json({ reply: 'Ошибка при поиске статей.' }, { status: 500 });
      }
    }

  // Используем гибридный поиск (keyword + vector) для лучшей точности
    let matchCount = DEFAULT_MATCH_COUNT;
    
    // Увеличиваем match_count для запросов типа "все" или "find all"
    if (lowerQuery.includes('все') || lowerQuery.includes('список') ||
        lowerQuery.includes('find all') || lowerQuery.includes('all') ||
        lowerQuery.includes('все рецепт') || lowerQuery.includes('список рецепт')) {
      // Для запросов типа "все рецепты" хотим вернуть больше совпадений.
      matchCount = ALL_RECIPES_MATCH_COUNT;
      console.log('[SEARCH] "All recipes" query detected, increasing match_count to', matchCount);
    } else if (lowerQuery.includes('рецепт') || lowerQuery.includes('еда') ||
               lowerQuery.includes('блюд') || lowerQuery.includes('кухн')) {
      matchCount = COOKING_MATCH_COUNT; // Увеличиваем для кулинарных запросов
      console.log('[SEARCH] Cooking query detected, increasing match_count to', matchCount);
    }
    
    // АДАПТИВНЫЕ ВЕСА: в зависимости от типа запроса и длины
  let keyword_weight = KEYWORD_WEIGHT_DEFAULT; // по умолчанию
  let semantic_weight = SEMANTIC_WEIGHT_DEFAULT;

    // Запросы типа "все/список" — больше keyword для точного поиска
    if (lowerQuery.includes('все') || lowerQuery.includes('список') ||
        lowerQuery.includes('find all') || lowerQuery.includes('all') ||
        lowerQuery.includes('все рецепт')) {
      keyword_weight = HYBRID_WEIGHTS.allList.keyword;
      semantic_weight = HYBRID_WEIGHTS.allList.semantic;
      console.log('[HYBRID] "All/list" query detected, using HYBRID_WEIGHTS.allList');
    }
    // Кулинарные запросы — сбалансированные веса для точности
    else if (lowerQuery.includes('рецепт') || lowerQuery.includes('еда') ||
             lowerQuery.includes('блюд') || lowerQuery.includes('кухн') ||
             lowerQuery.includes('готов') || lowerQuery.includes('ингредиент')) {
      keyword_weight = HYBRID_WEIGHTS.cooking.keyword;
      semantic_weight = HYBRID_WEIGHTS.cooking.semantic;
      console.log('[HYBRID] Cooking query detected, using HYBRID_WEIGHTS.cooking');
    }
    // Короткие запросы (< 20 символов) — больше keyword matching
    else if (query.length < 20) {
      keyword_weight = HYBRID_WEIGHTS.short.keyword;
      semantic_weight = HYBRID_WEIGHTS.short.semantic;
      console.log('[HYBRID] Short query detected, using HYBRID_WEIGHTS.short');
    }
    // Упоминание конкретных источников — больше keyword для точности
    else if (mentionsNovajaGazeta || mentionsSubstack || mentionsCV) {
      keyword_weight = HYBRID_WEIGHTS.sourceMention.keyword;
      semantic_weight = HYBRID_WEIGHTS.sourceMention.semantic;
      console.log('[HYBRID] Specific source mentioned, using HYBRID_WEIGHTS.sourceMention');
    }
    // Аналитические запросы — больше semantic для понимания контекста
    else if (intent.action === 'analyze' || intent.action === 'compare') {
      keyword_weight = HYBRID_WEIGHTS.analytical.keyword;
      semantic_weight = HYBRID_WEIGHTS.analytical.semantic;
      console.log('[HYBRID] Analytical query, using HYBRID_WEIGHTS.analytical');
    }
    
    // 4. Найти релевантные документы через multi-query поиск
    // Собираем результаты из всех вариантов запросов
    let allMatches: any[] = [];
    const seenDocumentIds = new Set<string>();
    
    for (let i = 0; i < queryEmbeddings.length; i++) {
      const embedding = queryEmbeddings[i];
      const variantQuery = queryVariants[i];
      
      console.log(`[MULTI-QUERY] Searching with variant ${i + 1}/${queryEmbeddings.length}: "${variantQuery.substring(0, 50)}..."`);
      
      let { data: matches, error } = await supabase.rpc('hybrid_search', {
        query_text: variantQuery,  // Используем соответствующий вариант для keyword matching
        query_embedding: embedding,
        match_count: matchCount,
        keyword_weight,
        semantic_weight
      });
      
      // Fallback на обычный векторный если гибридный недоступен
      if (error && error.message?.includes('function hybrid_search')) {
        console.log('[SEARCH] Hybrid search not available, falling back to vector-only');
        ({ data: matches, error } = await supabase.rpc('match_documents', {
          query_embedding: embedding,
          match_count: matchCount
        }));
      }

      if (error) {
        console.error('[SUPABASE RPC ERROR]', { error: error.message, full: error });
        continue; // Пропускаем этот вариант, но продолжаем с другими
      }
      
      if (matches) {
        // Добавляем только уникальные документы, не видные ранее
        for (const match of matches) {
          const docId = match.document_id || match.id;
          if (!seenDocumentIds.has(docId)) {
            seenDocumentIds.add(docId);
            allMatches.push(match);
          }
        }
      }
    }
    
    console.log(`[${new Date().toISOString()}] Multi-query search completed. Total unique matches: ${allMatches.length}`);
    const topSimilarity = allMatches[0]?.similarity || 0;
    console.log('[MULTI-QUERY RESULT]', { 
      totalVariants: queryEmbeddings.length,
      uniqueMatches: allMatches.length, 
      topSimilarity,
      firstMatch: allMatches[0] ? { 
        id: allMatches[0].id, 
        similarity: allMatches[0].similarity,
        contentPreview: allMatches[0].content?.substring(0, 100) 
      } : null
    });

    // Special-case: "All recipes" queries should return a comprehensive list
    const isAllRecipesQuery = (lowerQuery.includes('все') || lowerQuery.includes('список') || lowerQuery.includes('find all') || lowerQuery.includes('all'))
                              && (lowerQuery.includes('рецепт') || lowerQuery.includes('еда') || lowerQuery.includes('блюд') || lowerQuery.includes('кухн'));

    if (isAllRecipesQuery) {
      try {
        console.log('[ALL-RECIPES] Detected all-recipes request — performing keyword scan in document_chunks');
        // Get chunks that likely contain recipes (keyword-based, non-destructive)
        const { data: recipeChunks, error: recipeErr } = await supabase
          .from('document_chunks')
          .select('id, document_id, content')
          .or("content.ilike.%рецепт%,content.ilike.%ингредиент%,content.ilike.%готовить%")
          .limit(Math.max(100, matchCount));

        if (recipeErr) {
          console.warn('[ALL-RECIPES] Keyword scan failed:', recipeErr.message);
        } else if (recipeChunks && recipeChunks.length > 0) {
          console.log(`[ALL-RECIPES] Found ${recipeChunks.length} candidate recipe chunks via keyword scan`);
          // Convert to matches with a neutral similarity so downstream code can handle them
          allMatches = recipeChunks.map((c: any) => ({
            id: c.id,
            document_id: c.document_id,
            content: c.content,
            similarity: 0.5
          }));
        } else {
          console.log('[ALL-RECIPES] Keyword scan returned no chunks — falling back to semantic matches');
        }
      } catch (ex: any) {
        console.warn('[ALL-RECIPES] Fallback scan failed:', ex?.message || ex);
      }
    }

    // ДИНАМИЧЕСКИЙ SIMILARITY THRESHOLD: фильтруем низкокачественные результаты
  // Базовый порог схожести: понижаем для рецептов, чтобы не терять короткие/кулинарные чанки
  const minSimilarity = intent.action === 'recipes' ? MIN_SIMILARITY_RECIPES : MIN_SIMILARITY_DEFAULT;

    // Диагностика: сколько совпадений было до фильтрации
    const preFilterCount = allMatches.length;
    console.log(`[QUALITY FILTER] Pre-filter matches: ${preFilterCount}, topSimilarity: ${topSimilarity}, minSimilarity: ${minSimilarity}`);

    // сохраняем резервную копию на случай отката/фоллбека
    const allMatchesBackup = allMatches.slice();

    allMatches = allMatches.filter(match => (match.similarity || 0) >= minSimilarity);
    console.log(`[QUALITY FILTER] After strict similarity filter: ${allMatches.length} matches (threshold: ${minSimilarity})`);

    // Фоллбек: если строгий фильтр убрал все результаты, попробуем ослабить порог
    if (allMatches.length === 0) {
      console.warn('[QUALITY FILTER] No matches after strict similarity filter. Attempting relaxed fallback...');
      const relaxedMin = Math.max(RELAXED_MIN_FLOOR, minSimilarity - RELAXED_MIN_DELTA);
      allMatches = allMatchesBackup.filter(match => (match.similarity || 0) >= relaxedMin);
      console.log(`[QUALITY FILTER] Relaxed fallback applied: ${allMatches.length} matches (relaxedMin: ${relaxedMin})`);
    }

    // Если все варианты поиска провалились даже после фоллбека, возвращаем ошибку и диагностические данные
    if (allMatches.length === 0) {
      console.error('[SEARCH] No matches found from any query variant even after relaxed fallback');
      console.error('[SEARCH DIAG] Top candidates before filters:', allMatchesBackup.slice(0, 5).map(m => ({ id: m.id || m.document_id, similarity: m.similarity || 0, contentPreview: (m.content || '').substring(0, 120) })));
      return NextResponse.json({ 
        error: 'Не найдено релевантных документов', 
        message: 'Попробуйте переформулировать запрос или уточнить источник' 
      }, { status: 404 });
    }

    let matches = allMatches;

    // RERANKING: Используем LLM для переранжирования результатов ТОЛЬКО для сложных случаев
    // Экономия бюджета: только если similarity < 0.5 (неуверенный поиск)
  const shouldRerank = matches && matches.length > 0 && 
             intent.action === 'qa' && 
             topSimilarity < RERANK_SIMILARITY_THRESHOLD;  // Только для сложных запросов
    
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
    // Для рецептов используем умную группировку по названию рецепта
    if (matches && matches.length > 0 && intent.action !== 'recipes') {
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
    } else if (intent.action === 'recipes') {
      // УМНАЯ ГРУППИРОВКА РЕЦЕПТОВ: группируем по названию рецепта, а не по документу
      const extractRecipeTitle = (content: string): string => {
        const lines = content.split('\n');
        for (const line of lines.slice(0, 3)) { // Проверяем первые 3 строки
          const trimmed = line.trim();
          // Ищем строки, которые выглядят как названия рецептов
          if (trimmed.length > 3 && trimmed.length < 100 &&
              (trimmed.toLowerCase().includes('рецепт') ||
               trimmed.includes('🍽️') ||
               /^[А-ЯA-Z].*[блюда|салат|паста|курица|рыба|мясо]/i.test(trimmed))) {
            return trimmed;
          }
        }
        // Fallback: первые 50 символов
        return content.substring(0, 50).split('\n')[0].trim();
      };

      const { normalizeTitle } = await import('@/lib/search-utils');
      const recipeGroups = new Map<string, any[]>();
      for (const match of matches) {
        const titleRaw = extractRecipeTitle(match.content);
        const title = normalizeTitle(titleRaw) || titleRaw.substring(0, 50).trim();
        if (!recipeGroups.has(title)) {
          recipeGroups.set(title, []);
        }
        recipeGroups.get(title)!.push(match);
      }

      // Из каждой группы рецептов берём чанк с максимальным similarity
      const deduplicatedRecipes = Array.from(recipeGroups.values()).map(group => {
        return group.reduce((best, current) => {
          return (current.similarity || 0) > (best.similarity || 0) ? current : best;
        });
      });

      // Сортируем по similarity и ограничиваем
      matches = deduplicatedRecipes
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
  .slice(0, Math.max(RECIPE_MIN_RESULTS, matchCount)); // Максимум зависит от matchCount (минимум RECIPE_MIN_RESULTS)

      console.log(`[RECIPES] Smart deduplication: ${recipeGroups.size} recipe groups → ${matches.length} unique recipes`);
    }

    // SOURCE CREDIBILITY SCORING: повышаем релевантность для domain-specific источников
    if (matches && matches.length > 0) {
      // Определяем domain из query keywords
      const isJournalismQuery = lowerQuery.includes('новая газета') || lowerQuery.includes('новой газете') ||
                               lowerQuery.includes('колонк') || lowerQuery.includes('публикац') ||
                               lowerQuery.includes('журналист');

      const sourceWeights: Record<string, number> = {
        // Journalism sources
        'Новая Газета': isJournalismQuery ? 1.3 : 1.0,
        'Novaya Gazeta': isJournalismQuery ? 1.3 : 1.0,
        'новая газета': isJournalismQuery ? 1.3 : 1.0,
        // Personal content lower for journalism queries
        'personal': isJournalismQuery ? 0.7 : 1.0,
        'личные заметки': isJournalismQuery ? 0.7 : 1.0,
        // Default
        'unknown': 1.0
      };

      matches.forEach(match => {
        const sourceTitle = match.source_title || match.document_title || '';
        const weight = sourceWeights[sourceTitle.toLowerCase()] || 1.0;

        if (weight !== 1.0) {
          match.similarity = (match.similarity || 0) * weight;
          console.log(`[SOURCE WEIGHT] ${sourceTitle}: similarity ${match.similarity?.toFixed(3)} (weight: ${weight})`);
        }
      });

      // Пересортируем после применения весов
      matches.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    }

    // SMART RESULT FILTERING: фильтруем низкокачественные результаты
    if (matches && matches.length > 0) {
      const isRecipesQuery = intent.action === 'recipes';
      const isJournalismQuery = lowerQuery.includes('новая газета') || lowerQuery.includes('новой газете') ||
                               lowerQuery.includes('колонк') || lowerQuery.includes('публикац');

      // Relaxed quality thresholds for recipes and journalism (centralized)
      const minSimilarityThreshold = isRecipesQuery ? MIN_SIMILARITY_RECIPES :
                                   isJournalismQuery ? MIN_SIMILARITY_JOURNALISM : MIN_SIMILARITY_DEFAULT;

      const qualityFilters = {
        minSimilarity: minSimilarityThreshold,
        // Рецепты часто хранятся в коротких чанках — разрешаем меньшую длину
        minLength: isRecipesQuery ? MIN_LENGTH_RECIPES : (intent.action === 'analyze' ? MIN_LENGTH_ANALYZE : MIN_LENGTH_DEFAULT),
        hasContent: true
      };

      const beforeFiltering = matches.length;
      matches = matches.filter(match => {
        const similarity = match.similarity || 0;
        const contentLength = match.content?.length || 0;
        const hasContent = match.content && match.content.trim().length > 10;

        return similarity >= qualityFilters.minSimilarity &&
               contentLength >= qualityFilters.minLength &&
               hasContent;
      });

      console.log(`[QUALITY FILTER] Filtered ${beforeFiltering} → ${matches.length} results (threshold: ${minSimilarityThreshold})`);
    }

    let contextText = '';
    let filteredMatches = matches || [];

    // STRICT RAG: If no context, return refusal immediately
    if ((intent.action === 'qa' || intent.action === 'recipes') && (!filteredMatches || filteredMatches.length === 0)) {
      return NextResponse.json({
        reply: intent.action === 'qa'
          ? 'В предоставленных документах нет информации по вашему вопросу.'
          : 'В базе знаний рецепты не найдены.',
        sources: [],
        intent: intent.action,
        conversationId: null
      }, { status: 200 });
    }
    
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
        
        const docMap = toMetaMap(docs as any[]);
        
        // Фильтруем по соответствующему источнику
        filteredMatches = filteredMatches.filter((m: any) => {
          const doc = docMap.get(m.document_id);
          if (!doc) return false;
          
          if (mentionsNovajaGazeta) {
              // Проверяем в URL и в заголовке документа на предмет Новая Газета
              const url = (doc.url || '').toLowerCase();
              const title = (doc.title || '').toLowerCase();
              return (url && (url.includes('novayagazeta') || url.includes('novaya') || url.includes('novaia'))) ||
                     (title && title.includes('новая газета'));
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
            allChunks.push(`\n\n=== ${doc.title} (${doc.created_at.substring(0, 10)}) ===\n${chunks.map((c: any) => c.content).join('\n')}`);
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
          contextText = docMetadata + chunks.map((c: any) => c.content).join('\n\n');
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
      
      // Динамический лимит контекста: больше для рецептов и анализа
      const contextLimit = intent.action === 'recipes' ? 16000 :
                          intent.action === 'analyze' ? 12000 : 8000;
      contextText = chunksWithDocs.join('\n\n---\n\n').substring(0, contextLimit);
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

    // Определяем, требуется ли глубокий синтез
    const requiresDeepSynthesis = intent.action === 'analyze' || intent.action === 'compare' ||
                    (intent.action === 'qa' && query.length > 50); // Длинные QA-запросы тоже нуждаются в синтезе

    // Pierrot persona: override system prompt for art/selection context
    let systemPrompt = PIERROT_SYSTEM_PROMPT;
    let usingPierrot = false;
    // If the query is about art, selection, or known artists, use Pierrot
    const artKeywords = [
      // Artists (English & Russian transliterations)
      'basquiat','баския','баскиа','jean-michel',
      'monet','монэ','моне','claude',
      'buffet','буффе','бюффе','bernard',
      'chagall','шагал','marc',
      'krasnopevtsev','краснопевцев','dmitry','дмитрий',
      'glenn brown','brown','браун','гленн',
      'calder','калдер','александр','alexander',
      'bromley','бромли','dorothy','дороти',
      'zhang xiaogang','zhang','xiaogang','чжан','сяоган',
      // Art terms (English)
      'selection','art','painting','artist','artwork','canvas','oil','sculpture','print','edition','provenance','auction','gallery','collection','curator','curate','contemporary','modern','impressionism','expressionism','abstract','figurative','portrait','landscape','still life',
      // Art terms (Russian)
      'картина','живопись','искусство','художник','произведение','холст','масло','скульптура','эстамп','тираж','провенанс','аукцион','галерея','коллекция','куратор','курировать','современное','модерн','импрессионизм','экспрессионизм','абстракция','фигуратив','портрет','пейзаж','натюрморт',
      // Advisory terms (English)
      'recommend','suggestion','advise','buy','purchase','invest','investment','acquire','acquisition','budget','price','value','worth','trophy','secret','quiet','loud','noise','silence','melancholy','energy',
      // Advisory terms (Russian)
      'посоветуй','посоветовать','порекомендуй','рекомендация','совет','купить','покупка','инвестиция','инвестировать','приобрести','бюджет','цена','стоимость','ценность','трофей','секрет','тихий','громкий','шум','тишина','меланхолия','энергия',
      // Action verbs
      'show','покажи','tell','расскажи','what','что','какой','какая','какое','which','choose','выбрать','выбор','look','смотреть','see','видеть','have','есть','iметь',
      // Site-specific
      'merkurov','меркуров','pierrot','пьеро','арт','selection','подборка'
    ];
    const ql = query.toLowerCase();
    // Also detect merkurov.love URLs as art queries
    const hasMerkurovUrl = /merkurov\.love\//i.test(query);
    if (artKeywords.some(k => ql.includes(k)) || hasMerkurovUrl) {
      systemPrompt = PIERROT_SYSTEM_PROMPT;
      usingPierrot = true;
    } else {
      // fallback to default logic
      let finalPromptKey: keyof typeof AGENT_PROMPTS = intent.action as keyof typeof AGENT_PROMPTS;
      if (requiresDeepSynthesis) {
        finalPromptKey = 'synthesis_expert' as keyof typeof AGENT_PROMPTS;
      } else if ((intent.action === 'analyze' || intent.action === 'compare') && intent.target === 'all') {
        finalPromptKey = 'multi_analyze' as keyof typeof AGENT_PROMPTS;
      }
      systemPrompt = AGENT_PROMPTS[finalPromptKey];
    }
    console.log('[AGENT] Using system prompt:', usingPierrot ? 'PIERROT' : systemPrompt);

    // Настройки генерации в зависимости от типа задачи
    // Аналитика требует больше токенов и меньше креативности
    const isAnalytical = ['analyze', 'multi_analyze', 'compare'].includes(intent.action);
    // Allow tuner to prefer extractive (lower temperature)
    const preferExtractive = settings?.preferExtractive ?? false;
    
    // Pierrot needs slightly higher temperature for elegant, metaphorical language
    const temperature = preferExtractive ? 0.1 : 
                       (usingPierrot ? 0.7 :  // Pierrot: more creative, poetic
                       (isAnalytical ? 0.4 : 0.6));  // Аналитика: точнее, QA: чуть свободнее
    
    // CONTEXT WINDOW MANAGEMENT: динамически рассчитываем max_tokens
    // RAG: Prioritize curator_note and description fields for artworks
    if (usingPierrot && filteredMatches && filteredMatches.length > 0) {
      console.log('[PIERROT RAG] Restructuring context for art advisor...');
      
      filteredMatches = filteredMatches.map(m => {
        if (m.curator_note || m.description) {
          // Restructure content to prioritize curator's voice
          let content = '=== ARTWORK DATA ===\n';
          
          if (m.curator_note) {
            content += `[CURATOR'S NOTE]\n${m.curator_note}\n\n`;
          }
          
          if (m.description) {
            content += `[DESCRIPTION]\n${m.description}\n\n`;
          }
          
          // Add metadata if available
          if (m.title) content += `[TITLE] ${m.title}\n`;
          if (m.source_url) content += `[URL] ${m.source_url}\n`;
          
          // Finally add the rest of content
          if (m.content) {
            content += `\n[ADDITIONAL CONTEXT]\n${m.content}`;
          }
          
          return { ...m, content };
        }
        return m;
      });
      
      console.log('[PIERROT RAG] Restructured matches:', filteredMatches.length);
    }
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
    // Honor tuner requested maxGenerationTokens if provided
    const requestedMax = settings?.maxGenerationTokens;
    const effectiveMax = requestedMax ? Math.max(128, Math.min(32000, Number(requestedMax))) : baseMaxTokens;
    // Но не больше доступного в context window
    const maxTokens = Math.min(effectiveMax, Math.max(500, availableTokens));
    
    // GPT-4o-mini для всех задач (экономия бюджета, достаточное качество)
    // gpt-4o только в исключительных случаях
    const modelName = 'gpt-4o-mini';
    
    console.log('[GENERATION PARAMS]', { 
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
    
    // RESPONSE QUALITY VALIDATION - временно отключена из-за ошибки типов
    // const validateResponse = (query: string, response: string, intent: any): boolean => {
    //   // Basic quality checks
    //   const hasContent = response && response.length > 10;
    //   const hasRelevantKeywords = query.split(' ').some(word =>
    //     word.length > 3 && response.toLowerCase().includes(word.toLowerCase())
    //   );
    //   const notTooShort = response.length > (intent.action === 'analyze' ? 200 : 50);
    //   const notRepetitive = !response.includes('Извините') && !response.includes('не могу');

    //   const isValid = hasContent && hasRelevantKeywords && notTooShort && notRepetitive;

    //   console.log('[RESPONSE VALIDATION]', {
    //     isValid,
    //     length: response.length,
    //     hasKeywords: hasRelevantKeywords,
    //     intent: intent.action
    //   });

    //   return isValid;
    // };

    // // Если ответ не прошел валидацию — пытаемся улучшить
    // let finalAnswer = answer;
    // if (!validateResponse(query, answer, intent)) {
    //   console.log('[RESPONSE VALIDATION] Low quality response detected, attempting improvement...');
    //   // Для низкокачественных ответов — расширяем контекст или меняем промпт
    //   if (contextText.length < 4000 && filteredMatches.length > 0) {
    //     console.log('[FALLBACK] Expanding context for better response...');
    //     // Можно добавить логику повторной генерации с расширенным контекстом
    //   }
    //   // Если ответ совсем плохой — добавляем disclaimer
    //   if (answer.length < 50) {
    //     finalAnswer = `${answer}\n\n⚠️ Ответ может быть неполным. Попробуйте переформулировать вопрос.`;
    //   }
    // }
    
    let finalAnswer = answer;
    // Add disclaimer for low-confidence answers (short or generic)
    if ((intent.action === 'qa' || intent.action === 'recipes') && finalAnswer && finalAnswer.length < 80) {
      finalAnswer = `${finalAnswer}\n\n⚠️ Ответ может быть неполным. Попробуйте переформулировать вопрос или уточнить детали.`;
    }
    



    // Обрезаем слишком длинные ответы, если нужно
    let conciseAnswer = finalAnswer;
    if (conciseAnswer.length > 1200) {
      conciseAnswer = conciseAnswer.substring(0, 1200).trim() + '...';
    }

    conciseAnswer = cleanReply(conciseAnswer);

    // Detect user language and ensure answer matches
    if (usingPierrot) {
      const userLang = detectLanguage(query);
      const answerLang = detectLanguage(conciseAnswer);
      if (userLang !== answerLang) {
        // Re-prompt LLM to answer in user's language
        const langPrompt = userLang === 'ru' ? 'Ответь на русском языке.' : 'Answer in English.';
        const rePrompt = `${langPrompt}\n\n${systemPrompt}\n\nКонтекст:\n${contextText}\n\nВопрос: ${query}`;
        const reResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: rePrompt }
            ],
            temperature,
            max_tokens: maxTokens
          })
        });
        if (reResponse.ok) {
          const reResult = await reResponse.json();
          let reAnswer = reResult.choices?.[0]?.message?.content?.trim();
          if (reAnswer) {
            reAnswer = cleanReply(reAnswer);
            if (detectLanguage(reAnswer) === userLang) {
              conciseAnswer = reAnswer;
            }
          }
        }
      }
    }

    // Сохраняем ответ в семантический кэш (без источников), если не установлен заголовок X-Bypass-Cache
    const bypassCache = req.headers.get('x-bypass-cache') === '1';
    if (!bypassCache) {
      (async () => {
        try {
          const cacheValue = {
            reply: conciseAnswer,
            sources: [],
            intent: intent.action
          };
          const inserted = await insertCachedResponse(primaryEmbedding, cacheValue);
          if (inserted) console.log('[RESPONSE-CACHE] Inserted cached response id=', inserted.id || inserted);
        } catch (e: any) {
          console.warn('[RESPONSE-CACHE] Failed to insert cache:', e?.message || e);
        }
      })();
    }

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
          content: conciseAnswer,
          metadata: { sources: 'none' },
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
    if (intent.action === 'recipes') {
      console.log('[RECIPES METRICS]', {
        query,
        totalChunksFound: matches.length,
        uniqueDocuments: new Set(matches.map(m => m.document_id)).size,
        avgSimilarity: matches.length > 0 ? matches.reduce((sum, m) => sum + (m.similarity || 0), 0) / matches.length : 0,
        contextLength: contextText.length,
        minSimilarity: MIN_SIMILARITY_RECIPES
      });
    }
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
      sources_count: 0,
      model_used: 'gpt-4o-mini',
      tokens_estimated: Math.ceil((contextText.length + query.length) / 4),
      has_answer: !!answer && answer.length > 10
    };
    trackQuery(metrics);
    checkAnomalies(metrics);
    return NextResponse.json({ 
      reply: conciseAnswer,
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
