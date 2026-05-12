-- Backend consistency fixes for cross-platform Task/Note separation,
-- soft-delete normalization, and schedule precision support.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Add timestamp scheduling fields for tasks (hour-block support)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

    -- Backfill existing rows from date-only due_date.
    -- Uses UTC midnight as a deterministic fallback and 30m default duration.
    UPDATE public.tasks
    SET start_at = (due_date::timestamp AT TIME ZONE 'UTC')
    WHERE start_at IS NULL
      AND due_date IS NOT NULL;

    UPDATE public.tasks
    SET end_at = start_at + INTERVAL '30 minutes'
    WHERE end_at IS NULL
      AND start_at IS NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'tasks_end_after_start_chk'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_end_after_start_chk
        CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);
    END IF;

    CREATE INDEX IF NOT EXISTS idx_tasks_user_start_at_active
      ON public.tasks(user_id, start_at)
      WHERE deleted_at IS NULL;
  ELSE
    RAISE NOTICE 'Skipping tasks scheduling migration: public.tasks does not exist';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Normalize soft-delete semantics across tables used by realtime clients
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_deleted_status_generic()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_deleted, false) = true AND NEW.deleted_at IS NULL THEN
      NEW.deleted_at = NOW();
    ELSIF COALESCE(NEW.is_deleted, false) = false AND NEW.deleted_at IS NOT NULL THEN
      NEW.is_deleted = true;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_deleted = true AND COALESCE(OLD.is_deleted, false) = false THEN
    NEW.deleted_at = COALESCE(NEW.deleted_at, NOW());
  ELSIF NEW.is_deleted = false AND COALESCE(OLD.is_deleted, false) = true THEN
    NEW.deleted_at = NULL;
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.is_deleted = true;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    NEW.is_deleted = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_tasks ON public.tasks';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_tasks
      BEFORE INSERT OR UPDATE ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  ELSE
    RAISE NOTICE 'Skipping task soft-delete trigger: public.tasks does not exist';
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_events ON public.events';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_events
      BEFORE INSERT OR UPDATE ON public.events
      FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  ELSE
    RAISE NOTICE 'Skipping event soft-delete trigger: public.events does not exist';
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_projects ON public.projects';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_projects
      BEFORE INSERT OR UPDATE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  ELSE
    RAISE NOTICE 'Skipping project soft-delete trigger: public.projects does not exist';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Add canonical web-note views that exclude mobile task-like note rows
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.web_notes
      WITH (security_invoker = true) AS
      SELECT * FROM public.notes
      WHERE COALESCE(is_task, false) = false';

    EXECUTE 'CREATE OR REPLACE VIEW public.web_notes_active
      WITH (security_invoker = true) AS
      SELECT * FROM public.notes
      WHERE COALESCE(is_task, false) = false
        AND deleted_at IS NULL';

    EXECUTE 'GRANT SELECT ON public.web_notes TO authenticated';
    EXECUTE 'GRANT SELECT ON public.web_notes_active TO authenticated';
  ELSE
    RAISE NOTICE 'Skipping web_notes views: public.notes does not exist';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Ensure realtime publication includes the core synced tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF to_regclass('public.tasks') IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tasks'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
    END IF;

    IF to_regclass('public.notes') IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notes'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notes';
    END IF;

    IF to_regclass('public.events') IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'events'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events';
    END IF;

    IF to_regclass('public.projects') IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'projects'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projects';
    END IF;
  END IF;
END $$;

COMMIT;
