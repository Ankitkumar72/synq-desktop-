-- 20260720072000_guard_crdt_body_overwrite.sql

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
  p_snapshot BIGINT[] DEFAULT NULL,
  p_field_versions JSONB DEFAULT NULL,
  p_plain_text TEXT DEFAULT NULL,
  p_content_markdown TEXT DEFAULT NULL,
  p_content JSONB DEFAULT NULL,
  p_client_last_sync TEXT DEFAULT NULL,
  p_allow_empty_body BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(applied BOOLEAN, seq BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
  v_new_field_versions JSONB;
  v_existing_body TEXT;
  v_final_body TEXT;
  v_final_excerpt TEXT;
  v_final_content_markdown TEXT;
  v_final_plain_text TEXT;
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

  -- Calculate new field_versions
  IF p_field_versions IS NOT NULL THEN
    SELECT COALESCE(n.field_versions, '{}'::jsonb) || p_field_versions
    INTO v_new_field_versions
    FROM public.notes n
    WHERE n.id = p_entity_id;
  ELSIF p_hlc_timestamp IS NOT NULL THEN
    SELECT COALESCE(n.field_versions, '{}'::jsonb) 
      || jsonb_build_object(
           'body', p_hlc_timestamp, 
           'excerpt', p_hlc_timestamp, 
           'plain_text', p_hlc_timestamp, 
           'content_markdown', p_hlc_timestamp
         )
    INTO v_new_field_versions
    FROM public.notes n
    WHERE n.id = p_entity_id;
  ELSE
    SELECT n.field_versions INTO v_new_field_versions
    FROM public.notes n
    WHERE n.id = p_entity_id;
  END IF;

  -- GUARD: Prevent empty document overwriting populated content
  SELECT body INTO v_existing_body FROM public.notes WHERE id = p_entity_id;
  
  -- If the incoming body is empty but the existing body is populated, 
  -- and we don't have a specific override flag, we protect the existing data.
  -- A complete deletion by the user still sends an empty body, but for safety against silent data loss,
  -- we rely on the client explicitly passing an empty body if the user intended it.
  -- In this case, we'll check if p_body is strictly empty strings/nulls when v_existing_body has data.
  IF (p_body IS NULL OR trim(p_body) = '') AND (v_existing_body IS NOT NULL AND length(trim(v_existing_body)) > 0) THEN
    -- If the client explicitly flags this as an intentional empty body, allow it.
    IF p_allow_empty_body THEN
      v_final_body := p_body;
      v_final_excerpt := p_excerpt;
      v_final_content_markdown := COALESCE(p_content_markdown, p_body);
      v_final_plain_text := COALESCE(p_plain_text, p_body);
    ELSE
      -- Protection against accidental wipe (e.g. hydration failure)
      v_final_body := v_existing_body;
      SELECT excerpt, content_markdown, plain_text INTO v_final_excerpt, v_final_content_markdown, v_final_plain_text 
      FROM public.notes WHERE id = p_entity_id;
    END IF;
  ELSE
    v_final_body := p_body;
    v_final_excerpt := p_excerpt;
    v_final_content_markdown := p_content_markdown;
    v_final_plain_text := p_plain_text;
  END IF;

  UPDATE public.notes n
  SET
    body = v_final_body,
    excerpt = v_final_excerpt,
    plain_text = COALESCE(v_final_plain_text, n.plain_text),
    content_markdown = COALESCE(v_final_content_markdown, n.content_markdown),
    content = COALESCE(p_content, n.content),
    hlc_timestamp = COALESCE(p_hlc_timestamp, n.hlc_timestamp),
    updated_at = COALESCE(p_updated_at, timezone('utc'::text, now())),
    field_versions = v_new_field_versions
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
      updated_at
    ) VALUES (
      'note',
      p_entity_id,
      p_user_id,
      p_snapshot,
      timezone('utc'::text, now())
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET
      state = EXCLUDED.state,
      updated_at = timezone('utc'::text, now());
  END IF;

  RETURN QUERY SELECT TRUE, v_seq;
END $$;
