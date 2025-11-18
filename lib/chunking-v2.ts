import { openai } from '@ai-sdk/openai';
import { getEmbeddings } from './embedding-ai';

/**
 * Adaptive semantic chunking (chunking-v2)
 * - Uses an LLM (gpt-4o-mini) to split large text into semantically meaningful chunks.
 * - Returns array of { content, semantic_tag, sentiment }
 *
 * Note: this module is intentionally conservative about input size and will split
 * long input into character slices before sending to the LLM.
 */

type ChunkV2 = {
  content: string;
  semantic_tag: string; // e.g. 'Ключевая идея', 'Доказательство', 'Событие'
  sentiment: 'Положительный' | 'Отрицательный' | 'Нейтральный';
};

const MAX_CHARS_PER_CALL = 24000; // conservative (~6k tokens at 4 chars/token)

function splitToBlocks(text: string, maxChars = MAX_CHARS_PER_CALL): string[] {
  if (!text) return [];
  const blocks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    blocks.push(text.slice(i, i + maxChars));
  }
  return blocks;
}

async function sendPromptToLLM(prompt: string): Promise<string> {
  // Support several SDK shapes for compatibility
  if (openai && openai.chat && openai.chat.completions && typeof openai.chat.completions.create === 'function') {
    const r: any = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 2000 });
    return r.choices?.[0]?.message?.content || r.choices?.[0]?.text || '';
  }

  if (openai && openai.chat && typeof openai.chat.create === 'function') {
    const r: any = await openai.chat.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 2000 });
    return r.choices?.[0]?.message?.content || r.output_text || '';
  }

  if (openai && openai.responses && typeof openai.responses.create === 'function') {
    const r: any = await openai.responses.create({ model: 'gpt-4o-mini', input: prompt, max_output_tokens: 2000 });
    if (r.output_text) return r.output_text;
    if (Array.isArray(r.output)) return r.output.map((o: any) => o.text || '').join('\n');
    return JSON.stringify(r);
  }

  throw new Error('No compatible OpenAI client available');
}

const PROMPT = `You are an assistant that splits a long Russian or English text into semantically coherent chunks.
Return a JSON array where each element has keys: content, semantic_tag, sentiment.
- content: the extracted text for the chunk (complete sentence(s), preserve meaning).
- semantic_tag: one of: "Ключевая идея", "Доказательство", "Событие", "Деталь", "Вопрос", "Резюме", "Другое".
- sentiment: one of: "Положительный", "Отрицательный", "Нейтральный".

Rules:
- Try to identify complete thoughts or events; do not arbitrarily split sentences.
- Keep chunks reasonably sized (a few sentences, but can be longer if expressing a full idea).
- Preserve original wording as much as possible.
- Output must be valid JSON (a single array). No extra commentary.

Example output:
[
  {"content": "...", "semantic_tag": "Ключевая идея", "sentiment": "Нейтральный"},
  ...
]

Process the following text:
"""
__INPUT__
"""
`;

export async function adaptiveChunkText(text: string): Promise<ChunkV2[]> {
  const blocks = splitToBlocks(text || '');
  const results: ChunkV2[] = [];

  for (const block of blocks) {
    const prompt = PROMPT.replace('__INPUT__', block);
    let raw: string;
    try {
      raw = await sendPromptToLLM(prompt);
    } catch (e: any) {
      console.warn('LLM chunking failed for block, falling back to sentence-split:', e?.message || e);
      // Fallback: naive sentence split
      const fallback = block.split(/(?<=[.!?])\s+/).slice(0, 50);
      fallback.forEach(s => {
        if (s.trim()) results.push({ content: s.trim(), semantic_tag: 'Другое', sentiment: 'Нейтральный' });
      });
      continue;
    }

    // Try parse JSON
    try {
      const jsonStart = raw.indexOf('[');
      const jsonText = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (p && p.content) {
            results.push({
              content: String(p.content).trim(),
              semantic_tag: String(p.semantic_tag || 'Другое'),
              sentiment: String(p.sentiment || 'Нейтральный') as any,
            });
          }
        }
      } else {
        // unexpected shape
        console.warn('LLM returned non-array shape for chunking, doing fallback sentence split');
        const fallback = block.split(/(?<=[.!?])\s+/).slice(0, 50);
        fallback.forEach(s => {
          if (s.trim()) results.push({ content: s.trim(), semantic_tag: 'Другое', sentiment: 'Нейтральный' });
        });
      }
    } catch (parseErr) {
      console.warn('Failed to parse LLM chunking JSON, falling back:', parseErr?.message || parseErr);
      const fallback = block.split(/(?<=[.!?])\s+/).slice(0, 50);
      fallback.forEach(s => {
        if (s.trim()) results.push({ content: s.trim(), semantic_tag: 'Другое', sentiment: 'Нейтральный' });
      });
    }
  }

  return results;
}

export type { ChunkV2 };
