// lib/embedding-ai.ts - Unified embedding using Vercel AI SDK with caching
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Create Supabase client for caching
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[EMBEDDING CACHE] Supabase not configured, caching disabled');
    return null;
  }

  return createClient(url, key);
}

/**
 * Generate hash for text caching
 */
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a single embedding using OpenAI text-embedding-3-small with caching
 * Returns a 1536-dimensional vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const supabase = getSupabaseClient();
  const textHash = hashText(text);

  // Try to get from cache first
  if (supabase) {
    try {
      const { data: cached } = await supabase
        .from('embedding_cache')
        .select('embedding')
        .eq('text_hash', textHash)
        .eq('model', 'text-embedding-3-small')
        .single();

      if (cached?.embedding) {
        console.log(`[EMBEDDING CACHE] Hit for text hash: ${textHash.substring(0, 8)}...`);

        // Update access stats
        await supabase
          .from('embedding_cache')
          .update({
            last_accessed: new Date().toISOString()
          })
          .eq('text_hash', textHash);

        return cached.embedding as number[];
      }
    } catch (cacheError) {
      console.log('[EMBEDDING CACHE] Cache miss or error:', cacheError);
    }
  }

  // Generate new embedding
  console.log(`[EMBEDDING CACHE] Miss, generating new embedding for: "${text.substring(0, 50)}..."`);
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });

  // Store in cache
  if (supabase) {
    try {
      await supabase
        .from('embedding_cache')
        .upsert({
          text_hash: textHash,
          original_text: text,
          embedding: embedding,
          model: 'text-embedding-3-small'
        });
      console.log(`[EMBEDDING CACHE] Stored embedding for hash: ${textHash.substring(0, 8)}...`);
    } catch (storeError) {
      console.warn('[EMBEDDING CACHE] Failed to store embedding:', storeError);
    }
  }

  return embedding;
}

/**
 * Estimate tokens in text (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Принудительно режем текст если больше лимита
 */
function forceChunkText(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4; // ~4 chars per token
  const chunks: string[] = [];
  
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  
  console.log(`[forceChunkText] Split ${text.length} chars into ${chunks.length} chunks of ~${maxTokens} tokens`);
  return chunks;
}

/**
 * Generate multiple embeddings with smart batching and caching
 * OpenAI embedding API has a limit of 8192 tokens per request
 * We target max 2000 tokens per text to be safe (single text limit)
 * And max 6000 tokens per batch (multiple texts)
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const supabase = getSupabaseClient();
  const allEmbeddings: number[][] = [];
  const uncachedTexts: string[] = [];
  const textToIndexMap: { [hash: string]: number } = {};

  console.log(`[getEmbeddings] Processing ${texts.length} texts with caching`);

  // First pass: check cache for each text
  if (supabase) {
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const textHash = hashText(text);

      try {
        const { data: cached } = await supabase
          .from('embedding_cache')
          .select('embedding')
          .eq('text_hash', textHash)
          .eq('model', 'text-embedding-3-small')
          .single();

        if (cached?.embedding) {
          console.log(`[EMBEDDING CACHE] Hit for text ${i + 1}/${texts.length}`);
          allEmbeddings[i] = cached.embedding as number[];

          // Update access stats
          await supabase
            .from('embedding_cache')
            .update({ last_accessed: new Date().toISOString() })
            .eq('text_hash', textHash);
        } else {
          uncachedTexts.push(text);
          textToIndexMap[textHash] = i;
        }
      } catch (cacheError) {
        console.log(`[EMBEDDING CACHE] Miss for text ${i + 1}, will generate`);
        uncachedTexts.push(text);
        textToIndexMap[hashText(text)] = i;
      }
    }
  } else {
    // No caching available
    uncachedTexts.push(...texts);
    texts.forEach((text, i) => {
      textToIndexMap[hashText(text)] = i;
    });
  }

  console.log(`[getEmbeddings] Cache stats: ${allEmbeddings.filter(e => e).length}/${texts.length} cached, ${uncachedTexts.length} to generate`);

  // If we have uncached texts, generate them
  if (uncachedTexts.length > 0) {
    const generatedEmbeddings = await getEmbeddingsUncached(uncachedTexts);

    // Store in cache and place in correct positions
    for (let i = 0; i < uncachedTexts.length; i++) {
      const text = uncachedTexts[i];
      const embedding = generatedEmbeddings[i];
      const textHash = hashText(text);
      const originalIndex = textToIndexMap[textHash];

      allEmbeddings[originalIndex] = embedding;

      // Store in cache
      if (supabase) {
        try {
          await supabase
            .from('embedding_cache')
            .upsert({
              text_hash: textHash,
              original_text: text,
              embedding: embedding,
              model: 'text-embedding-3-small'
            });
        } catch (storeError) {
          console.warn('[EMBEDDING CACHE] Failed to store embedding:', storeError);
        }
      }
    }
  }

  console.log(`[getEmbeddings] Successfully returned ${allEmbeddings.length} embeddings (${allEmbeddings.filter(e => e).length} cached)`);
  return allEmbeddings;
}

/**
 * Generate multiple embeddings without caching (internal function)
 */
