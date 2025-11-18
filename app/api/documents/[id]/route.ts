import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, title, description, source_url, created_at, document_chunks(content, chunk_index)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Documents/:id] Error fetching document:', error);
      return NextResponse.json({ error: error.message || 'Failed to fetch' }, { status: 500 });
    }

    return NextResponse.json({ doc });
  } catch (err: any) {
    console.error('[Documents/:id] Exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
