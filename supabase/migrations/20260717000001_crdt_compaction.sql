-- Migration: 20260717000001_crdt_compaction
-- Description: Client-Driven Compaction for CRDTs (Snapshot + Delta Log Swap)

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_note_crdt_update(
  p_entity_id UUID,
  p_user_id UUID,
  p_client_id TEXT,
  p_op_id TEXT,
  p_update_data BIGINT[],
  p_body TEXT,
  p_excerpt TEXT,
  p_content JSONB DEFAULT NULL,
  p_plain_text TEXT DEFAULT NULL,
  p_content_markdown TEXT DEFAULT NULL,
  p_field_versions JSONB DEFAULT '{}'::jsonb,
  p_set_body BOOLEAN DEFAULT FALSE,
  p_set_excerpt BOOLEAN DEFAULT FALSE,
  p_set_content BOOLEAN DEFAULT FALSE,
  p_set_plain_text BOOLEAN DEFAULT FALSE,
  p_set_content_markdown BOOLEAN DEFAULT FALSE,
  p_hlc_timestamp TEXT DEFAULT NULL,
  p_updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  p_snapshot BIGINT[] DEFAULT NULL,
  p_client_last_sync TIMESTAMPTZ DEFAULT NULL
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

  -- 15-Day Epoch GC Rejection
  IF p_client_last_sync IS NOT NULL AND p_client_last_sync < (now() - interval '15 days') THEN
    RAISE EXCEPTION 'epoch_expired' USING ERRCODE = '40000', MESSAGE = 'Client has been offline beyond the 15-day GC epoch. Local cache must be wiped and resynced.';
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

  -- Update note fields based on CRDT payload
  UPDATE public.notes n
  SET
    body = CASE WHEN p_set_body THEN p_body ELSE n.body END,
    excerpt = CASE WHEN p_set_excerpt THEN p_excerpt ELSE n.excerpt END,
    content = CASE WHEN p_set_content THEN p_content ELSE n.content END,
    plain_text = CASE WHEN p_set_plain_text THEN p_plain_text ELSE n.plain_text END,
    content_markdown = CASE WHEN p_set_content_markdown THEN p_content_markdown ELSE n.content_markdown END,
    field_versions = p_field_versions,
    hlc_timestamp = COALESCE(p_hlc_timestamp, n.hlc_timestamp),
    updated_at = COALESCE(p_updated_at, timezone('utc'::text, now()))
  WHERE n.id = p_entity_id
    AND n.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found or forbidden' USING ERRCODE = '42501';
  END IF;

  -- Client-Driven Compaction (The Swap Transaction)
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

    -- Atomically DELETE all deltas that are included in this snapshot
    DELETE FROM public.crdt_note_updates
    WHERE entity_type = 'note'
      AND entity_id = p_entity_id
      AND seq <= v_seq;
  END IF;

  RETURN QUERY SELECT TRUE, v_seq;
END;
$$;

COMMIT;
