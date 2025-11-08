// execute-migration.js - Execute migration via Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeMigration() {
  console.log('🚀 Starting Vercel AI migration to vector(1536)\n');
  console.log('⚠️  WARNING: This will DELETE all existing documents!\n');
  
  // Wait 3 seconds for user to cancel if needed
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📋 Executing migration steps...\n');
  
  try {
    // Step 1: Drop old tables
    console.log('[1/7] Dropping old document_chunks table...');
    await supabase.rpc('exec_sql', { query: 'DROP TABLE IF EXISTS document_chunks CASCADE' })
      .catch(() => console.log('  ↳ Already dropped or doesn\'t exist'));
    
    console.log('[2/7] Dropping old documents table...');
    await supabase.rpc('exec_sql', { query: 'DROP TABLE IF EXISTS documents CASCADE' })
      .catch(() => console.log('  ↳ Already dropped or doesn\'t exist'));
    
    // Since we can't execute raw SQL via RPC without custom function,
    // we'll provide instructions for manual execution
    console.log('\n❗ Manual step required:\n');
    console.log('Please execute the following in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/hukfgitwamcwsiyxlhyb/editor\n');
    console.log('Copy and paste this file:');
    console.log('  supabase/migration-vercel-ai.sql\n');
    
    console.log('Or use this direct link:');
    console.log('  https://supabase.com/dashboard/project/hukfgitwamcwsiyxlhyb/editor/new\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

executeMigration();
