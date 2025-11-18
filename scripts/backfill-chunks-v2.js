#!/usr/bin/env node
/*
  scripts/backfill-chunks-v2.js
  Plain-Node version (CommonJS) so you can run with `node` without ts-node.
*/

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const pLimit = require('p-limit');
const { adaptiveChunkText } = require('../lib/chunking-v2');
const { getEmbedding } = require('../lib/embedding-ai');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const docIndex = argv.indexOf('--doc');
const ONLY_DOC = docIndex !== -1 ? argv[docIndex + 1] : null;
const limitIndex = argv.indexOf('--limit');
const PROCESS_LIMIT = limitIndex !== -1 ? Number(argv[limitIndex + 1]) : undefined;

async function fetchDocumentFullText(docId) {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('content')
    .eq('document_id', docId)
    .order('chunk_index', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => r.content || '').join('\n\n');
}

async function processDocument(docId) {
  try {
    console.log(`Processing document ${docId}`);
    const fullText = await fetchDocumentFullText(docId);
    if (!fullText || fullText.trim().length === 0) {
      console.log(`Document ${docId} has no text, skipping`);
      return;
    }

    const chunks = await adaptiveChunkText(fullText);
    if (!chunks || chunks.length === 0) {
      console.log(`No chunks produced for ${docId}, skipping`);
      return;
    }

    const texts = chunks.map(c => c.content);
    const embeddings = await Promise.all(texts.map(t => getEmbedding(t)));

    const rows = chunks.map((c, i) => ({
      document_id: docId,
      chunk_index: i,
      content: c.content,
      embedding: embeddings[i],
      chunk_type: c.semantic_tag,
      chunk_sentiment: c.sentiment,
      metadata_json: null,
      created_at: new Date().toISOString()
    }));

    if (DRY_RUN) {
      console.log(`[DRY-RUN] Would delete existing chunks for ${docId} and insert ${rows.length} new chunks`);
      return;
    }

    const deleteRes = await supabase.from('document_chunks').delete().eq('document_id', docId);
    if (deleteRes.error) console.warn('Failed to delete old chunks for', docId, deleteRes.error);

    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batchRows = rows.slice(i, i + BATCH);
      const { error } = await supabase.from('document_chunks').insert(batchRows);
      if (error) {
        console.error('Failed inserting chunks for doc', docId, 'error:', error);
        return;
      }
    }

    console.log(`Finished ${docId}: inserted ${rows.length} chunks`);
  } catch (e) {
    console.error(`Error processing ${docId}:`, e && e.message || String(e));
  }
}

async function main() {
  console.log('Starting backfill: adaptive chunking v2');
  let offset = 0;
  const PAGE = 200;
  const limit = pLimit(4);

  while (true) {
    const { data, error } = await supabase.from('documents').select('id').order('created_at', { ascending: true }).range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    if (ONLY_DOC) {
      await processDocument(ONLY_DOC);
      break;
    }

    let toProcess = data;
    if (typeof PROCESS_LIMIT === 'number' && PROCESS_LIMIT > 0) {
      const remaining = PROCESS_LIMIT - offset;
      if (remaining <= 0) break;
      toProcess = data.slice(0, Math.min(data.length, remaining));
    }

    await Promise.all(toProcess.map(d => limit(() => processDocument(d.id))));

    offset += PAGE;
    console.log('Processed page, offset now', offset);
  }

  console.log('Backfill complete');
}

main().catch(e => {
  console.error('Fatal backfill error', e && e.message || String(e));
  process.exit(1);
});
