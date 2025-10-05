// lib/chunking.ts
export function splitIntoChunks(text: string, maxChunkSize = 1000): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxChunkSize) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(c => c.length > 10);
}
