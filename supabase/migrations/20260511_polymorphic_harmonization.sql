-- Optimization for web_notes view (excludes events/tasks from note list)
CREATE INDEX IF NOT EXISTS idx_notes_user_web_active 
  ON public.notes(user_id, created_at) 
  WHERE (is_task = false AND scheduled_time IS NULL AND deleted_at IS NULL);

-- Optimization for calendar fetching (targets scheduled items in notes)
CREATE INDEX IF NOT EXISTS idx_notes_user_scheduled 
  ON public.notes(user_id, scheduled_time) 
  WHERE (scheduled_time IS NOT NULL AND deleted_at IS NULL);

-- Update the web_notes view to explicitly exclude scheduled items
CREATE OR REPLACE VIEW public.web_notes
WITH (security_invoker = true) AS
SELECT * FROM public.notes
WHERE COALESCE(is_task, false) = false
  AND scheduled_time IS NULL;

CREATE OR REPLACE VIEW public.web_notes_active
WITH (security_invoker = true) AS
SELECT * FROM public.notes
WHERE COALESCE(is_task, false) = false
  AND scheduled_time IS NULL
  AND deleted_at IS NULL;
