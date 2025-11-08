/**
 * Скрипт для подготовки данных fine-tuning из загруженных документов
 * 
 * Fine-tuning позволяет "обучить" GPT на ваших данных для более точных ответов
 * 
 * Использование:
 * 1. node scripts/prepare-finetuning-data.js
 * 2. Загрузить generated-finetuning-data.jsonl в OpenAI
 * 3. Запустить fine-tuning через OpenAI API или веб-интерфейс
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateFinetuningData() {
  console.log('📚 Fetching documents from database...');
  
  // Получаем все документы с их чанками
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, description, source_url')
    .order('created_at', { ascending: false });
  
  if (!documents || documents.length === 0) {
    console.log('No documents found');
    return;
  }
  
  console.log(`Found ${documents.length} documents`);
  
  const trainingData = [];
  
  for (const doc of documents) {
    console.log(`Processing: ${doc.title}`);
    
    // Получаем чанки документа
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('content, chunk_index')
      .eq('document_id', doc.id)
      .order('chunk_index', { ascending: true });
    
    if (!chunks || chunks.length === 0) continue;
    
    // Полный текст документа
    const fullText = chunks.map(c => c.content).join('\n\n');
    
    // Генерируем обучающие примеры разных типов
    
    // 1. Вопрос о содержании
    trainingData.push({
      messages: [
        { 
          role: "system", 
          content: "Ты эксперт-ассистент, специализирующийся на анализе документов и статей." 
        },
        { 
          role: "user", 
          content: `О чем документ "${doc.title}"?` 
        },
        { 
          role: "assistant", 
          content: fullText.substring(0, 500) + "..." // Краткое содержание
        }
      ]
    });
    
    // 2. Извлечение ключевых идей
    trainingData.push({
      messages: [
        { 
          role: "system", 
          content: "Ты эксперт по извлечению ключевой информации из текстов." 
        },
        { 
          role: "user", 
          content: `Какие ключевые моменты в "${doc.title}"?` 
        },
        { 
          role: "assistant", 
          content: `Документ "${doc.title}" содержит следующую информацию:\n\n${fullText.substring(0, 800)}` 
        }
      ]
    });
    
    // 3. Связь с источником (если есть URL)
    if (doc.source_url) {
      trainingData.push({
        messages: [
          { 
            role: "system", 
            content: "Ты знаешь источники всех документов в базе." 
          },
          { 
            role: "user", 
            content: `Где опубликован "${doc.title}"?` 
          },
          { 
            role: "assistant", 
            content: `"${doc.title}" опубликован по адресу: ${doc.source_url}` 
          }
        ]
      });
    }
    
    // 4. Прямые цитаты из текста (используем разные чанки)
    const sampleChunks = chunks.slice(0, 3); // Первые 3 чанка
    sampleChunks.forEach((chunk, i) => {
      trainingData.push({
        messages: [
          { 
            role: "system", 
            content: "Ты отвечаешь цитатами из документов базы знаний." 
          },
          { 
            role: "user", 
            content: `Что написано в документе "${doc.title}"?` 
          },
          { 
            role: "assistant", 
            content: chunk.content 
          }
        ]
      });
    });
  }
  
  // Сохраняем в формате JSONL (каждая строка = JSON объект)
  const jsonlData = trainingData.map(item => JSON.stringify(item)).join('\n');
  
  fs.writeFileSync('finetuning-data.jsonl', jsonlData);
  
  console.log(`\n✅ Generated ${trainingData.length} training examples`);
  console.log('📄 Saved to: finetuning-data.jsonl');
  console.log('\n📖 Next steps:');
  console.log('1. Upload file to OpenAI: https://platform.openai.com/finetune');
  console.log('2. Create fine-tuning job with gpt-4o-mini-2024-07-18');
  console.log('3. Wait for training to complete (usually 10-30 minutes)');
  console.log('4. Update your API to use the fine-tuned model ID');
  console.log('\n💡 Tip: Fine-tuning works best with 50-100+ examples');
}

generateFinetuningData().catch(console.error);
