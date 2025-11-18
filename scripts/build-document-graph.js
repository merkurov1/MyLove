#!/usr/bin/env node
"use strict";
/**
 * scripts/build-document-graph.js
 *
 * Scans documents, computes/reads document-level embeddings and writes
 * top-K neighbor edges into `document_graph` table.
 *
 * Usage:
 *   NODE_ENV=production node scripts/build-document-graph.js
 *
 * This script uses server-side Supabase credentials from environment.
 */

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    console.error('Example:');
    console.error('  export NEXT_PUBLIC_SUPABASE_URL="https://xyzabc.supabase.co"');
    console.error('  export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"');
    process.exit(1);
  }

  // Validate URL format to provide clearer error messages than supabase client
  try {
    const parsed = new URL(url);
    if (!parsed.protocol || !parsed.hostname) throw new Error('invalid');
  } catch (e) {
    console.error('Invalid NEXT_PUBLIC_SUPABASE_URL:', url);
    console.error('It should look like: https://<project-ref>.supabase.co (no angle brackets)');
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Parameters
  const TOP_K = Number(process.env.GRAPH_TOP_K) || 10;
  const BATCH_SIZE = 100; // process documents in batches

  console.log('Starting build-document-graph: TOP_K=', TOP_K, 'BATCH_SIZE=', BATCH_SIZE);

  // 1) Get all documents that have or can derive an embedding
  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('id, title, document_embedding')
    .order('id', { ascending: true });

  if (docsErr) {
    console.error('Failed to load documents:', docsErr);
    process.exit(2);
  }

  console.log('Total documents:', docs.length);

  // Helper: ensure doc embedding exists (if not, compute from chunks average)
  async function ensureEmbedding(doc) {
    if (doc.document_embedding && Array.isArray(doc.document_embedding) && doc.document_embedding.length > 0) {
      return doc.document_embedding;
    }

    // Compute average of chunk embeddings
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('embedding')
      .eq('document_id', doc.id)
      .limit(1000);

    if (!chunks || chunks.length === 0) return null;

    // average
    const dim = chunks[0].embedding.length;
    const sum = new Array(dim).fill(0);
    let count = 0;
    for (const c of chunks) {
      if (!c.embedding) continue;
      for (let i = 0; i < dim; i++) sum[i] += c.embedding[i];
      count++;
    }
    if (count === 0) return null;
    return sum.map(v => v / count);
  }

  // Process in batches
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    console.log(`Processing documents ${i + 1}..${i + batch.length}`);

    for (const doc of batch) {
      try {
        const emb = await ensureEmbedding(doc);
        if (!emb) {
          console.warn('No embedding for doc', doc.id);
          continue;
        }

        // Find neighbors using RPC `match_documents` (assumes such RPC exists and accepts query_embedding)
        const { data: neighbors, error: neighErr } = await supabase.rpc('match_documents', {
          query_embedding: emb,
          match_count: TOP_K + 1
        });

        if (neighErr) {
          console.warn('match_documents RPC failed for', doc.id, neighErr.message || neighErr);
          continue;
        }

        if (!neighbors || neighbors.length === 0) continue;

        // Insert edges (exclude self)
        const edges = [];
        for (const n of neighbors) {
          const targetId = n.document_id || n.id;
          if (!targetId || targetId === doc.id) continue;
          const weight = n.similarity || n.score || 0;
          edges.push({ source_document_id: doc.id, target_document_id: targetId, weight, method: 'embedding' });
        }

        if (edges.length === 0) continue;

        // Upsert edges (unique index on source/target/method)
        const { error: upErr } = await supabase
          .from('document_graph')
          .upsert(edges, { onConflict: ['source_document_id', 'target_document_id', 'method'] });

        if (upErr) {
          console.error('Failed to upsert edges for', doc.id, upErr.message || upErr);
        } else {
          console.log(`Wrote ${edges.length} edges for doc ${doc.id}`);
        }

      } catch (ex) {
        console.error('Error processing doc', doc.id, ex?.message || ex);
      }
    }
  }

  console.log('Finished build-document-graph');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(99);
});
