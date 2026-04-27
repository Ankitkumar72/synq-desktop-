-- Upgrade legacy note content stored as JSON strings into structured Tiptap JSON.
-- This preserves empty paragraphs/blank lines on reload for the web editor.

CREATE OR REPLACE FUNCTION public.legacy_note_text_to_tiptap_doc(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_text TEXT;
BEGIN
  normalized_text := REPLACE(COALESCE(input_text, ''), E'\r\n', E'\n');

  IF normalized_text = '' THEN
    RETURN jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'type', 'doc',
    'content',
    (
      SELECT jsonb_agg(
        CASE
          WHEN line = '' THEN jsonb_build_object('type', 'paragraph')
          ELSE jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', line
              )
            )
          )
        END
      )
      FROM unnest(string_to_array(normalized_text, E'\n')) AS line
    )
  );
END;
$$;

UPDATE notes
SET content = public.legacy_note_text_to_tiptap_doc(content #>> '{}')
WHERE content IS NOT NULL
  AND jsonb_typeof(content) = 'string';

COMMENT ON COLUMN notes.content IS 'Structured Tiptap/ProseMirror JSON for the web editor. Legacy rows should be migrated with 002_note_content_json_upgrade.sql.';
