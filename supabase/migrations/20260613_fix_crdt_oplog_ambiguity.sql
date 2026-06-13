BEGIN;
CREATE OR REPLACE FUNCTION public.apply_note_crdt_update(
  p_entity_id UUID,
  p_user_id UUID,
  p_client_id TEXT,
  p_op_id TEXT,
  p_update_data BIGINT[],
  p_body TEXT,
  p_excerpt TEXT,
  p_hlc_timestamp TEXT DEFAULT NULL,
  p_updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  p_snapshot BIGINT[] DEFAULT NULL
)
RETURNS TABLE(applied BOOLEAN, seq BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.crdt_note_updates (
    entity_type,
    entity_id,
    user_id,
    client_id,
    op_id,
    update_data
  ) VALUES (
    'note',
    p_entity_id,
    p_user_id,
    p_client_id,
    p_op_id,
    COALESCE(p_update_data, '{}')
  )
  ON CONFLICT (entity_type, entity_id, op_id) DO NOTHING
  RETURNING crdt_note_updates.seq INTO v_seq;
  IF v_seq IS NULL THEN
    SELECT u.seq INTO v_seq
    FROM public.crdt_note_updates u
    WHERE u.entity_type = 'note'
      AND u.entity_id = p_entity_id
      AND u.op_id = p_op_id
    LIMIT 1;
    RETURN QUERY SELECT FALSE AS applied, v_seq AS seq;
    RETURN;
  END IF;
  UPDATE public.notes n
  SET
    body = p_body,
    excerpt = p_excerpt,
    hlc_timestamp = COALESCE(p_hlc_timestamp, n.hlc_timestamp),
    updated_at = COALESCE(p_updated_at, timezone('utc'::text, now()))
  WHERE n.id = p_entity_id
    AND n.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found or forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_snapshot IS NOT NULL THEN
    INSERT INTO public.crdt_documents (
      entity_type,
      entity_id,
      user_id,
      state,
      last_seq,
      updated_at
    ) VALUES (
      'note',
      p_entity_id,
      p_user_id,
      p_snapshot,
      v_seq,
      COALESCE(p_updated_at, timezone('utc'::text, now()))
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        state = EXCLUDED.state,
        last_seq = EXCLUDED.last_seq,
        updated_at = EXCLUDED.updated_at;
    DELETE FROM public.crdt_note_updates AS del_cnu
    WHERE del_cnu.entity_type = 'note'
      AND del_cnu.entity_id = p_entity_id
      AND del_cnu.seq < COALESCE((
        SELECT inner_cnu.seq
        FROM public.crdt_note_updates AS inner_cnu
        WHERE inner_cnu.entity_type = 'note'
          AND inner_cnu.entity_id = p_entity_id
        ORDER BY inner_cnu.seq DESC
        OFFSET 500
        LIMIT 1
      ), 0);
  END IF;
  RETURN QUERY SELECT TRUE AS applied, v_seq AS seq; 
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'apply_note_crdt_update failed: %', SQLSTATE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_note_crdt_update(
  UUID,
  UUID,
  TEXT,
  TEXT,
  BIGINT[],
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  BIGINT[]
) TO authenticated;
COMMIT;
