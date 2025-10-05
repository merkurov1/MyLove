import { NextRequest, NextResponse } from 'next/server';
import { getVoyageEmbedding } from '@/lib/voyage';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });
    const embedding = await getVoyageEmbedding(text);
    return NextResponse.json({ embedding });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
