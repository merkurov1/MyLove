import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getEmbeddings } from '@/lib/embedding-ai';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log(`[${new Date().toISOString()}] Ingest API request started`);
  
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const sourceId = formData.get('sourceId') as string | null;
  
  if (!file) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let text = Buffer.from(arrayBuffer).toString('utf-8');
  
  // КРИТИЧЕСКОЕ: Удаляем нулевые байты и другие проблемные Unicode символы
  // PostgreSQL не поддерживает \u0000 в text полях
  text = text
    .replace(/\u0000/g, '') // Удаляем null bytes
    .replace(/[\uFFFE\uFFFF]/g, '') // Удаляем invalid Unicode
    .trim();
  
  if (!text) {
    return NextResponse.json({ error: 'Файл пустой или не удалось прочитать текст' }, { status: 400 });
  }

  console.log(`[${new Date().toISOString()}] File read, size: ${text.length} chars (cleaned)`);

  // КРИТИЧЕСКОЕ: Чанкуем с явным ограничением 2000 символов = ~500 токенов
  // OpenAI embedding limit: 8192 tokens, но мы ограничиваем чанк до 2000 для безопасности
  const chunks: string[] = splitIntoChunks(text, 2000, 200);
  if (!chunks.length) {
    return NextResponse.json({ error: 'Не удалось разбить текст на чанки' }, { status: 400 });
  }

  console.log(`[${new Date().toISOString()}] Text chunked into ${chunks.length} chunks (max 2000 chars each)`);

  try {
    // Получаем эмбеддинги для чанков через Vercel AI SDK
    console.log(`[${new Date().toISOString()}] Generating embeddings with OpenAI...`);
    const embeddings: number[][] = await getEmbeddings(chunks);
    
    if (!embeddings || embeddings.length !== chunks.length) {
      return NextResponse.json({ error: 'Ошибка получения эмбеддингов' }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Embeddings generated (${embeddings.length} vectors, dimension: ${embeddings[0]?.length})`);

    // Сохраняем документ в БД
    const { data: doc, error: docError } = await supabase.from('documents').insert({
      title: file.name,
      description: `Uploaded file: ${file.name}`,
      source_url: null,
      source_id: sourceId || process.env.DEFAULT_SOURCE_ID || 'c5aab739-7112-4360-be9e-45edf4287c42',
    }).select().single();
    
    if (docError || !doc) {
      console.error('[Ingest] Ошибка создания документа:', docError);
      return NextResponse.json({
        error: 'Ошибка создания документа',
        supabaseError: docError,
        env: {
          SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          NODE_ENV: process.env.NODE_ENV,
        },
        fileMeta: {
          name: file.name,
          size: file.size,
          type: file.type,
        }
      }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Document created: ${doc.id}`);

    // Функция очистки текста от проблемных символов для PostgreSQL
    const cleanTextForPostgres = (text: string): string => {
      return text
        .replace(/\u0000/g, '') // null bytes
        .replace(/[\uFFFE\uFFFF]/g, '') // invalid Unicode
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control characters (кроме \n \r \t)
        .trim();
    };

    // Сохраняем чанки с очисткой контента
    const chunkRows = chunks.map((content: string, i: number) => {
      const cleanedContent = cleanTextForPostgres(content);
      return {
        document_id: doc.id,
        chunk_index: i,
        content: cleanedContent,
        embedding: embeddings[i],
        checksum: crypto.createHash('sha256').update(cleanedContent).digest('hex'),
        metadata: {
          source_file: file.name,
          chunk_length: cleanedContent.length,
          embedding_model: 'text-embedding-3-small',
          embedding_dimension: embeddings[i].length,
        }
      };
    });
    
    const { error: chunkError } = await supabase.from('document_chunks').insert(chunkRows);
    if (chunkError) {
      console.error('[Ingest] Ошибка сохранения чанков:', chunkError);
      return NextResponse.json({
        error: 'Ошибка сохранения чанков',
        supabaseError: chunkError,
        chunkRowsCount: chunkRows.length,
        docId: doc.id
      }, { status: 500 });
    }

    console.log(`[${new Date().toISOString()}] Chunks saved successfully`);

    return NextResponse.json({ 
      success: true, 
      document_id: doc.id, 
      totalChunks: chunks.length,
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 1536
    });
    
  } catch (error: any) {
    console.error('[Ingest] Error:', error);
    return NextResponse.json({
      error: 'Ошибка при обработке файла',
      message: error.message
    }, { status: 500 });
  }
}
