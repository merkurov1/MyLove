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
 * Generate multiple embeddings in batch with automatic batching
 * OpenAI embedding API has a limit of 8192 tokens per request
 * Average chunk is ~500 tokens, so we batch by 10 to stay safe (10 * 500 = 5000 tokens)
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 10; // Консервативный размер для больших чанков
  const allEmbeddings: number[][] = [];
  
  console.log(`[getEmbeddings] Processing ${texts.length} texts in batches of ${BATCH_SIZE}`);
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(`[getEmbeddings] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}: ${batch.length} texts`);
    
    try {
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: batch,
      });
      
      allEmbeddings.push(...embeddings);
    } catch (error: any) {
      console.error(`[getEmbeddings] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      throw new Error(`Embedding batch failed: ${error.message}`);
    }
  }
  
  console.log(`[getEmbeddings] Successfully generated ${allEmbeddings.length} embeddings`);
  return allEmbeddings;
}

/**
 * Get embedding dimension for this provider
 */
export const EMBEDDING_DIMENSION = 1536;
