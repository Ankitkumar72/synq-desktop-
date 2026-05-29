-- Compaction: Atomic Pruning & last_seq Tracking
-- Goal: 
-- 1) Binds latest sequence number (`last_seq`) to crdt_documents for race-free cold boots
-- 2) Atomically prunes old incremental crdt_note_updates records to prevent oplog bloat

BEGIN;

-- Add last_seq column if it does not already exist
ALTER TABLE public.crdt_documents 
  ADD COLUMN IF NOT EXISTS last_seq BIGINT DEFAULT NULL;

-- Redefine apply_note_crdt_update function with atomic snapshot saving & oplog pruning
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
SECURITY DEFINER
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

  -- Idempotent replay: already applied op
  IF v_seq IS NULL THEN
    SELECT u.seq INTO v_seq
    FROM public.crdt_note_updates u
    WHERE u.entity_type = 'note'
      AND u.entity_id = p_entity_id
      AND u.op_id = p_op_id
    LIMIT 1;

    RETURN QUERY SELECT FALSE, v_seq;
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

  -- Optional: keep latest snapshot hot for fast bootstrap.
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

    -- Prune old incremental updates to keep the oplog bounded!
    -- Keeps the latest 500 updates for incremental sync while discarding older ones.
    DELETE FROM public.crdt_note_updates
    WHERE entity_type = 'note'
      AND entity_id = p_entity_id
      AND seq < COALESCE((
        SELECT seq FROM public.crdt_note_updates
        WHERE entity_type = 'note' AND entity_id = p_entity_id
        ORDER BY seq DESC
        OFFSET 500
        LIMIT 1
      ), 0);
  END IF;

  RETURN QUERY SELECT TRUE, v_seq;
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
