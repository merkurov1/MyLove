import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase/server'

export async function GET() {
  // Получаем документы с их чанками
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id, 
      title, 
      description, 
      source_url, 
      created_at, 
      source_id,
      document_chunks(id, content, chunk_index)
    `)
    .order('created_at', { ascending: false })
    .limit(100)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ docs: data })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Нет id' }, { status: 400 })
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
