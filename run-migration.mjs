/*
 * This script intentionally does NOT execute SQL over `/rest/v1`.
 * Supabase PostgREST endpoints are not a migration engine.
 *
 * Use one of the supported paths instead:
 * 1) Supabase CLI (recommended): `supabase db push` / `supabase migration up`
 * 2) Supabase SQL Editor (manual run for a specific migration file)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultMigration = path.join(__dirname, 'supabase', 'migrations', '20260506_production_hardening.sql')

function main() {
  const migrationPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultMigration

  if (!fs.existsSync(migrationPath)) {
    console.error(`Missing migration file: ${migrationPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')
  const statementCount = sql.split(';').filter((s) => s.trim().length > 0).length

  console.error('Refusing to run migration via REST API.')
  console.error('Supabase migrations must be applied via CLI or SQL Editor.')
  console.error('')
  console.error(`Migration file: ${migrationPath}`)
  console.error(`Approx statements: ${statementCount}`)
  console.error('')
  console.error('Recommended:')
  console.error('  1) supabase login')
  console.error('  2) supabase link --project-ref <project-ref>')
  console.error('  3) supabase db push')
  console.error('')
  console.error('Manual fallback:')
  console.error('  Open Supabase Dashboard > SQL Editor > paste migration SQL > Run')
  process.exit(1)
}

main()
