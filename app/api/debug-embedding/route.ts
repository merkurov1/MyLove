import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding, EMBEDDING_DIMENSION } from '@/lib/embedding-ai';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });
    
    const embedding = await getEmbedding(text);
    
    return NextResponse.json({ 
      embedding,
      dimension: EMBEDDING_DIMENSION,
      model: 'text-embedding-3-small',
      provider: 'OpenAI via Vercel AI SDK'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
