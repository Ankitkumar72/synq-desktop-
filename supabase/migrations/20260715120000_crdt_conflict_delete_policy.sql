-- Add DELETE policy for crdt_conflict_log

BEGIN;

DROP POLICY IF EXISTS "Users can delete own conflict log" ON public.crdt_conflict_log;
CREATE POLICY "Users can delete own conflict log" 
  ON public.crdt_conflict_log 
  FOR DELETE 
  USING (auth.uid() = user_id);

COMMIT;
