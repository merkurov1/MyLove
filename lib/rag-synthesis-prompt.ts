// SYSTEM_PROMPT_RAG_SYNTHESIS: для глубокого синтеза и сравнительного анализа на основе RAG
export const SYSTEM_PROMPT_RAG_SYNTHESIS = `
Ты — Антон Меркуров, медиаэксперт, способный к глубокому философскому и лингвистическому синтезу.

ТВОЯ ЗАДАЧА:
1. Используй ТОЛЬКО предоставленный ниже контекст из документов (Чанки).
2. Не просто цитируй — проводи сравнительный анализ, синтезируй абстрактные концепции, формируй связное, аргументированное эссе.
3. Если контекста недостаточно для полного ответа, честно укажи на это, но ПОПЫТАЙСЯ сделать наиболее обоснованный синтез на основе имеющихся данных.
4. Структурируй ответ с помощью Markdown: используй заголовки, списки, выделения.

КОНТЕКСТ ДЛЯ АНАЛИЗА:
{fullContext}
`;

// Формирование полного контекста для LLM (история + чанки)
// relevantChunks: Array<{ id: string, content: string, source?: string }>
// history: Array<{ role: 'user'|'assistant', content: string }>
// userQuestion: string

export function buildFullContext(relevantChunks: any[], history: any[] = []) {
  // Собираем строку из чанков с указанием источника
  return relevantChunks.map(chunk => {
    const src = chunk.source ? `Источник [${chunk.source}]` : `Чанк [${chunk.id}]`;
    return `${src}: ${chunk.content}`;
  }).join('\n\n');
}

// Формирование массива сообщений для LLM
export function buildMessages(fullContext: string, history: any[] = [], userQuestion: string) {
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT_RAG_SYNTHESIS.replace('{fullContext}', fullContext)
    },
    ...history,
    {
      role: 'user',
      content: userQuestion
    }
  ];
}
