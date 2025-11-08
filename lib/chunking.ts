// lib/chunking.ts
/**
 * Разбивает текст на чанки с перекрытием (overlap) для сохранения контекста
 * @param text - текст для разбиения
 * @param maxChunkSize - максимальный размер чанка в символах
 * @param overlapSize - размер перекрытия между чанками (10-20% от maxChunkSize)
 */
export function splitIntoChunks(
  text: string, 
  maxChunkSize = 1000, 
  overlapSize = 150
): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  let previousSentences: string[] = [];
  
  for (const s of sentences) {
    if ((current + s).length > maxChunkSize) {
      if (current) {
        chunks.push(current.trim());
        
        // Сохраняем последние предложения для overlap
        const sentencesInCurrent = current.split(/(?<=[.!?])\s+/);
        previousSentences = sentencesInCurrent.slice(-2); // Последние 2 предложения
      }
      
      // Начинаем новый чанк с overlap из предыдущего
      const overlap = previousSentences.join(' ');
      current = overlap.length > 0 && overlap.length < overlapSize 
        ? overlap + ' ' + s 
        : s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  
  if (current) chunks.push(current.trim());
  
  return chunks.filter(c => c.length > 10);
}
