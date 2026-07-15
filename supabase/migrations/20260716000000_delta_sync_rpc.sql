-- Migration: 20260716000000_delta_sync_rpc
-- Description: Implement get_delta_sync for cursor-based offline sync

CREATE OR REPLACE FUNCTION public.get_delta_sync(p_last_sync_at TIMESTAMPTZ DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_tasks json;
  v_notes json;
  v_events json;
  v_projects json;
  v_folders json;
  v_max_updated_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_tasks
  FROM public.tasks t
  WHERE t.user_id = v_user_id 
    AND (p_last_sync_at IS NULL OR t.updated_at > p_last_sync_at);

  -- For notes, explicitly remove heavy content blobs to keep the sync payload lightweight
  SELECT COALESCE(json_agg(
    (row_to_json(n)::jsonb - 'content' - 'body' - 'field_versions')::json
  ), '[]'::json) INTO v_notes
  FROM public.notes n
  WHERE n.user_id = v_user_id 
    AND (p_last_sync_at IS NULL OR n.updated_at > p_last_sync_at);

  SELECT COALESCE(json_agg(e), '[]'::json) INTO v_events
  FROM public.events e
  WHERE e.user_id = v_user_id 
    AND (p_last_sync_at IS NULL OR e.updated_at > p_last_sync_at);

  SELECT COALESCE(json_agg(p), '[]'::json) INTO v_projects
  FROM public.projects p
  WHERE p.user_id = v_user_id 
    AND (p_last_sync_at IS NULL OR p.updated_at > p_last_sync_at);

  SELECT COALESCE(json_agg(f), '[]'::json) INTO v_folders
  FROM public.folders f
  WHERE f.user_id = v_user_id 
    AND (p_last_sync_at IS NULL OR f.updated_at > p_last_sync_at);

  -- Find the highest updated_at across all modified records to return as the next cursor
  SELECT MAX(updated_at) INTO v_max_updated_at FROM (
    SELECT MAX(updated_at) as updated_at FROM public.tasks WHERE user_id = v_user_id AND (p_last_sync_at IS NULL OR updated_at > p_last_sync_at)
    UNION ALL
    SELECT MAX(updated_at) FROM public.notes WHERE user_id = v_user_id AND (p_last_sync_at IS NULL OR updated_at > p_last_sync_at)
    UNION ALL
    SELECT MAX(updated_at) FROM public.events WHERE user_id = v_user_id AND (p_last_sync_at IS NULL OR updated_at > p_last_sync_at)
    UNION ALL
    SELECT MAX(updated_at) FROM public.projects WHERE user_id = v_user_id AND (p_last_sync_at IS NULL OR updated_at > p_last_sync_at)
    UNION ALL
    SELECT MAX(updated_at) FROM public.folders WHERE user_id = v_user_id AND (p_last_sync_at IS NULL OR updated_at > p_last_sync_at)
  ) all_updates;

  RETURN json_build_object(
    'tasks', v_tasks,
    'notes', v_notes,
    'events', v_events,
    'projects', v_projects,
    'folders', v_folders,
    'sync_timestamp', COALESCE(v_max_updated_at, p_last_sync_at, now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_delta_sync(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delta_sync(TIMESTAMPTZ) TO authenticated;
