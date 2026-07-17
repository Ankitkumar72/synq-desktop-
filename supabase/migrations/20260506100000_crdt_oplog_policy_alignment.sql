-- Align CRDT op-log access with note-level visibility rules.
-- This keeps the table compatible with future shared-note policies on public.notes.

BEGIN;

ALTER TABLE public.crdt_note_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own crdt note updates" ON public.crdt_note_updates;
DROP POLICY IF EXISTS "Users can read accessible crdt note updates" ON public.crdt_note_updates;
CREATE POLICY "Users can read accessible crdt note updates"
  ON public.crdt_note_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = crdt_note_updates.entity_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own crdt note updates" ON public.crdt_note_updates;
DROP POLICY IF EXISTS "Users can insert accessible crdt note updates" ON public.crdt_note_updates;
CREATE POLICY "Users can insert accessible crdt note updates"
  ON public.crdt_note_updates FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = crdt_note_updates.entity_id
    )
  );

COMMIT;
