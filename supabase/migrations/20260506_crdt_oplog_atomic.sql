-- CRDT op-log + atomic note sync RPC foundation
-- Goal:
-- 1) append incremental Yjs updates with idempotency
-- 2) atomically persist note metadata + optional snapshot in one transaction

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Incremental CRDT operation log (note-focused, future-extensible)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crdt_note_updates (
  seq BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL DEFAULT 'note',
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  op_id TEXT NOT NULL,
  update_data BIGINT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (entity_type, entity_id, op_id)
);

ALTER TABLE public.crdt_note_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own crdt note updates" ON public.crdt_note_updates;
CREATE POLICY "Users can read own crdt note updates"
  ON public.crdt_note_updates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own crdt note updates" ON public.crdt_note_updates;
CREATE POLICY "Users can insert own crdt note updates"
  ON public.crdt_note_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_crdt_note_updates_entity_seq
  ON public.crdt_note_updates(entity_type, entity_id, seq);

CREATE INDEX IF NOT EXISTS idx_crdt_note_updates_user_created
  ON public.crdt_note_updates(user_id, created_at DESC);

-- Add op-log table to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'crdt_note_updates'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crdt_note_updates';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Atomic apply RPC
--    - Idempotent by (entity_id, op_id)
--    - Updates notes metadata and optional snapshot in one transaction
-- ---------------------------------------------------------------------------
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
      updated_at
    ) VALUES (
      'note',
      p_entity_id,
      p_user_id,
      p_snapshot,
      COALESCE(p_updated_at, timezone('utc'::text, now()))
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        state = EXCLUDED.state,
        updated_at = EXCLUDED.updated_at;
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

-- ---------------------------------------------------------------------------
-- 3) Catch-up RPC for missed incremental operations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_note_crdt_updates(
  p_entity_id UUID,
  p_after_seq BIGINT DEFAULT 0,
  p_limit INT DEFAULT 500
)
RETURNS TABLE(
  seq BIGINT,
  op_id TEXT,
  client_id TEXT,
  update_data BIGINT[],
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    u.seq,
    u.op_id,
    u.client_id,
    u.update_data,
    u.created_at
  FROM public.crdt_note_updates u
  WHERE u.entity_type = 'note'
    AND u.entity_id = p_entity_id
    AND u.seq > COALESCE(p_after_seq, 0)
  ORDER BY u.seq ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000));
$$;

GRANT EXECUTE ON FUNCTION public.get_note_crdt_updates(UUID, BIGINT, INT) TO authenticated;

COMMIT;
