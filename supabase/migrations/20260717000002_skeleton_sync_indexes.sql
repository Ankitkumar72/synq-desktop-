-- Migration: 20260717000002_skeleton_sync_indexes
-- Description: Adds composite B-Tree indexes for (user_id, updated_seq_id) to all synced tables to make the Skeleton Sync RPC infinitely scalable.

BEGIN;

-- Add index to notes
CREATE INDEX IF NOT EXISTS idx_notes_sync ON public.notes(user_id, updated_seq_id);

-- Add index to tasks
CREATE INDEX IF NOT EXISTS idx_tasks_sync ON public.tasks(user_id, updated_seq_id);

-- Add index to events
CREATE INDEX IF NOT EXISTS idx_events_sync ON public.events(user_id, updated_seq_id);

-- Add index to projects
CREATE INDEX IF NOT EXISTS idx_projects_sync ON public.projects(user_id, updated_seq_id);

-- Add index to folders
CREATE INDEX IF NOT EXISTS idx_folders_sync ON public.folders(user_id, updated_seq_id);

COMMIT;
