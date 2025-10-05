import { NextResponse } from 'next/server';

import { supabase } from '@/utils/supabase/server';

export async function GET() {



  // Получаем статистику по таблицам
  const [{ count: documents }, { count: chunks }, { count: conversations }, { count: messages }] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('document_chunks').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
  ]);

  // Общая длина контента
  const { data: chunkLens } = await supabase
    .from('document_chunks')
    .select('content');
  const total_content_length = (chunkLens?.reduce((sum: number, c: { content: string }) => sum + (c.content?.length || 0), 0)) || 0;

  // Провайдеры (заглушка, если появятся поля)
  const providers_used: string[] = [];

  return NextResponse.json({
    documents,
    chunks,
    conversations,
    messages,
    total_content_length,
    providers_used,
  });
}
