-- Migration: 20260715130000_backfill_and_constrain_notes
-- Description: Backfill legacy completed tasks from notes and add strict constraints on notes table

-- 1. Backfill to tasks for any note that has completed_at
-- (Since scheduled_time was already dropped, completed_at is the last legacy task marker)
INSERT INTO public.tasks (
  id, user_id, title, description, status,
  hlc_timestamp, is_deleted, created_at, updated_at, field_versions
)
SELECT 
  id, user_id, title, body, 'completed',
  hlc_timestamp, is_deleted, created_at, updated_at, field_versions
FROM public.notes
WHERE completed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Delete from notes where completed_at IS NOT NULL
DELETE FROM public.notes
WHERE completed_at IS NOT NULL;

-- 3. Add the constraint to prevent future legacy task shapes in notes
ALTER TABLE public.notes 
ADD CONSTRAINT notes_no_legacy_scheduling 
CHECK (completed_at IS NULL);
