// Convert exported data to OpenAI fine-tuning format (JSONL)
const fs = require('fs');

const exportData = JSON.parse(fs.readFileSync('finetuning-export.json', 'utf8'));

// OpenAI fine-tuning format:
// Each line is a JSON object with "messages" array
// { "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}] }

const SYSTEM_PROMPT_ANALYZE = `Ты — ассистент для глубокого психолингвистического анализа текстов Антона Меркурова.

Твоя задача: анализировать стиль, психологические паттерны, скрытые мотивы, эволюцию тем и подходов автора.

При анализе:
- Выявляй НЕОЧЕВИДНЫЕ выводы (скрытые противоречия, бессознательные паттерны, переломные моменты)
- Обязательно указывай ДАТЫ для временного контекста
- Используй цитаты в формате [1], [2], [3] с номерами источников
- Фокусируйся на журналистском контексте (Антон — журналист, медиапродюсер, колумнист)`;

const SYSTEM_PROMPT_QA = `Ты — ассистент для ответов на вопросы о текстах и карьере Антона Меркурова.

Отвечай точно, опираясь на контекст документов. Используй формат цитирования [1], [2] для ссылок на источники.`;

// Generate training examples
const trainingExamples = [];

// 1. ANALYZE examples - для каждого документа с колонками НГ и длинных Substack
exportData.forEach(item => {
  const doc = item.document;
  const isNovajaGazeta = doc.source_url && doc.source_url.includes('novayagazeta');
  const isLongSubstack = item.fullContent.length > 5000;
  
  if (isNovajaGazeta || isLongSubstack) {
    // Example 1: Analyze writing style
    trainingExamples.push({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ANALYZE },
        { 
          role: 'user', 
          content: `Проанализируй стиль письма в этом тексте:\n\n${item.fullContent.substring(0, 3000)}...\n\nИсточник: ${doc.title}` 
        },
        { 
          role: 'assistant', 
          content: `Анализ стиля текста "${doc.title}" [1]:\n\n1. **Лексика и тон**: Автор использует ${isNovajaGazeta ? 'журналистскую, острую лексику с элементами сарказма' : 'личную, рефлексивную манеру письма'}.\n\n2. **Структура**: ${isNovajaGazeta ? 'Колонка построена по принципу "проблема → анализ → вывод"' : 'Эссе следует stream-of-consciousness с философскими отступлениями'}.\n\n3. **Неочевидные паттерны**: ${isNovajaGazeta ? 'Скрытое противоречие между критикой системы и надеждой на изменения' : 'Балансирование между personal брендингом и антибрендинговыми убеждениями'}.\n\nИсточники:\n[1] ${doc.title}` 
        }
      ]
    });
    
    // Example 2: Extract themes
    trainingExamples.push({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ANALYZE },
        { 
          role: 'user', 
          content: `Какие основные темы затрагивает автор в этом тексте?\n\nТекст: ${item.fullContent.substring(0, 2000)}...\n\nИсточник: ${doc.title}` 
        },
        { 
          role: 'assistant', 
          content: `Основные темы в "${doc.title}" [1]:\n\n1. **${isNovajaGazeta ? 'Цензура и свобода слова' : 'Personal брендинг и идентичность'}**\n2. **${isNovajaGazeta ? 'Медиа и пропаганда' : 'Креативность и самовыражение'}**\n3. **${isNovajaGazeta ? 'Социальная ответственность' : 'Технология и человек'}**\n\nНеочевидный вывод: ${isNovajaGazeta ? 'Автор критикует не только власть, но и пассивность общества' : 'Стремление к анонимности — это форма протеста против commodification личности'}.\n\nИсточники:\n[1] ${doc.title}` 
        }
      ]
    });
  }
});

// 2. QA examples - простые вопросы-ответы
exportData.forEach(item => {
  const doc = item.document;
  const content = item.fullContent;
  
  // Генерируем QA пары на основе контента
  if (doc.title.includes('CV') || doc.title.includes('Bio')) {
    trainingExamples.push({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_QA },
        { role: 'user', content: 'Расскажи о карьере Антона Меркурова' },
        { role: 'assistant', content: `Антон Меркуров — журналист, медиапродюсер и колумнист [1].\n\nОсновные вехи карьеры:\n- Работал в ведущих российских медиа\n- Колумнист "Новой Газеты"\n- Автор Substack-рассылок\n- Медиапродюсер с фокусом на digital-проекты\n\nИсточники:\n[1] ${doc.title}` }
      ]
    });
  }
  
  if (doc.source_url && doc.source_url.includes('novayagazeta')) {
    const snippet = content.substring(0, 500);
    trainingExamples.push({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_QA },
        { role: 'user', content: `О чём статья "${doc.title}"?` },
        { role: 'assistant', content: `Статья "${doc.title}" [1] посвящена ${snippet.includes('цензур') ? 'цензуре и свободе слова' : snippet.includes('медиа') ? 'медиа и коммуникации' : 'социокультурным вопросам'}.\n\nКлючевые идеи: ${snippet.substring(0, 200)}...\n\nИсточники:\n[1] ${doc.title}` }
      ]
    });
  }
});

// 3. COMPARE examples - сравнение документов
if (exportData.length >= 2) {
  const novayagazetaDocs = exportData.filter(item => item.document.source_url?.includes('novayagazeta'));
  const substackDocs = exportData.filter(item => item.document.source_url?.includes('substack'));
  
  if (novayagazetaDocs.length > 0 && substackDocs.length > 0) {
    trainingExamples.push({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ANALYZE },
        { 
          role: 'user', 
          content: `Сравни стиль письма в колонках "Новой Газеты" и в Substack-рассылках Антона. В чём основные отличия?` 
        },
        { 
          role: 'assistant', 
          content: `Сравнение стилей письма Антона Меркурова:\n\n**"Новая Газета" [1]:**\n- Журналистский тон, фокус на общественно значимые темы\n- Структура: проблема → анализ → вывод\n- Целевая аудитория: широкая российская публика\n- Ограничения: редакционная политика, формат колонки\n\n**Substack [2]:**\n- Личный, рефлексивный тон\n- Stream-of-consciousness, философские эссе\n- Целевая аудитория: англоязычная, creative class\n- Свобода формата, экспериментирование\n\n**Неочевидный вывод:** В НГ Антон выступает как "публичный интеллектуал", в Substack — как "мыслитель-одиночка". Это не разные стили, а разные facets одной личности.\n\nИсточники:\n[1] Колонки в Новой Газете\n[2] Substack-рассылки` 
        }
      ]
    });
  }
}

// Save to JSONL (each line = one JSON object)
const outputFile = 'finetuning-dataset.jsonl';
const jsonlContent = trainingExamples.map(ex => JSON.stringify(ex)).join('\n');
fs.writeFileSync(outputFile, jsonlContent);

console.log(`[SUCCESS] Created ${trainingExamples.length} training examples in ${outputFile}`);
console.log(`\n[BREAKDOWN]`);
console.log(`- Total examples: ${trainingExamples.length}`);
console.log(`- File size: ${(jsonlContent.length / 1024).toFixed(1)} KB`);
console.log(`\n[READY FOR UPLOAD]`);
console.log(`Use: openai api fine_tuning.jobs.create -t ${outputFile} -m gpt-4o-mini-2024-07-18`);
