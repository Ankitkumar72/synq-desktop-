-- 1. Migrate existing scheduled items from notes to events
INSERT INTO public.events (
  id, user_id, title, description, start_date, end_date, 
  hlc_timestamp, is_deleted, created_at, updated_at, field_versions
)
SELECT 
  id, user_id, title, body, scheduled_time, COALESCE(end_time, scheduled_time),
  hlc_timestamp, is_deleted, created_at, updated_at, field_versions
FROM public.notes
WHERE scheduled_time IS NOT NULL;

-- 2. Remove those items from notes (to keep notes table clean)
DELETE FROM public.notes
WHERE scheduled_time IS NOT NULL;

-- 3. Legacy Trigger: Handle insertions into 'notes' table that have a 'scheduled_time'
-- This ensures cross-client compatibility if some clients still use the old polymorphic pattern.
CREATE OR REPLACE FUNCTION public.handle_legacy_scheduled_note()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_time IS NOT NULL THEN
    -- Redirect to events table
    INSERT INTO public.events (
      id, user_id, title, description, start_date, end_date, 
      hlc_timestamp, is_deleted, created_at, updated_at, field_versions
    ) VALUES (
      NEW.id, NEW.user_id, NEW.title, NEW.body, NEW.scheduled_time, COALESCE(NEW.end_time, NEW.scheduled_time),
      NEW.hlc_timestamp, NEW.is_deleted, NEW.created_at, NEW.updated_at, NEW.field_versions
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      updated_at = EXCLUDED.updated_at;
      
    -- Since we moved it to events, we don't want it in the notes table
    -- Returning NULL in a BEFORE trigger cancels the operation on the current table
    RETURN NULL; 
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_legacy_scheduled_note ON public.notes;
CREATE TRIGGER trigger_legacy_scheduled_note
BEFORE INSERT OR UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.handle_legacy_scheduled_note();
