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
 * Generate multiple embeddings in batch
 * More efficient than calling getEmbedding multiple times
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: texts,
  });
  
  return embeddings;
}

/**
 * Get embedding dimension for this provider
 */
export const EMBEDDING_DIMENSION = 1536;
