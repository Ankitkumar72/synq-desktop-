-- Migration: Create apply_event_crdt_update RPC for robust field-level HLC conflict resolution
-- Includes Causal Tombstone watermarks and CRDT conflict logging.

CREATE OR REPLACE FUNCTION public.apply_event_crdt_update(
    p_event_id UUID,
    p_field_deltas JSONB,
    p_hlc_timestamp TEXT,
    p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_existing_event RECORD;
    v_new_field_versions JSONB;
    v_field_name TEXT;
    v_field_val JSONB;
    v_current_version TEXT;
    
    v_update_sql TEXT := '';
    v_set_clauses TEXT[] := ARRAY[]::TEXT[];
    v_has_updates BOOLEAN := FALSE;
    v_is_delete BOOLEAN := FALSE;
BEGIN
    -- Only allow users or the service role to update their own events
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- Fetch the existing event for conflict resolution (Locking it for update)
    SELECT * INTO v_existing_event 
    FROM public.events 
    WHERE id = p_event_id AND user_id = p_user_id 
    FOR UPDATE;

    IF v_existing_event IS NULL THEN
        -- It's a brand new event insert.
        v_new_field_versions := '{}'::jsonb;
        FOR v_field_name, v_field_val IN SELECT * FROM jsonb_each(p_field_deltas) LOOP
            v_new_field_versions := jsonb_set(v_new_field_versions, ARRAY[v_field_name], to_jsonb(p_hlc_timestamp));
        END LOOP;
        
        v_is_delete := COALESCE((p_field_deltas->>'is_deleted')::text = 'true', false);

        INSERT INTO public.events (
            id, user_id, 
            title, description, start_date, end_date, color,
            is_deleted, deleted_hlc, hlc_timestamp, field_versions, updated_at
        ) VALUES (
            p_event_id, p_user_id,
            p_field_deltas->>'title',
            p_field_deltas->>'description',
            (p_field_deltas->>'start_date')::timestamptz,
            (p_field_deltas->>'end_date')::timestamptz,
            p_field_deltas->>'color',
            v_is_delete,
            CASE WHEN v_is_delete THEN p_hlc_timestamp ELSE NULL END,
            p_hlc_timestamp,
            v_new_field_versions,
            now()
        );
        RETURN;
    END IF;

    -- 1) Causal Tombstone Check
    -- If the event is tombstoned, and this incoming write is older, it's a zombie edit.
    IF v_existing_event.deleted_hlc IS NOT NULL AND p_hlc_timestamp <= v_existing_event.deleted_hlc THEN
        INSERT INTO public.crdt_conflict_log (
            entity_type, entity_id, user_id, incoming_hlc, winning_hlc, reason
        ) VALUES (
            'event', p_event_id, p_user_id, p_hlc_timestamp, v_existing_event.deleted_hlc, 'tombstone_reject'
        );
        RETURN;
    END IF;

    -- Existing event found. Let's perform Field-Level LWW conflict resolution.
    v_new_field_versions := COALESCE(v_existing_event.field_versions, '{}'::jsonb);

    FOR v_field_name, v_field_val IN SELECT * FROM jsonb_each(p_field_deltas) LOOP
        -- Get the stored HLC timestamp for this specific field
        v_current_version := v_new_field_versions->>v_field_name;

        -- If incoming HLC is strictly greater than the stored HLC for this field
        IF v_current_version IS NULL OR p_hlc_timestamp > v_current_version THEN
            v_has_updates := TRUE;
            
            -- If this is a deletion edit, set the tombstone watermark
            IF v_field_name = 'is_deleted' THEN
                IF (v_field_val::text) = 'true' THEN
                    v_set_clauses := array_append(v_set_clauses, 'deleted_hlc = ' || quote_literal(p_hlc_timestamp));
                ELSE
                    -- It's an undelete
                    v_set_clauses := array_append(v_set_clauses, 'deleted_hlc = NULL');
                END IF;
            END IF;
            
            -- Update the field_versions map with the new winning timestamp
            v_new_field_versions := jsonb_set(v_new_field_versions, ARRAY[v_field_name], to_jsonb(p_hlc_timestamp));

            -- Build the dynamic SQL set clause for this winning field
            IF jsonb_typeof(v_field_val) = 'string' THEN
                -- Cast timestamps appropriately
                IF v_field_name IN ('start_date', 'end_date') THEN
                     v_set_clauses := array_append(v_set_clauses, quote_ident(v_field_name) || ' = ' || quote_literal(v_field_val#>>'{}') || '::timestamptz');
                ELSE
                     v_set_clauses := array_append(v_set_clauses, quote_ident(v_field_name) || ' = ' || quote_literal(v_field_val#>>'{}'));
                END IF;
            ELSIF jsonb_typeof(v_field_val) = 'boolean' THEN
                v_set_clauses := array_append(v_set_clauses, quote_ident(v_field_name) || ' = ' || v_field_val::text);
            ELSIF jsonb_typeof(v_field_val) = 'null' THEN
                v_set_clauses := array_append(v_set_clauses, quote_ident(v_field_name) || ' = NULL');
            ELSE
                v_set_clauses := array_append(v_set_clauses, quote_ident(v_field_name) || ' = ' || quote_literal(v_field_val::text));
            END IF;
        ELSE
            -- 2) The Conflict Log
            -- The incoming edit lost the LWW check. We log it so the user can restore it if needed.
            INSERT INTO public.crdt_conflict_log (
                entity_type, entity_id, user_id, field_name, rejected_value, incoming_hlc, winning_hlc, reason
            ) VALUES (
                'event', p_event_id, p_user_id, v_field_name, v_field_val, p_hlc_timestamp, v_current_version, 'lww_stale'
            );
        END IF;
    END LOOP;

    -- If no fields won the LWW conflict (all were stale), we do nothing and exit
    IF NOT v_has_updates THEN
        RETURN;
    END IF;

    -- Always update the global HLC timestamp and the field_versions when an update occurs
    v_set_clauses := array_append(v_set_clauses, 'hlc_timestamp = ' || quote_literal(p_hlc_timestamp));
    v_set_clauses := array_append(v_set_clauses, 'field_versions = ' || quote_literal(v_new_field_versions::text) || '::jsonb');
    v_set_clauses := array_append(v_set_clauses, 'updated_at = now()');

    -- Construct and execute the dynamic update
    v_update_sql := 'UPDATE public.events SET ' || array_to_string(v_set_clauses, ', ') || 
                    ' WHERE id = $1 AND user_id = $2';
    
    EXECUTE v_update_sql USING p_event_id, p_user_id;

END;
$$;
