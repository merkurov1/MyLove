import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
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
  
    if (error) {
      console.error('[Documents GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ docs: data })
  } catch (err: any) {
    console.error('[Documents GET] Exception:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Нет id' }, { status: 400 })
    }
    
    console.log('[Documents DELETE] Deleting document:', id)
    // Attempt delete and return deleted row(s) for visibility
    // use explicit select('*') to ensure Supabase returns the deleted rows
    const { data: deleted, error, status } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .select('*')

    if (error) {
      console.error('[Documents DELETE] Error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: status || 500 })
    }

  console.log('[Documents DELETE] Deleted rows:', deleted)
  return NextResponse.json({ success: true, deleted, deletedCount: Array.isArray(deleted) ? deleted.length : 0 })
  } catch (err: any) {
    console.error('[Documents DELETE] Exception:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
