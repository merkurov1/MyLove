// scripts/print-document-graph-diagnostics.js
// Usage:
//   npm ci
//   SUPABASE_URL="https://<proj>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<KEY>" \
//   node scripts/print-document-graph-diagnostics.js
// Optional env: CENTER_ID (UUID) to inspect a specific center document

(async () => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
    process.exit(1);
  }

  const CENTER_ID = process.env.CENTER_ID || null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  function print(title) {
    console.log('\n===== ' + title + ' =====');
  }

  // 1. edges count and columns
  print('Edges count and document_graph columns');
  const { data: colInfo } = await supabase
    .from('information_schema.columns')
    .select('column_name,data_type')
    .eq('table_name', 'document_graph')
    .order('ordinal_position', { ascending: true });
  console.table(colInfo || []);

  const { data: countRows, error: countErr } = await supabase
    .from('document_graph')
    .select('id', { count: 'exact', head: true });
  if (countErr) console.error('count error', countErr);
  else console.log('edges_count (approx):', countRows?.length ?? 0);

  // 2. sample edges
  print('Sample edges (most recent 50)');
  const { data: sampleEdges, error: sampleErr } = await supabase
    .from('document_graph')
    .select('source_document_id,target_document_id,weight,method,created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (sampleErr) console.error('sample edges error', sampleErr);
  else console.table(sampleEdges || []);

  // 3a/3b center neighbors
  if (CENTER_ID) {
    print('Outgoing edges FROM center ' + CENTER_ID);
    const { data: outEdges, error: outErr } = await supabase
      .from('document_graph')
      .select('source_document_id,target_document_id,weight,method')
      .eq('source_document_id', CENTER_ID)
      .order('weight', { ascending: false })
      .limit(200);
    if (outErr) console.error('outgoing error', outErr);
    else console.table(outEdges || []);

    print('Incoming edges TO center ' + CENTER_ID);
    const { data: inEdges, error: inErr } = await supabase
      .from('document_graph')
      .select('source_document_id,target_document_id,weight,method')
      .eq('target_document_id', CENTER_ID)
      .order('weight', { ascending: false })
      .limit(200);
    if (inErr) console.error('incoming error', inErr);
    else console.table(inEdges || []);
  } else {
    print('No CENTER_ID provided; skipping per-center queries.');
  }

  // 4. Nodes without corresponding documents (sources)
  print('Nodes without corresponding documents (sources)');
  const { data: srcIds } = await supabase
    .from('document_graph')
    .select('source_document_id')
    .limit(100);
  const srcList = (srcIds || []).map(r => r.source_document_id).filter(Boolean);
  if (srcList.length) {
    const { data: docs } = await supabase.from('documents').select('id').in('id', srcList);
    const docSet = new Set((docs || []).map(d => d.id));
    const missing = srcList.filter(id => !docSet.has(id));
    console.table(missing.slice(0,50).map(id => ({ missing_id: id })));
  } else {
    console.log('no source ids found');
  }

  // 5. Top sources by out-degree (simple fallback)
  print('Top sources by out-degree (computed)');
  const { data: all, error: allErr } = await supabase.from('document_graph').select('source_document_id');
  if (allErr) console.error('top sources error', allErr);
  else {
    const counts = {};
    (all || []).forEach(r => counts[r.source_document_id] = (counts[r.source_document_id] || 0) + 1);
    const arr = Object.entries(counts).map(([id,c]) => ({ id, out_deg: c })).sort((a,b)=>b.out_deg-a.out_deg).slice(0,20);
    console.table(arr);
  }

  // 6b: neighbor metadata for center
  if (CENTER_ID) {
    print('Neighbor metadata for center ' + CENTER_ID);
    const { data: neighbors } = await supabase
      .from('document_graph')
      .select('target_document_id')
      .eq('source_document_id', CENTER_ID)
      .limit(500);
    const neighborIds = (neighbors || []).map(r => r.target_document_id).filter(Boolean);
    if (neighborIds.length) {
      const { data: meta, error: metaErr } = await supabase
        .from('documents')
        .select('id,title,source_url,created_at')
        .in('id', neighborIds)
        .limit(500);
      if (metaErr) console.error('metaErr', metaErr);
      else console.table(meta || []);
    } else {
      console.log('No neighbors found for center.');
    }
  }

  // 7: center document embedding presence
  if (CENTER_ID) {
    print('Center document embedding presence');
    const { data: docData, error: docErr } = await supabase
      .from('documents')
      .select('id,document_embedding,created_at,title')
      .eq('id', CENTER_ID)
      .limit(1)
      .single();
    if (docErr) console.error('docErr', docErr);
    else {
      console.log({ id: docData.id, has_embedding: !!docData.document_embedding, created_at: docData.created_at, title: docData.title });
    }
  }

  console.log('\nDiagnostics complete');
  process.exit(0);
})();
