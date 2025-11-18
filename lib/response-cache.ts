import { supabase } from '@/utils/supabase/server'

export async function findCachedResponse(embedding: number[], similarityThreshold = 0.99) {
  try {
    const { data, error } = await supabase.rpc('find_cached_response', {
      query_embedding: embedding,
      similarity_threshold: similarityThreshold
    }) as any;

    if (error) {
      console.error('[RESPONSE-CACHE] RPC error:', error.message || error);
      return null;
    }

    if (!data || data.length === 0) return null;

    // RPC возвращает таблицу; берём первый результат
    const row = Array.isArray(data) ? data[0] : data;
    return {
      id: row.id,
      llm_response: row.llm_response,
      similarity: row.similarity
    };
  } catch (err: any) {
    console.error('[RESPONSE-CACHE] findCachedResponse error:', err?.message || err);
    return null;
  }
}

export async function insertCachedResponse(embedding: number[], llmResponse: any) {
  try {
    const { data, error } = await supabase
      .from('response_cache')
      .insert([{ query_embedding: embedding, llm_response: llmResponse }])
      .select()
      .single();

    if (error) {
      console.error('[RESPONSE-CACHE] insert error:', error.message || error);
      return null;
    }

    return data;
  } catch (err: any) {
    console.error('[RESPONSE-CACHE] insertCachedResponse error:', err?.message || err);
    return null;
  }
}

export default { findCachedResponse, insertCachedResponse };
