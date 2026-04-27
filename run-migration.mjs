import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
    return false;
  }

  if (!serviceKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.error('   You need to set this to run migrations. Get it from: https://app.supabase.com/project/[project-id]/settings/api');
    return false;
  }

  try {
    const migrationPath = path.join(__dirname, '003_add_crdt_documents_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Running migration: 003_add_crdt_documents_table.sql');

    // Execute SQL directly through fetch API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Migration failed:', response.status, error);
      
      console.log('\n📌 Alternative: Run migration in Supabase Dashboard');
      console.log('   1. Go to: https://app.supabase.com/project');
      console.log('   2. Click "SQL Editor"');
      console.log('   3. Click "New Query"');
      console.log('   4. Copy and paste contents of: 003_add_crdt_documents_table.sql');
      console.log('   5. Click "Run"');
      
      return false;
    }

    console.log('✅ Migration completed successfully!');
    console.log('✅ CRDT documents table has been created.');
    console.log('✅ The sync error should now be resolved.\n');
    return true;

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n📌 Alternative: Run migration in Supabase Dashboard');
    console.log('   1. Go to: https://app.supabase.com/project');
    console.log('   2. Click "SQL Editor"');
    console.log('   3. Click "New Query"');
    console.log('   4. Copy and paste contents of: 003_add_crdt_documents_table.sql');
    console.log('   5. Click "Run"');
    return false;
  }
}

runMigration().then(success => process.exit(success ? 0 : 1));
