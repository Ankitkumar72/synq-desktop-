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
DECLARE
    target_table TEXT;
BEGIN
    -- 1. Determine if this is a Task or an Event based on the is_task flag
    -- Legacy mobile client might set is_task = true for scheduled items.
    IF NEW.is_task = true THEN
        INSERT INTO public.tasks (
            id, user_id, title, description, start_at, end_at, 
            hlc_timestamp, is_deleted, created_at, updated_at, field_versions,
            device_last_edited, priority, category, status
        ) VALUES (
            NEW.id, 
            COALESCE(NEW.user_id, auth.uid()), 
            NEW.title, 
            NEW.body, 
            NEW.scheduled_time, 
            COALESCE(NEW.end_time, (NEW.scheduled_time + interval '30 minutes')),
            NEW.hlc_timestamp, 
            COALESCE(NEW.is_deleted, false), 
            COALESCE(NEW.created_at, now()), 
            COALESCE(NEW.updated_at, now()), 
            NEW.field_versions,
            COALESCE(NEW.device_last_edited, 'legacy-client'),
            COALESCE(NEW.priority, 'medium'),
            COALESCE(NEW.category, 'personal'),
            CASE WHEN NEW.is_completed THEN 'completed' ELSE 'todo' END
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            hlc_timestamp = EXCLUDED.hlc_timestamp,
            field_versions = EXCLUDED.field_versions,
            updated_at = EXCLUDED.updated_at,
            device_last_edited = EXCLUDED.device_last_edited,
            status = EXCLUDED.status,
            is_deleted = EXCLUDED.is_deleted
        WHERE EXCLUDED.hlc_timestamp > tasks.hlc_timestamp 
           OR tasks.hlc_timestamp IS NULL;
           
        RETURN NULL; -- Cancel operation on notes table
    ELSE
        -- Default to Event for scheduled items without is_task flag
        INSERT INTO public.events (
            id, user_id, title, description, start_date, end_date, 
            hlc_timestamp, is_deleted, created_at, updated_at, field_versions,
            device_last_edited, color
        ) VALUES (
            NEW.id, 
            COALESCE(NEW.user_id, auth.uid()), 
            NEW.title, 
            NEW.body, 
            NEW.scheduled_time, 
            COALESCE(NEW.end_time, NEW.scheduled_time),
            NEW.hlc_timestamp, 
            COALESCE(NEW.is_deleted, false), 
            COALESCE(NEW.created_at, now()), 
            COALESCE(NEW.updated_at, now()), 
            NEW.field_versions,
            COALESCE(NEW.device_last_edited, 'legacy-client'),
            NEW.color
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            hlc_timestamp = EXCLUDED.hlc_timestamp,
            field_versions = EXCLUDED.field_versions,
            updated_at = EXCLUDED.updated_at,
            device_last_edited = EXCLUDED.device_last_edited,
            is_deleted = EXCLUDED.is_deleted,
            color = EXCLUDED.color
        WHERE EXCLUDED.hlc_timestamp > events.hlc_timestamp 
           OR events.hlc_timestamp IS NULL;
           
        RETURN NULL; -- Cancel operation on notes table
    END IF;
END;
$$ LANGUAGE plpgsql;


-- Apply trigger
DROP TRIGGER IF EXISTS trigger_legacy_scheduled_note ON public.notes;
CREATE TRIGGER trigger_legacy_scheduled_note
BEFORE INSERT OR UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.handle_legacy_scheduled_note();
