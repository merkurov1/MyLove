import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const { error } = await supabase.from('documents').delete().eq('id', id)
    
    if (error) {
      console.error('[Documents DELETE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Documents DELETE] Exception:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
