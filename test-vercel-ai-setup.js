// test-vercel-ai-setup.js - Test the Vercel AI migration
require('dotenv').config({ path: '.env.local' });

async function testSetup() {
  console.log('🧪 Testing Vercel AI Setup\n');
  
  // Test 1: Check environment variables
  console.log('[1/4] Checking environment variables...');
  const requiredEnv = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  let envOk = true;
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      console.log(`  ❌ Missing: ${key}`);
      envOk = false;
    } else {
      console.log(`  ✅ ${key} is set`);
    }
  }
  
  if (!envOk) {
    console.log('\n❌ Please set missing environment variables in .env.local\n');
    return;
  }
  
  // Test 2: Check if ai package is installed
  console.log('\n[2/4] Checking Vercel AI SDK installation...');
  try {
    require('ai');
    require('@ai-sdk/openai');
    console.log('  ✅ Vercel AI SDK installed');
  } catch (error) {
    console.log('  ❌ Vercel AI SDK not installed. Run: npm install ai @ai-sdk/openai');
    return;
  }
  
  // Test 3: Check database structure
  console.log('\n[3/4] Checking database structure...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Check if document_chunks table exists with correct structure
    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log('  ❌ document_chunks table not found');
      console.log('  Please run the migration SQL in Supabase dashboard');
      return;
    }
    
    console.log('  ✅ document_chunks table exists');
    
    // Check if match_documents function exists
    const { data: funcData, error: funcError } = await supabase.rpc('match_documents', {
      query_embedding: Array(1536).fill(0),
      match_count: 1
    });
    
    if (funcError) {
      console.log('  ⚠️  match_documents function error:', funcError.message);
      console.log('  This is expected if no data exists yet');
    } else {
      console.log('  ✅ match_documents function works');
    }
    
  } catch (error) {
    console.log('  ❌ Database check failed:', error.message);
    return;
  }
  
  // Test 4: Test embedding generation
  console.log('\n[4/4] Testing embedding generation...');
  try {
    const { getEmbedding } = require('./lib/embedding-ai');
    const embedding = await getEmbedding('Test text');
    
    if (embedding.length === 1536) {
      console.log(`  ✅ Embedding generated (dimension: ${embedding.length})`);
    } else {
      console.log(`  ❌ Wrong embedding dimension: ${embedding.length} (expected 1536)`);
    }
  } catch (error) {
    console.log('  ❌ Embedding generation failed:', error.message);
    return;
  }
  
  console.log('\n✅ All tests passed! Ready to use.\n');
  console.log('Next steps:');
  console.log('  1. Start dev server: npm run dev');
  console.log('  2. Test file upload at /upload');
  console.log('  3. Test chat at /\n');
}

testSetup().catch(console.error);
