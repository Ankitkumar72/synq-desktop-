-- 1. Fix the Data Leak First (Activities RLS)
DROP POLICY IF EXISTS "Activities are viewable by team members." ON activities;

CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);


-- 2. Fix the Broken Folder FK in Notes
ALTER TABLE notes 
  ALTER COLUMN folder_id TYPE UUID USING folder_id::UUID;

ALTER TABLE notes
  ADD CONSTRAINT fk_notes_folder
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;


-- 3. Fix the updated_at Trigger (Currently Dead Column)
-- Enable the extension (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_updated_at_notes
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_events
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_folders
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);


-- 4. Normalize Devices Out of Profiles
CREATE TABLE devices (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web', 'desktop')),
  push_token TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own devices"
  ON devices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Then clean up profiles
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS active_device_ids,
  DROP COLUMN IF EXISTS active_devices;


-- 5. Add the Missing Indexes
-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL;

-- Notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
-- Adjusting to deleted_at because we are dropping is_deleted below
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_scheduled ON notes(user_id, scheduled_time) 
  WHERE scheduled_time IS NOT NULL;

-- Events
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_events_range ON events(start_date, end_date) 
  WHERE deleted_at IS NULL;

-- Activities
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id, created_at DESC);


-- 6. Standardize Soft Deletes (With Multi-Platform Trigger Compatibility)
-- 6.1 Ensure both columns exist for transition period
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add separate HLC for tombstone dominance
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_hlc TEXT;

-- 6.2 Create the Trigger Function to harmonize both fields
CREATE OR REPLACE FUNCTION sync_deleted_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If is_deleted changed to true, set deleted_at
  IF (NEW.is_deleted = true AND (OLD.is_deleted IS NULL OR OLD.is_deleted = false)) THEN
    NEW.deleted_at = NOW();
  -- If is_deleted changed to false, clear deleted_at
  ELSIF (NEW.is_deleted = false AND (OLD.is_deleted IS NULL OR OLD.is_deleted = true)) THEN
    NEW.deleted_at = NULL;
  -- If deleted_at was set, ensure is_deleted is true
  ELSIF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    NEW.is_deleted = true;
  -- If deleted_at was cleared, ensure is_deleted is false
  ELSIF (NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL) THEN
    NEW.is_deleted = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6.3 Apply triggers
DROP TRIGGER IF EXISTS trg_sync_deleted_notes ON notes;
CREATE TRIGGER trg_sync_deleted_notes
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION sync_deleted_status();

DROP TRIGGER IF EXISTS trg_sync_deleted_folders ON folders;
CREATE TRIGGER trg_sync_deleted_folders
  BEFORE INSERT OR UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION sync_deleted_status();

-- 6.4 Backfill existing data
UPDATE notes SET deleted_at = NOW(), is_deleted = true WHERE is_deleted = true AND deleted_at IS NULL;
UPDATE notes SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE folders SET is_deleted = false WHERE is_deleted IS NULL;


-- 6.5 Un-orphan Notes on Folder Soft Delete (Instant cleanup)
CREATE OR REPLACE FUNCTION unorphan_notes_on_folder_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true THEN
    -- Instantly un-orphan all notes in this folder
    UPDATE notes SET folder_id = NULL WHERE folder_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unorphan_notes ON folders;
CREATE TRIGGER trg_unorphan_notes
  AFTER UPDATE OF is_deleted ON folders
  FOR EACH ROW EXECUTE FUNCTION unorphan_notes_on_folder_delete();

-- 6.5b Prevent Notes from pointing to already-deleted folders (Offline insert fix)
CREATE OR REPLACE FUNCTION prevent_deleted_folder_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM folders WHERE id = NEW.folder_id AND is_deleted = true) THEN
      NEW.folder_id = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_deleted_folder_assignment ON notes;
CREATE TRIGGER trg_prevent_deleted_folder_assignment
  BEFORE INSERT OR UPDATE OF folder_id ON notes
  FOR EACH ROW EXECUTE FUNCTION prevent_deleted_folder_assignment();


-- 6.6 GDPR & Performance Hard-Delete Cleanup (90 days)
-- Ensure long-term performance and GDPR compliance
-- Make sure the pg_cron extension is enabled in your database beforehand.
-- SELECT cron.schedule('hard-delete-cleanup', '0 3 * * *', $$
--   DELETE FROM notes WHERE deleted_at < NOW() - INTERVAL '90 days' AND is_deleted = true;
--   DELETE FROM folders WHERE deleted_at < NOW() - INTERVAL '90 days' AND is_deleted = true;
-- $$);

-- 6.7 Safety Views for Web and UI Clients
-- These views abstract away the soft-delete logic for standard queries.
-- Note: The CRDT Sync engine must continue querying the base tables to pull tombstones.
CREATE OR REPLACE VIEW active_notes AS
  SELECT * FROM notes
  WHERE deleted_at IS NULL AND is_deleted = false;

CREATE OR REPLACE VIEW active_folders AS
  SELECT * FROM folders
  WHERE deleted_at IS NULL AND is_deleted = false;

-- Ensure RLS isn't bypassed and permissions are correct (Views use invoker privileges in generic queries, but good to grant)
GRANT SELECT ON active_notes TO authenticated, anon;
GRANT SELECT ON active_folders TO authenticated, anon;


-- 7. Fix the workspace_id Gap Between Projects and Tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Backfill from parent project
UPDATE tasks t
  SET workspace_id = p.workspace_id
  FROM projects p
  WHERE t.project_id = p.id;


/* -- 8. Notes Table — Practical Split (DEFERRED for sync stability)
CREATE TABLE note_content_web (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE PRIMARY KEY,
  content JSONB,
  pinned BOOLEAN DEFAULT false,
  excerpt TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE note_content_web ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own web note content"
  ON note_content_web FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM notes WHERE id = note_id)
  );

-- Then drop web-specific columns from notes
ALTER TABLE notes 
  DROP COLUMN IF EXISTS content,
  DROP COLUMN IF EXISTS pinned,
  DROP COLUMN IF EXISTS excerpt;
*/
