// lib/embedding-ai.ts - Unified embedding using Vercel AI SDK
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Generate a single embedding using OpenAI text-embedding-3-small
 * Returns a 1536-dimensional vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });
  
  return embedding;
}

/**
 * Estimate tokens in text (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate multiple embeddings with smart batching based on actual token count
 * OpenAI embedding API has a limit of 8192 tokens per request
 * We target max 6000 tokens per batch to leave safety margin
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const MAX_TOKENS_PER_BATCH = 6000;
  const allEmbeddings: number[][] = [];
  
  console.log(`[getEmbeddings] Processing ${texts.length} texts with smart batching`);
  
  let currentBatch: string[] = [];
  let currentTokens = 0;
  let batchNum = 1;
  
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const textTokens = estimateTokens(text);
    
    // Если один текст больше лимита - отправляем его отдельно
    if (textTokens > MAX_TOKENS_PER_BATCH) {
      console.warn(`[getEmbeddings] Text ${i + 1} is very large (${textTokens} tokens), processing separately`);
      
      // Сначала обработаем текущий batch если есть
      if (currentBatch.length > 0) {
        await processBatch(currentBatch, batchNum++, allEmbeddings);
        currentBatch = [];
        currentTokens = 0;
      }
      
      // Обработаем большой текст отдельно
      await processBatch([text], batchNum++, allEmbeddings);
      continue;
    }
    
    // Если добавление текста превысит лимит - отправим текущий batch
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
  
  console.log(`[getEmbeddings] Successfully generated ${allEmbeddings.length} embeddings in ${batchNum} batches`);
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
    
    // Если batch всё равно слишком большой - попробуем разделить пополам
    if (error.message.includes('maximum context length') && batch.length > 1) {
      console.log(`[getEmbeddings] Splitting batch ${batchNum} in half and retrying...`);
      const mid = Math.floor(batch.length / 2);
      await processBatch(batch.slice(0, mid), batchNum, results);
      await processBatch(batch.slice(mid), batchNum, results);
      return;
    }
    
    throw new Error(`Embedding batch failed: ${error.message}`);
  }
}

/**
 * Get embedding dimension for this provider
 */
export const EMBEDDING_DIMENSION = 1536;