async function getEmbeddingsUncached(texts: string[]): Promise<number[][]> {
  const MAX_TOKENS_PER_TEXT = 2000;  // КРИТИЧЕСКОЕ: Лимит для ОДНОГО текста
  const MAX_TOKENS_PER_BATCH = 6000; // Лимит для батча из нескольких текстов
  const allEmbeddings: number[][] = [];

  console.log(`[getEmbeddingsUncached] Processing ${texts.length} texts with smart batching`);

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сначала проверяем каждый текст на размер
  const safeTexts: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const textTokens = estimateTokens(text);

    if (textTokens > MAX_TOKENS_PER_TEXT) {
      console.warn(`[getEmbeddingsUncached] Text ${i + 1} is too large (${textTokens} tokens > ${MAX_TOKENS_PER_TEXT}), force splitting`);
      // Принудительно режем на куски по MAX_TOKENS_PER_TEXT
      const pieces = forceChunkText(text, MAX_TOKENS_PER_TEXT);
      safeTexts.push(...pieces);
    } else {
      safeTexts.push(text);
    }
  }

  console.log(`[getEmbeddingsUncached] After safety check: ${safeTexts.length} texts (was ${texts.length})`);

  // Теперь батчим безопасные тексты
  let currentBatch: string[] = [];
  let currentTokens = 0;
  let batchNum = 1;

  for (let i = 0; i < safeTexts.length; i++) {
    const text = safeTexts[i];
    const textTokens = estimateTokens(text);

    // Если добавление текста превысит лимит батча - отправим текущий batch
    if (currentTokens + textTokens > MAX_TOKENS_PER_BATCH && currentBatch.length > 0) {
      await processBatch(currentBatch, batchNum++, allEmbeddings);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(text);
    currentTokens += textTokens;
  }

  // Обработаем оставшийся batch
  if (currentBatch.length > 0) {
    await processBatch(currentBatch, batchNum, allEmbeddings);
  }

  console.log(`[getEmbeddingsUncached] Successfully generated ${allEmbeddings.length} embeddings in ${batchNum} batches`);
  return allEmbeddings;
}

/**
 * Process a single batch of texts
 */
async function processBatch(batch: string[], batchNum: number, results: number[][]): Promise<void> {
  const totalTokens = batch.reduce((sum, text) => sum + estimateTokens(text), 0);
  console.log(`[getEmbeddings] Batch ${batchNum}: ${batch.length} texts (~${totalTokens} tokens)`);
  
  try {
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: batch,
    });
    
    results.push(...embeddings);
  } catch (error: any) {
    console.error(`[getEmbeddings] Batch ${batchNum} failed:`, error.message);
    
    // Если batch слишком большой и содержит несколько текстов - делим пополам
    if (error.message.includes('maximum context length') && batch.length > 1) {
      console.log(`[getEmbeddings] Splitting batch ${batchNum} in half and retrying...`);
      const mid = Math.floor(batch.length / 2);
      await processBatch(batch.slice(0, mid), batchNum, results);
      await processBatch(batch.slice(mid), batchNum, results);
      return;
    }
    
    // Если это один текст и он всё равно слишком большой - режем принудительно
    if (error.message.includes('maximum context length') && batch.length === 1) {
      console.error(`[getEmbeddings] Single text still too large, force chunking...`);
      const pieces = forceChunkText(batch[0], 2000);
      for (const piece of pieces) {
        await processBatch([piece], batchNum, results);
      }
      return;
    }
    
    throw new Error(`Embedding batch failed: ${error.message}`);
  }
}

/**
 * Get embedding dimension for this provider
 */
export const EMBEDDING_DIMENSION = 1536;
