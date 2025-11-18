// Read-only diagnostics for documents and Novaya Gazeta mentions
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('Running DB diagnostics...');

  const q1 = await supabase.from('documents').select('id').limit(1);
  console.log('Documents table access:', q1.error ? 'ERROR: ' + q1.error.message : 'OK');

  const { data: countRes, error: countErr } = await supabase.rpc('get_stats');
  if (countErr) {
    console.log('get_stats RPC error:', countErr.message);
  } else {
    console.log('DB stats:', countRes);
  }

  // Check mentions of novayagazeta in metadata or url
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: false })
    .or("metadata::text.ilike.%novayagazeta%,metadata->>'url'.ilike.%novayagazeta%")
    .limit(1);

  if (error) {
    console.log('NovayaGazeta mention check error:', error.message);
  } else {
    console.log('Documents mentioning novayagazeta (approx):', count || 'unknown');
  }

  // Sample chunks that might contain 'колонк' or 'колонка'
  const { data: chunks, error: chunksErr } = await supabase
    .from('document_chunks')
    .select('id, document_id, content')
    .or("content.ilike.%колонк%,content.ilike.%колонка%")
    .limit(20);

  if (chunksErr) {
    console.log('Chunks keyword search error:', chunksErr.message);
  } else {
    console.log('Found chunks with column keywords:', (chunks || []).length);
    for (const c of (chunks || [])) {
      console.log('---');
      console.log(c.content.substring(0, 200).replace(/\n/g, ' '));
    }
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(2); });
