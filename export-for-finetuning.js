// Export documents from Supabase for fine-tuning
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
  console.log('[EXPORT] Fetching all documents...');
  
  // 1. Get all documents
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (docError) {
    console.error('[ERROR] Failed to fetch documents:', docError);
    process.exit(1);
  }
  
  console.log(`[EXPORT] Found ${documents.length} documents`);
  
  // 2. Get all chunks for each document
  const exportData = [];
  
  for (const doc of documents) {
    console.log(`[EXPORT] Processing document: ${doc.title}`);
    
    const { data: chunks, error: chunkError } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', doc.id)
      .order('chunk_index', { ascending: true });
    
    if (chunkError) {
      console.error(`[ERROR] Failed to fetch chunks for ${doc.id}:`, chunkError);
      continue;
    }
    
    exportData.push({
      document: {
        id: doc.id,
        title: doc.title,
        source_url: doc.source_url,
        metadata: doc.metadata,
        created_at: doc.created_at
      },
      chunks: chunks.map(c => ({
        id: c.id,
        content: c.content,
        chunk_index: c.chunk_index,
        metadata: c.metadata
      })),
      fullContent: chunks.map(c => c.content).join('\n\n')
    });
  }
  
  // 3. Save to JSON file
  const outputFile = 'finetuning-export.json';
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
  console.log(`[SUCCESS] Exported ${exportData.length} documents to ${outputFile}`);
  
  // 4. Print statistics
  const totalChunks = exportData.reduce((sum, item) => sum + item.chunks.length, 0);
  const avgChunksPerDoc = (totalChunks / exportData.length).toFixed(1);
  
  console.log('\n[STATISTICS]');
  console.log(`Total documents: ${exportData.length}`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Average chunks per document: ${avgChunksPerDoc}`);
  
  // List documents
  console.log('\n[DOCUMENTS]');
  exportData.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.document.title} (${item.chunks.length} chunks, ${item.fullContent.length} chars)`);
  });
}

exportData().catch(err => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
