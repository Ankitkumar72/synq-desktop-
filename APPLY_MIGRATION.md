# Applying Database Migrations (Production-Safe)

Do not execute SQL through `POST /rest/v1`.
That endpoint is for PostgREST data operations, not schema migrations.

## Recommended Path (Supabase CLI)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## Manual Path (Dashboard)

1. Open Supabase Dashboard
2. Go to `SQL Editor`
3. Open `supabase/migrations/20260506_production_hardening.sql`
4. Paste and run

## Verify After Migration

Run these checks in SQL Editor:

```sql
-- Profiles policy should be owner-only
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles';

-- Expected columns
select column_name from information_schema.columns
where table_schema='public' and table_name='projects'
and column_name in ('is_favorite','field_versions','updated_at');

select column_name from information_schema.columns
where table_schema='public' and table_name='events'
and column_name in ('hlc_timestamp','field_versions');

select column_name from information_schema.columns
where table_schema='public' and table_name='tasks'
and column_name in ('field_versions');

-- Realtime publication membership
select * from pg_publication_tables
where pubname='supabase_realtime' and tablename='crdt_documents';
```
