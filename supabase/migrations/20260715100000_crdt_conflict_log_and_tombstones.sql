-- Migration: 1. Conflict Log & Causal Tombstones
-- Adds the crdt_conflict_log table for safely retaining rejected LWW writes.
-- Adds deleted_hlc to all core tables to serve as a causal watermark for deletes.
-- Adds partial indexes to ensure tombstone volume doesn't degrade active query performance.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Causal Tombstones: Add deleted_hlc to all soft-deletable tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;
    CREATE INDEX IF NOT EXISTS idx_tasks_active ON public.tasks (user_id) WHERE deleted_hlc IS NULL AND is_deleted = false;
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;
    CREATE INDEX IF NOT EXISTS idx_events_active ON public.events (user_id) WHERE deleted_hlc IS NULL AND is_deleted = false;
  END IF;

  IF to_regclass('public.notes') IS NOT NULL THEN
    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;
    CREATE INDEX IF NOT EXISTS idx_notes_active ON public.notes (user_id) WHERE deleted_hlc IS NULL AND is_deleted = false;
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;
    CREATE INDEX IF NOT EXISTS idx_projects_active ON public.projects (user_id) WHERE deleted_hlc IS NULL AND is_deleted = false;
  END IF;

  IF to_regclass('public.folders') IS NOT NULL THEN
    ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;
    CREATE INDEX IF NOT EXISTS idx_folders_active ON public.folders (user_id) WHERE deleted_hlc IS NULL AND is_deleted = false;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) The Conflict Log Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crdt_conflict_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- e.g., 'event', 'note', 'task', 'project'
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT,            -- NULL if entire update rejected (tombstone)
  rejected_value JSONB,
  incoming_hlc TEXT NOT NULL,
  winning_hlc TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'lww_stale', -- 'lww_stale' | 'tombstone_reject'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.crdt_conflict_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own conflict log" ON public.crdt_conflict_log;
CREATE POLICY "Users can read own conflict log" 
  ON public.crdt_conflict_log 
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conflict log" ON public.crdt_conflict_log;
CREATE POLICY "Users can insert own conflict log" 
  ON public.crdt_conflict_log 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crdt_conflict_log'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crdt_conflict_log';
    END IF;
  END IF;
END $$;

COMMIT;
