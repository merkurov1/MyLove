import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getVoyageEmbeddings } from '@/lib/voyage';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const text = Buffer.from(arrayBuffer).toString('utf-8');
  if (!text.trim()) {
    return NextResponse.json({ error: 'Файл пустой или не удалось прочитать текст' }, { status: 400 });
  }


  // Чанкуем текст
  const chunks: string[] = splitIntoChunks(text);
  if (!chunks.length) {
    return NextResponse.json({ error: 'Не удалось разбить текст на чанки' }, { status: 400 });
  }

  // Получаем эмбеддинги для чанков
  const embeddings: number[][] = await getVoyageEmbeddings(chunks);
  if (!embeddings || embeddings.length !== chunks.length) {
    return NextResponse.json({ error: 'Ошибка получения эмбеддингов' }, { status: 500 });
  }

  // Сохраняем документ и чанки в БД

  const { data: doc, error: docError } = await supabase.from('documents').insert({
    title: file.name,
    description: '',
    source_url: null,
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

  const chunkRows = chunks.map((content: string, i: number) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    embedding: embeddings[i],
    checksum: crypto.createHash('sha256').update(content).digest('hex'),
  }));
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

  return NextResponse.json({ success: true, document_id: doc.id, totalChunks: chunks.length });
}
