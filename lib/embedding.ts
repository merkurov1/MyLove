// lib/embedding.ts
import { supabase } from '@/utils/supabase/client';

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // Вызываем нашу собственную Edge Function под названием 'embedding'
    const { data, error } = await supabase.functions.invoke('embedding', {
      body: { text },
    });

    if (error) {
      throw error;
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data.embedding;
  } catch (error) {
    console.error("Error getting embedding from Supabase Edge Function:", error);
    throw error;
  }
}
