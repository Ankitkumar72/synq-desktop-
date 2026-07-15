-- Migration: 20260717000000_sequence_id_sync
-- Description: Implement server-side sequence IDs for strict gapless sync and intent-driven hydration

BEGIN;

-- 1. Create user_sync_cursors table
CREATE TABLE IF NOT EXISTS public.user_sync_cursors (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_seq_id BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.user_sync_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cursor"
  ON public.user_sync_cursors FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Add updated_seq_id to all synced entities
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS updated_seq_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_seq_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_seq_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_seq_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS updated_seq_id BIGINT NOT NULL DEFAULT 0;

-- 3. Create Trigger Function to increment and assign sequence IDs
CREATE OR REPLACE FUNCTION public.increment_user_seq_id()
RETURNS TRIGGER AS $$
DECLARE
  v_new_seq BIGINT;
BEGIN
  -- We assume every synced table has a user_id column
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_sync_cursors (user_id, current_seq_id)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) DO UPDATE 
  SET current_seq_id = user_sync_cursors.current_seq_id + 1
  RETURNING current_seq_id INTO v_new_seq;
  
  NEW.updated_seq_id := v_new_seq;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach Trigger to Tables
DROP TRIGGER IF EXISTS trg_assign_seq_id ON public.notes;
CREATE TRIGGER trg_assign_seq_id
BEFORE INSERT OR UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.increment_user_seq_id();

DROP TRIGGER IF EXISTS trg_assign_seq_id ON public.tasks;
CREATE TRIGGER trg_assign_seq_id
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.increment_user_seq_id();

DROP TRIGGER IF EXISTS trg_assign_seq_id ON public.events;
CREATE TRIGGER trg_assign_seq_id
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.increment_user_seq_id();

DROP TRIGGER IF EXISTS trg_assign_seq_id ON public.projects;
CREATE TRIGGER trg_assign_seq_id
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.increment_user_seq_id();

DROP TRIGGER IF EXISTS trg_assign_seq_id ON public.folders;
CREATE TRIGGER trg_assign_seq_id
BEFORE INSERT OR UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.increment_user_seq_id();

-- 5. Redefine get_delta_sync to use seq_id and omit content
CREATE OR REPLACE FUNCTION public.get_delta_sync(p_last_seq_id BIGINT DEFAULT 0)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_tasks json;
  v_notes json;
  v_events json;
  v_projects json;
  v_folders json;
  v_latest_seq_id BIGINT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_tasks
  FROM public.tasks t
  WHERE t.user_id = v_user_id 
    AND t.updated_seq_id > p_last_seq_id;

  -- Skeleton sync for notes (omit content, body, plain_text, excerpt, field_versions)
  SELECT COALESCE(json_agg(
    (row_to_json(n)::jsonb - 'content' - 'body' - 'plain_text' - 'excerpt' - 'content_markdown' - 'field_versions')::json
  ), '[]'::json) INTO v_notes
  FROM public.notes n
  WHERE n.user_id = v_user_id 
    AND n.updated_seq_id > p_last_seq_id;

  SELECT COALESCE(json_agg(e), '[]'::json) INTO v_events
  FROM public.events e
  WHERE e.user_id = v_user_id 
    AND e.updated_seq_id > p_last_seq_id;

  SELECT COALESCE(json_agg(p), '[]'::json) INTO v_projects
  FROM public.projects p
  WHERE p.user_id = v_user_id 
    AND p.updated_seq_id > p_last_seq_id;

  SELECT COALESCE(json_agg(f), '[]'::json) INTO v_folders
  FROM public.folders f
  WHERE f.user_id = v_user_id 
    AND f.updated_seq_id > p_last_seq_id;

  SELECT current_seq_id INTO v_latest_seq_id
  FROM public.user_sync_cursors
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'tasks', v_tasks,
    'notes', v_notes,
    'events', v_events,
    'projects', v_projects,
    'folders', v_folders,
    'latest_seq_id', COALESCE(v_latest_seq_id, p_last_seq_id)
  );
END;
$$;

-- 6. Create get_note_content RPC for Intent-Driven Hydration
CREATE OR REPLACE FUNCTION public.get_note_content(p_note_ids UUID[])
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_contents json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', n.id,
      'content', n.content,
      'body', n.body,
      'plain_text', n.plain_text,
      'excerpt', n.excerpt,
      'content_markdown', n.content_markdown,
      'field_versions', n.field_versions
    )
  ), '[]'::json) INTO v_contents
  FROM public.notes n
  WHERE n.user_id = v_user_id
    AND n.id = ANY(p_note_ids);

  RETURN v_contents;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_note_content(UUID[]) TO authenticated;

-- Initial Backfill of updated_seq_id for existing records
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT DISTINCT user_id FROM public.notes
             UNION SELECT DISTINCT user_id FROM public.tasks
             UNION SELECT DISTINCT user_id FROM public.events
             UNION SELECT DISTINCT user_id FROM public.projects
             UNION SELECT DISTINCT user_id FROM public.folders LOOP
    
    INSERT INTO public.user_sync_cursors (user_id, current_seq_id)
    VALUES (rec.user_id, 1000)
    ON CONFLICT DO NOTHING;

    UPDATE public.notes SET updated_seq_id = 1000 WHERE user_id = rec.user_id;
    UPDATE public.tasks SET updated_seq_id = 1000 WHERE user_id = rec.user_id;
    UPDATE public.events SET updated_seq_id = 1000 WHERE user_id = rec.user_id;
    UPDATE public.projects SET updated_seq_id = 1000 WHERE user_id = rec.user_id;
    UPDATE public.folders SET updated_seq_id = 1000 WHERE user_id = rec.user_id;
  END LOOP;
END;
$$;

COMMIT;
