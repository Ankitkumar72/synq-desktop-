-- Production hardening: security + schema drift + realtime publication alignment

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Security: lock down profiles (remove public read of PII)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile." ON public.profiles;
CREATE POLICY "Users can view own profile."
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2) Schema drift: add columns app already writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_versions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS field_versions JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hlc_timestamp TEXT,
  ADD COLUMN IF NOT EXISTS field_versions JSONB DEFAULT '{}'::jsonb;

UPDATE public.projects
SET
  is_favorite = COALESCE(is_favorite, false),
  field_versions = COALESCE(field_versions, '{}'::jsonb),
  updated_at = COALESCE(updated_at, created_at, timezone('utc'::text, now()))
WHERE is_favorite IS NULL OR field_versions IS NULL OR updated_at IS NULL;

UPDATE public.tasks
SET field_versions = COALESCE(field_versions, '{}'::jsonb)
WHERE field_versions IS NULL;

UPDATE public.events
SET field_versions = COALESCE(field_versions, '{}'::jsonb)
WHERE field_versions IS NULL;

-- Keep defaults explicit for future rows
ALTER TABLE public.projects
  ALTER COLUMN is_favorite SET DEFAULT false,
  ALTER COLUMN field_versions SET DEFAULT '{}'::jsonb,
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

ALTER TABLE public.tasks
  ALTER COLUMN field_versions SET DEFAULT '{}'::jsonb;

ALTER TABLE public.events
  ALTER COLUMN field_versions SET DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 3) updated_at safety net for projects
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON public.projects FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- 4) Realtime alignment: ensure crdt_documents is published
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'crdt_documents'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'crdt_documents'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crdt_documents';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Helpful indexes for sync-heavy paths
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_user_updated_at
  ON public.projects(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_user_updated_at
  ON public.tasks(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_user_updated_at
  ON public.events(user_id, updated_at DESC);

COMMIT;
