-- Migration: 20260716100000_bulk_rpcs
-- Description: Implement Bulk RPCs for Tasks and Events for efficient UI operations

CREATE OR REPLACE FUNCTION public.bulk_update_tasks(
    p_task_ids UUID[],
    p_updates JSONB,
    p_hlc_timestamp TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_new_versions JSONB;
    v_key TEXT;
    v_sql TEXT;
BEGIN
    -- Build new versions object
    v_new_versions := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(p_updates) LOOP
        v_new_versions := jsonb_set(v_new_versions, ARRAY[v_key], to_jsonb(p_hlc_timestamp));
    END LOOP;

    v_sql := 'UPDATE public.tasks SET field_versions = COALESCE(field_versions, ''{}''::jsonb) || $1, hlc_timestamp = $2, updated_at = now()';

    FOR v_key IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_key IN ('title', 'description', 'status', 'priority') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = $3->>' || quote_literal(v_key);
        ELSIF v_key IN ('folder_id', 'parent_task_id') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::uuid';
        ELSIF v_key IN ('pinned', 'is_deleted') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::boolean';
        ELSIF v_key IN ('start_at', 'end_at', 'due_date') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::timestamptz';
        ELSIF v_key IN ('time_estimate') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::integer';
        ELSIF v_key IN ('order') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::double precision';
        END IF;
    END LOOP;

    v_sql := v_sql || ' WHERE id = ANY($4) AND user_id = auth.uid()';

    EXECUTE v_sql USING v_new_versions, p_hlc_timestamp, p_updates, p_task_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_delete_tasks(
    p_task_ids UUID[],
    p_hlc_timestamp TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.tasks
    SET 
        is_deleted = true,
        deleted_hlc = p_hlc_timestamp,
        hlc_timestamp = p_hlc_timestamp,
        updated_at = now(),
        field_versions = COALESCE(field_versions, '{}'::jsonb) || jsonb_build_object('is_deleted', p_hlc_timestamp, 'updated_at', p_hlc_timestamp)
    WHERE id = ANY(p_task_ids) AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_events(
    p_event_ids UUID[],
    p_updates JSONB,
    p_hlc_timestamp TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_new_versions JSONB;
    v_key TEXT;
    v_sql TEXT;
BEGIN
    v_new_versions := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(p_updates) LOOP
        v_new_versions := jsonb_set(v_new_versions, ARRAY[v_key], to_jsonb(p_hlc_timestamp));
    END LOOP;

    v_sql := 'UPDATE public.events SET field_versions = COALESCE(field_versions, ''{}''::jsonb) || $1, hlc_timestamp = $2, updated_at = now()';

    FOR v_key IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_key IN ('title', 'description', 'color', 'provider', 'provider_event_id') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = $3->>' || quote_literal(v_key);
        ELSIF v_key IN ('project_id') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::uuid';
        ELSIF v_key IN ('is_deleted') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::boolean';
        ELSIF v_key IN ('start_date', 'end_date') THEN
            v_sql := v_sql || ', ' || quote_ident(v_key) || ' = ($3->>' || quote_literal(v_key) || ')::timestamptz';
        END IF;
    END LOOP;

    v_sql := v_sql || ' WHERE id = ANY($4) AND user_id = auth.uid()';

    EXECUTE v_sql USING v_new_versions, p_hlc_timestamp, p_updates, p_event_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_delete_events(
    p_event_ids UUID[],
    p_hlc_timestamp TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.events
    SET 
        is_deleted = true,
        deleted_hlc = p_hlc_timestamp,
        hlc_timestamp = p_hlc_timestamp,
        updated_at = now(),
        field_versions = COALESCE(field_versions, '{}'::jsonb) || jsonb_build_object('is_deleted', p_hlc_timestamp, 'updated_at', p_hlc_timestamp)
    WHERE id = ANY(p_event_ids) AND user_id = auth.uid();
END;
$$;
