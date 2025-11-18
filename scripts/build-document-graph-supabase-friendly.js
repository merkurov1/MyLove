// scripts/build-document-graph-supabase-friendly.js
// Usage:
//   npm ci
//   SUPABASE_URL="https://<proj>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" \
//   node scripts/build-document-graph-supabase-friendly.js
// Optional env:
//   CENTER_ID=<uuid>    // compute neighbors only for this document
//   TOP_K=50            // neighbors per document

(async () => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
    process.exit(1);
  }

  const CENTER_ID = process.env.CENTER_ID || null;
  const TOP_K = parseInt(process.env.TOP_K || '50', 10);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  function parseEmbedding(e) {
    if (!e) return null;
    if (Array.isArray(e)) return e.map(Number);
    if (typeof e === 'string') {
      const s = e.replace(/^\[|\]$/g, '');
      if (!s) return [];
      return s.split(',').map(x => parseFloat(x));
    }
    return null;
  }

  function addInto(acc, vec) {
    if (acc.length === 0) for (let i = 0; i < vec.length; i++) acc.push(0);
    for (let i = 0; i < vec.length; i++) acc[i] += (vec[i] || 0);
  }

  function scale(vec, scalar) {
    return vec.map(v => v / scalar);
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] || 0) * (b[i] || 0);
    return s;
  }

  function norm(a) {
    return Math.sqrt(dot(a, a));
  }

  function cosine(a, b) {
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return -1;
    return dot(a, b) / (na * nb);
  }

  // Fetch chunks (paged)
  console.log('Fetching document_chunks embeddings from Supabase...');
  const PAGE = 20000;
  let from = 0;
  let to = PAGE - 1;
  const docSums = new Map(); // docId -> { sum: [], count }
  let fetched = 0;

  while (true) {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('document_id,embedding')
      .range(from, to);

    if (error) {
      console.error('Error fetching document_chunks:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const docId = row.document_id;
      if (!docId) continue;
      const emb = parseEmbedding(row.embedding);
      if (!emb || emb.length === 0) continue;

      let rec = docSums.get(docId);
      if (!rec) {
        rec = { sum: Array(emb.length).fill(0), count: 0 };
        docSums.set(docId, rec);
      }
      addInto(rec.sum, emb);
      rec.count += 1;
    }

    fetched += data.length;
    console.log(`fetched rows: ${fetched}`);
    from = to + 1;
    to = from + PAGE - 1;
  }

  if (docSums.size === 0) {
    console.error('No chunk embeddings found in document_chunks.');
    process.exit(1);
  }

  console.log(`Built aggregated embeddings for ${docSums.size} documents.`);

  // Build averaged document embeddings map
  const docEmb = new Map(); // docId -> avgEmbedding
  for (const [docId, rec] of docSums.entries()) {
    const avg = scale(rec.sum, rec.count);
    docEmb.set(docId, avg);
  }
  const allDocIds = Array.from(docEmb.keys());

  const centers = CENTER_ID ? [CENTER_ID] : allDocIds;
  console.log(`Computing neighbors for ${centers.length} center(s). TOP_K=${TOP_K}`);

  for (const centerId of centers) {
    const centerEmb = docEmb.get(centerId);
    if (!centerEmb) {
      console.warn(`No embedding for center ${centerId}, skipping.`);
      continue;
    }

    const neighbors = [];
    for (const [otherId, emb] of docEmb.entries()) {
      if (otherId === centerId) continue;
      const sim = cosine(centerEmb, emb);
      neighbors.push({ id: otherId, score: sim });
    }

    neighbors.sort((a, b) => b.score - a.score);
    const top = neighbors.slice(0, TOP_K);

    if (top.length === 0) {
      console.log(`No neighbors found for ${centerId}`);
      continue;
    }

    const now = new Date().toISOString();
    const rows = top.map(n => ({
      source_document_id: centerId,
      target_document_id: n.id,
      weight: n.score,
      method: 'cosine_avg_chunks',
      created_at: now
    }));

    // Upsert using the columns that match the existing unique index
    // (source_document_id, target_document_id, method). This avoids
    // Postgres 42P10 errors when the ON CONFLICT specification doesn't
    // match an index. If upsert fails for other reasons, log the error.
    try {
      const res = await supabase
        .from('document_graph')
        .upsert(rows, { onConflict: ['source_document_id', 'target_document_id', 'method'] });
      if (res.error) {
        console.error('Upsert error for center', centerId, res.error);
      } else {
        console.log(`Inserted/updated ${rows.length} edges for center ${centerId}`);
      }
    } catch (e) {
      console.error('Unexpected upsert exception for center', centerId, e);
    }
  }

  console.log('Done.');
  process.exit(0);
})();
