// lib/chunking.ts
/**
 * Разбивает текст на чанки с перекрытием (overlap) для сохранения контекста
 * @param text - текст для разбиения
 * @param maxChunkSize - максимальный размер чанка в символах (по умолчанию 2000 = ~500 токенов)
 * @param overlapSize - размер перекрытия между чанками (10-20% от maxChunkSize)
 */
export function splitIntoChunks(
  text: string, 
  maxChunkSize = 2000, 
  overlapSize = 200
): string[] {
  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Если нет предложений, разбиваем принудительно по символам
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  // Если после split всё ещё 1 элемент (нет точек) - принудительно режем по символам
  if (sentences.length === 1 && text.length > maxChunkSize) {
    console.warn(`[chunking] Text has no sentence boundaries (${text.length} chars), forcing character-based split`);
    const forcedChunks: string[] = [];
    for (let i = 0; i < text.length; i += maxChunkSize - overlapSize) {
      const chunk = text.slice(i, i + maxChunkSize);
      forcedChunks.push(chunk);
    }
    return forcedChunks.filter(c => c.length > 10);
  }
  
  const chunks: string[] = [];
  let current = '';
  let previousSentences: string[] = [];
  
  for (const s of sentences) {
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Если ОДНО предложение больше maxChunkSize - режем его принудительно
    if (s.length > maxChunkSize) {
      console.warn(`[chunking] Single sentence too large (${s.length} chars), forcing split`);
      
      // Сохраняем текущий чанк если есть
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      
      // Режем большое предложение по символам
      for (let i = 0; i < s.length; i += maxChunkSize - overlapSize) {
        const piece = s.slice(i, i + maxChunkSize);
        chunks.push(piece.trim());
      }
      continue;
    }
    
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
