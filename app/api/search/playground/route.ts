import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { getEmbedding } from '@/lib/embedding-ai';
import { fastRerank } from '@/lib/reranking';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Protect endpoint in production: require x-admin-token header matching ADMIN_API_TOKEN
    const provided = req.headers.get('x-admin-token');
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_API_TOKEN) {
        console.error('[SEARCH/PLAYGROUND] ADMIN_API_TOKEN is not set in env on production');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
      }
      if (!provided || provided !== process.env.ADMIN_API_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const body = await req.json();
    const { query, mode = 'hybrid', matchCount = 10, threshold = 0.5, sourceFilter } = body;

    if (!query || typeof query !== 'string') return NextResponse.json({ error: 'Empty query' }, { status: 400 });

    // Keyword-only search (simple, fast)
    if (mode === 'keyword') {
      const q = query.replace(/%/g, '\\%');
      let builder = supabase
        .from('document_chunks')
        .select('id, document_id, content, similarity, created_at')
        .ilike('content', `%${q}%`)
        .limit(matchCount);

      if (sourceFilter) {
        builder = builder.eq('source', sourceFilter).limit(matchCount);
      }

      const { data, error } = await builder;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ results: data || [] });
    }

    // Vector / Hybrid search: compute embedding first
    const embedding = await getEmbedding(query);

    if (mode === 'vector') {
      const { data, error } = await supabase.rpc('match_documents', { query_embedding: embedding, match_count: matchCount });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ results: data || [] });
    }

    // Hybrid by default: call hybrid_search RPC if available
    try {
      const { data, error } = await supabase.rpc('hybrid_search', {
        query_text: query,
        query_embedding: embedding,
        match_count: matchCount,
        keyword_weight: 0.4,
        semantic_weight: 0.6
      });

      if (error && error.message?.includes('function hybrid_search')) {
        // Fallback to vector-only
        const { data: vecData, error: vecErr } = await supabase.rpc('match_documents', { query_embedding: embedding, match_count: matchCount });
        if (vecErr) return NextResponse.json({ error: vecErr.message }, { status: 500 });
        return NextResponse.json({ results: vecData || [] });
      }

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      let results = data || [];

      // Optionally apply threshold filter
      if (threshold) results = results.filter((r: any) => (r.similarity ?? 0) >= Number(threshold));

      // Optionally rerank using fastRerank if many low-similarity results
      if (results.length > 0 && (results[0].similarity ?? 0) < 0.5) {
        try {
          const reranked = await fastRerank(query, results, Math.min(10, results.length));
          if (reranked && reranked.length > 0) {
            results = reranked;
          }
        } catch (rerr) {
          console.warn('[PLAYGROUND] Rerank failed', rerr?.message || rerr);
        }
      }

      return NextResponse.json({ results });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
