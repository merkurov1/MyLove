import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';

export const runtime = 'nodejs';

function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/["'“”«»]/g, '')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCandidateTitles(content: string): string[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidates: string[] = [];
  const pattern = /колонк[аиы]?[:\-–—]\s*(.{3,200})/i;
  for (const line of lines.slice(0, 6)) {
    const m = line.match(pattern);
    if (m && m[1]) candidates.push(m[1].trim());
  }
  if (candidates.length === 0 && lines.length > 0) {
    const first = lines[0];
    if (first.length >= 4 && first.length <= 120) candidates.push(first);
  }
  for (const line of lines.slice(0, 6)) {
    if (line.length > 3 && line.length < 120 && /[А-ЯA-ZЁ]/.test(line[0])) candidates.push(line);
  }
  return candidates.map(c => c.replace(/^[^\wа-яА-Я]+|[^\wа-яА-Я]+$/g, '').trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    // Allow only same-origin in production to reduce exposure
    if (process.env.NODE_ENV === 'production') {
      const origin = req.headers.get('origin') || req.headers.get('referer') || '';
      if (!origin.includes('pierrot.merkurov.love')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { q = '', limit = 400 } = await req.json().catch(() => ({}));

    const keywordFilter = "%колонк%";
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, content')
      .or(`content.ilike.${keywordFilter},content.ilike.%новая газет%`)
      .limit(limit);

    if (error) {
      console.error('[ADMIN/EXTRACT] Supabase error:', error.message || error);
      return NextResponse.json({ error: error.message || 'Supabase error' }, { status: 500 });
    }

    const titlesMap = new Map();
    for (const row of data || []) {
      const content = row.content || '';
      const candidates = extractCandidateTitles(content);
      for (const c of candidates) {
        const norm = normalizeTitle(c).slice(0, 200);
        if (!norm) continue;
        const entry = titlesMap.get(norm) || { title: c, norm, count: 0, examples: [] };
        entry.count += 1;
        if (entry.examples.length < 3) entry.examples.push({ id: row.id, doc: row.document_id, preview: content.substring(0, 240) });
        titlesMap.set(norm, entry);
      }
    }

    let arr = Array.from(titlesMap.values());
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const qn = q.toLowerCase();
      arr = arr.filter(e => e.norm.includes(qn));
    }
    arr.sort((a, b) => b.count - a.count);

    return NextResponse.json({ count_chunks: (data||[]).length, titles: arr.slice(0, 200) });
  } catch (err: any) {
    console.error('[ADMIN/EXTRACT] Error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
