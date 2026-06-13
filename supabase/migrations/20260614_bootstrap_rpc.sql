CREATE OR REPLACE FUNCTION public.get_bootstrap_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_tasks json;
    v_notes json;
    v_events json;
    v_projects json;
    v_folders json;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Fetch active records for the authenticated user
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_tasks 
    FROM public.tasks t 
    WHERE t.user_id = v_user_id AND (t.is_deleted = false OR t.is_deleted IS NULL);

    SELECT COALESCE(json_agg(n), '[]'::json) INTO v_notes 
    FROM public.notes n 
    WHERE n.user_id = v_user_id AND (n.is_task = false OR n.is_task IS NULL) AND (n.is_deleted = false OR n.is_deleted IS NULL);

    SELECT COALESCE(json_agg(e), '[]'::json) INTO v_events 
    FROM public.events e 
    WHERE e.user_id = v_user_id AND (e.is_deleted = false OR e.is_deleted IS NULL);

    SELECT COALESCE(json_agg(p), '[]'::json) INTO v_projects 
    FROM public.projects p 
    WHERE p.user_id = v_user_id AND (p.is_deleted = false OR p.is_deleted IS NULL);

    SELECT COALESCE(json_agg(f), '[]'::json) INTO v_folders 
    FROM public.folders f 
    WHERE f.user_id = v_user_id AND (f.is_deleted = false OR f.is_deleted IS NULL);

    RETURN json_build_object(
        'tasks', v_tasks,
        'notes', v_notes,
        'events', v_events,
        'projects', v_projects,
        'folders', v_folders
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bootstrap_data() TO authenticated;
