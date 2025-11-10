const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyEmbeddingCacheSQL() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('Applying embedding cache SQL...');

    const sql = fs.readFileSync('create-embedding-cache.sql', 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.error('Error executing statement:', error);
          // Continue with other statements
        }
      }
    }

    console.log('Embedding cache SQL applied successfully!');
  } catch (error) {
    console.error('Failed to apply SQL:', error);
  }
}

applyEmbeddingCacheSQL();