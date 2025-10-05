// lib/embedding.ts
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: 'https://api.fireworks.ai/inference/v1',
});

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const res = await openai.embeddings.create({
      model: 'nomic-ai/nomic-embed-text-v1.5',
      input: text,
    });
    if (!res.data?.[0]?.embedding || res.data[0].embedding.length !== 768) {
      throw new Error('Invalid embedding response from Fireworks');
    }
    return res.data[0].embedding;
  } catch (error) {
    console.error('Error getting embedding from Fireworks:', error);
    throw error;
  }
}
