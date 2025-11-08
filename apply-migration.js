// apply-migration.js - Apply SQL migration to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🚀 Applying Vercel AI migration...\n');
  
  // Read the migration SQL
  const sql = fs.readFileSync('./supabase/migration-vercel-ai.sql', 'utf8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements to execute\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing...`);
    
    try {
      // Use Supabase's RPC or direct query if available
      // Since we can't execute raw SQL directly, we'll use psql
      console.log('⚠️  Note: Please execute the SQL file manually in Supabase dashboard');
      console.log('Or use: psql <connection_string> -f supabase/migration-vercel-ai.sql\n');
      break;
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
  }
}

console.log('📝 To apply this migration, run ONE of the following:\n');
console.log('Option 1: Supabase Dashboard');
console.log('  1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/editor');
console.log('  2. Copy contents of supabase/migration-vercel-ai.sql');
console.log('  3. Paste and run in SQL Editor\n');

console.log('Option 2: Command line (if you have connection string)');
console.log('  psql "postgresql://..." -f supabase/migration-vercel-ai.sql\n');

console.log('Option 3: Using Supabase CLI');
console.log('  supabase db push\n');
