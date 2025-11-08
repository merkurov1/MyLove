// run-migration.js - Execute SQL migration using pg client
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

// Construct PostgreSQL connection string from Supabase URL
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

// You need to set this - get it from Supabase dashboard
// Dashboard -> Settings -> Database -> Connection string -> URI
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'YOUR_DB_PASSWORD_HERE';

const connectionString = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

async function runMigration() {
  console.log('🚀 Applying Vercel AI migration to Supabase\n');
  console.log('Project:', projectRef);
  console.log('⚠️  WARNING: This will DELETE all existing documents!\n');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');
    
    const sql = fs.readFileSync('./supabase/migration-vercel-ai.sql', 'utf8');
    
    console.log('Executing migration...');
    await client.query(sql);
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Update API routes to use new embedding-ai.ts');
    console.log('  2. Test document upload');
    console.log('  3. Test search functionality\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\nPlease execute manually in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/' + projectRef + '/editor\n');
  } finally {
    await client.end();
  }
}

// Check if DB_PASSWORD is set
if (!process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD === 'YOUR_DB_PASSWORD_HERE') {
  console.log('❌ SUPABASE_DB_PASSWORD not set in .env.local\n');
  console.log('To get your database password:');
  console.log('  1. Go to https://supabase.com/dashboard/project/' + projectRef + '/settings/database');
  console.log('  2. Find "Database password" section');
  console.log('  3. Reset password if needed');
  console.log('  4. Add to .env.local: SUPABASE_DB_PASSWORD=your_password\n');
  console.log('OR execute manually in SQL Editor:');
  console.log('  https://supabase.com/dashboard/project/' + projectRef + '/editor\n');
  process.exit(1);
}

runMigration();
