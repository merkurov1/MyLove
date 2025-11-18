import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';

export const runtime = 'nodejs';

type DocumentRow = {
  id: string;
  title?: string | null;
  source_url?: string | null;
  created_at?: string | null;
};

/**
 * GET /api/graph/documents?center=<docId>&radius=1&limit=200
 * Returns nodes and edges for a small subgraph centered at `center` document.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const center = url.searchParams.get('center');
    const radius = Number(url.searchParams.get('radius') || '1');
    const limit = Number(url.searchParams.get('limit') || '200');
    const method = url.searchParams.get('method') || null; // filter edges by method if provided
    const minWeight = Number(url.searchParams.get('min_weight') || '0');

    if (!center) {
      return NextResponse.json({ error: 'center parameter required' }, { status: 400 });
    }

    // BFS-like expansion limited by radius
    const nodesMap = new Map();
    const edges = [];
    let frontier = [center];

    for (let r = 0; r < radius; r++) {
      if (frontier.length === 0) break;
      // fetch outgoing edges from frontier
      let q = supabase
        .from('document_graph')
        .select('source_document_id, target_document_id, weight')
        .in('source_document_id', frontier)
        .gte('weight', minWeight)
        .order('weight', { ascending: false })
        .limit(limit);

      if (method) {
        q = q.eq('method', method);
      }

      const { data: outEdges } = await q;

      if (!outEdges || outEdges.length === 0) break;

      const nextFrontier = [];
      for (const e of outEdges) {
        edges.push({ source: e.source_document_id, target: e.target_document_id, weight: e.weight });
        if (!nodesMap.has(e.source_document_id)) nodesMap.set(e.source_document_id, true);
        if (!nodesMap.has(e.target_document_id)) {
          nodesMap.set(e.target_document_id, true);
          nextFrontier.push(e.target_document_id);
        }
      }
      frontier = nextFrontier;
    }

    // Ensure center is included
    nodesMap.set(center, true);

    const nodeIds = Array.from(nodesMap.keys()).slice(0, limit);
    // Fetch document metadata
    const { data: docs } = await supabase
      .from('documents')
      .select('id, title, source_url, created_at')
      .in('id', nodeIds);

    const docsList = (docs || []) as DocumentRow[];

    const nodes = docsList.map((d: DocumentRow) => ({ id: d.id, title: d.title, url: d.source_url, created_at: d.created_at }));

    return NextResponse.json({ nodes, edges });
  } catch (err: any) {
    console.error('[GRAPH API] Error', err?.message || err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
