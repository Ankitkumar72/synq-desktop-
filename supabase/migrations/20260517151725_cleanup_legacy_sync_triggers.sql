-- Migration: 20260517_cleanup_legacy_sync_triggers
-- Description: Drop legacy polymorphic sync triggers to prevent ghost rows

-- 1. Drop the legacy triggers from notes, tasks, and events tables
DROP TRIGGER IF EXISTS trg_sync_task_to_note ON public.tasks;
DROP TRIGGER IF EXISTS trg_sync_event_to_note ON public.events;
DROP TRIGGER IF EXISTS trigger_legacy_note_redirection ON public.notes;
DROP TRIGGER IF EXISTS trigger_legacy_scheduled_note ON public.notes;

-- 2. Drop the associated legacy functions (if they are no longer used by anything else)
DROP FUNCTION IF EXISTS public.sync_task_to_note();
DROP FUNCTION IF EXISTS public.sync_event_to_note();
DROP FUNCTION IF EXISTS public.handle_legacy_note_redirection();
DROP FUNCTION IF EXISTS public.handle_legacy_scheduled_note();

-- 3. Clean up ghost rows in notes that duplicate tasks or events
DELETE FROM public.notes 
WHERE id IN (
  SELECT id FROM public.tasks 
  UNION 
  SELECT id FROM public.events
);
