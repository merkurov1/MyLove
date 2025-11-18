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
  // Split into lines and look for explicit patterns first
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidates: string[] = [];

  // Pattern: 'Колонка: TITLE' or 'Колонка — TITLE' etc
  const pattern = /колонк[аиы]?[:\-–—]\s*(.{3,200})/i;
  for (const line of lines.slice(0, 6)) {
    const m = line.match(pattern);
    if (m && m[1]) {
      candidates.push(m[1].trim());
    }
  }

  // If none found, take first meaningful line as possible title
  if (candidates.length === 0 && lines.length > 0) {
    const first = lines[0];
    if (first.length >= 4 && first.length <= 120) candidates.push(first);
  }

  // Also look for lines that start with capital letter and short
  for (const line of lines.slice(0, 6)) {
    if (line.length > 3 && line.length < 120 && /[А-ЯA-ZЁ]/.test(line[0])) {
      candidates.push(line);
    }
  }

  return candidates.map(c => c.replace(/^[^\wа-яА-Я]+|[^\wа-яА-Я]+$/g, '').trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    // Protect endpoint in production: require x-admin-token header matching ADMIN_API_TOKEN
    const provided = req.headers.get('x-admin-token');
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_API_TOKEN) {
        console.error('[EXTRACT/COLUMNS] ADMIN_API_TOKEN is not set in env on production');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
      }
      if (!provided || provided !== process.env.ADMIN_API_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const { q = '', limit = 200 } = await req.json().catch(() => ({}));

    // Build filter: always search for column-related keywords; q can further filter titles
    const keywordFilter = "%колонк%";

    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, content')
      .or(`content.ilike.${keywordFilter},content.ilike.%новая газет%`)
      .limit(limit);

    if (error) {
      console.error('[EXTRACT/COLUMNS] Supabase error:', error.message || error);
      return NextResponse.json({ error: error.message || 'Supabase error' }, { status: 500 });
    }

    const titlesMap = new Map<string, { title: string; norm: string; count: number; examples: Array<{id:string, doc:string, preview:string}> }>();

    for (const row of data || []) {
      const content: string = row.content || '';
      const candidates = extractCandidateTitles(content);
      for (const c of candidates) {
        const norm = normalizeTitle(c).slice(0, 200);
        if (!norm) continue;
        const entry = titlesMap.get(norm) || { title: c, norm, count: 0, examples: [] };
        entry.count += 1;
        if (entry.examples.length < 3) {
          entry.examples.push({ id: row.id, doc: row.document_id, preview: content.substring(0, 240) });
        }
        titlesMap.set(norm, entry);
      }
    }

    // Convert map to array, apply optional query filter
    let arr = Array.from(titlesMap.values());
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const qn = q.toLowerCase();
      arr = arr.filter(e => e.norm.includes(qn));
    }

    // Sort by frequency
    arr.sort((a, b) => b.count - a.count);

    return NextResponse.json({ count_chunks: (data||[]).length, titles: arr.slice(0, 200) });
  } catch (err: any) {
    console.error('[EXTRACT/COLUMNS] Error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
