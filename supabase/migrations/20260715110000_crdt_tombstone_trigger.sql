-- Migration: Add Postgres triggers to enforce CRDT Tombstone Watermarks

BEGIN;

CREATE OR REPLACE FUNCTION public.crdt_tombstone_firewall()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the existing row is soft-deleted
  IF OLD.deleted_hlc IS NOT NULL THEN
    -- Check if the incoming update provides an HLC
    IF NEW.hlc_timestamp IS NOT NULL THEN
      -- If incoming HLC is causally older or concurrent to the delete, reject it entirely
      IF NEW.hlc_timestamp <= OLD.deleted_hlc THEN
        -- Log the rejection to the conflict log for audit purposes
        INSERT INTO public.crdt_conflict_log (
          entity_type, entity_id, user_id, field_name, rejected_value, incoming_hlc, winning_hlc, reason
        ) VALUES (
          TG_TABLE_NAME, NEW.id, NEW.user_id, NULL, NULL, NEW.hlc_timestamp, OLD.deleted_hlc, 'tombstone_reject'
        );
        
        -- Returning NULL in a BEFORE trigger silently drops the update without throwing a Postgres error
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all syncable tables
DROP TRIGGER IF EXISTS trg_crdt_tombstone_events ON public.events;
CREATE TRIGGER trg_crdt_tombstone_events
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.crdt_tombstone_firewall();

DROP TRIGGER IF EXISTS trg_crdt_tombstone_tasks ON public.tasks;
CREATE TRIGGER trg_crdt_tombstone_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.crdt_tombstone_firewall();

DROP TRIGGER IF EXISTS trg_crdt_tombstone_projects ON public.projects;
CREATE TRIGGER trg_crdt_tombstone_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.crdt_tombstone_firewall();

DROP TRIGGER IF EXISTS trg_crdt_tombstone_notes ON public.notes;
CREATE TRIGGER trg_crdt_tombstone_notes
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.crdt_tombstone_firewall();

DROP TRIGGER IF EXISTS trg_crdt_tombstone_folders ON public.folders;
CREATE TRIGGER trg_crdt_tombstone_folders
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.crdt_tombstone_firewall();

COMMIT;
