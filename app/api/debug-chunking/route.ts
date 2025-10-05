import { NextRequest, NextResponse } from 'next/server';
import { splitIntoChunks } from '@/lib/chunking';

export async function POST(req: NextRequest) {
  try {
    const { text, maxChunkSize } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });
    const chunks = splitIntoChunks(text, maxChunkSize || 1000);
    return NextResponse.json({ chunks, count: chunks.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
