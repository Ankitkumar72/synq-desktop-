-- Migration: 20260717083338_fix_initial_sequence_sync
-- Description: Fix get_delta_sync to return legacy records when seq_id is 0

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
    AND (p_last_seq_id = 0 OR t.updated_seq_id > p_last_seq_id);

  -- Skeleton sync for notes (omit content, body, plain_text, excerpt, field_versions)
  SELECT COALESCE(json_agg(
    (row_to_json(n)::jsonb - 'content' - 'body' - 'plain_text' - 'excerpt' - 'content_markdown' - 'field_versions')::json
  ), '[]'::json) INTO v_notes
  FROM public.notes n
  WHERE n.user_id = v_user_id 
    AND (p_last_seq_id = 0 OR n.updated_seq_id > p_last_seq_id);

  SELECT COALESCE(json_agg(e), '[]'::json) INTO v_events
  FROM public.events e
  WHERE e.user_id = v_user_id 
    AND (p_last_seq_id = 0 OR e.updated_seq_id > p_last_seq_id);

  SELECT COALESCE(json_agg(p), '[]'::json) INTO v_projects
  FROM public.projects p
  WHERE p.user_id = v_user_id 
    AND (p_last_seq_id = 0 OR p.updated_seq_id > p_last_seq_id);

  SELECT COALESCE(json_agg(f), '[]'::json) INTO v_folders
  FROM public.folders f
  WHERE f.user_id = v_user_id 
    AND (p_last_seq_id = 0 OR f.updated_seq_id > p_last_seq_id);

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
