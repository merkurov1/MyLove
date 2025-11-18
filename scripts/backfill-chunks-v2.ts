#!/usr/bin/env ts-node
/*
  scripts/backfill-chunks-v2.ts

  One-time migration script to re-chunk all documents using adaptiveChunkText
  and re-generate embeddings. Requires env:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - OPENAI_API_KEY

  Run with: `ts-node scripts/backfill-chunks-v2.ts` or compile to JS and run with node.
*/

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import { adaptiveChunkText } from '@/lib/chunking-v2';
import { getEmbeddings } from '@/lib/embedding-ai';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// CLI flags
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const docIndex = argv.indexOf('--doc');
const ONLY_DOC = docIndex !== -1 ? argv[docIndex + 1] : null;
const limitIndex = argv.indexOf('--limit');
const PROCESS_LIMIT = limitIndex !== -1 ? Number(argv[limitIndex + 1]) : undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function fetchAllDocumentIds(batch = 1000) {
  const { data, error } = await supabase.from('documents').select('id').limit(batch);
  if (error) throw error;
  return (data || []).map((r: any) => r.id as string);
}

async function fetchDocumentFullText(docId: string) {
  // Aggregate existing chunks' content ordered by chunk_index if available
  const { data, error } = await supabase
    .from('document_chunks')
    .select('content')
    .eq('document_id', docId)
    .order('chunk_index', { ascending: true });

  if (error) throw error;
  const text = (data || []).map((r: any) => r.content || '').join('\n\n');
  return text;
}

async function processDocument(docId: string) {
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

    // Generate embeddings in batch
    const texts = chunks.map(c => c.content);
    const embeddings = await getEmbeddings(texts);

    // Prepare new rows
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

    // Start transaction: delete old chunks, insert new ones
    const deleteRes = await supabase.from('document_chunks').delete().eq('document_id', docId);
    if (deleteRes.error) {
      console.warn('Failed to delete old chunks for', docId, (deleteRes.error as any)?.message || deleteRes.error);
    }

    // Insert in batches to avoid huge single query
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batchRows = rows.slice(i, i + BATCH);
      const { error } = await supabase.from('document_chunks').insert(batchRows);
      if (error) {
        console.error('Failed inserting chunks for doc', docId, 'error:', (error as any)?.message || error);
        return;
      }
    }

    console.log(`Finished ${docId}: inserted ${rows.length} chunks`);
  } catch (e) {
    console.error(`Error processing ${docId}:`, (e as any)?.message || String(e));
  }
}

async function main() {
  console.log('Starting backfill: adaptive chunking v2');
  // Fetch documents in pages to avoid fetching too many at once
  let offset = 0;
  const PAGE = 200;
  const limit = pLimit(4);

  while (true) {
    const { data, error } = await supabase.from('documents').select('id').order('created_at', { ascending: true }).range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    // If ONLY_DOC specified, process only that document and exit
    if (ONLY_DOC) {
      await processDocument(ONLY_DOC);
      break;
    }

    // If PROCESS_LIMIT is set, process only up to that many documents total
    let toProcess = data;
    if (typeof PROCESS_LIMIT === 'number' && PROCESS_LIMIT > 0) {
      const remaining = PROCESS_LIMIT - offset;
      if (remaining <= 0) break;
      toProcess = data.slice(0, Math.min(data.length, remaining));
    }

    await Promise.all(toProcess.map((d: any) => limit(() => processDocument(d.id))));

    offset += PAGE;
    console.log('Processed page, offset now', offset);
  }

  console.log('Backfill complete');
}

main().catch(e => {
  console.error('Fatal backfill error', (e as any)?.message || String(e));
  process.exit(1);
});
