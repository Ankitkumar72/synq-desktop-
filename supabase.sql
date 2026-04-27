-- ============ PROFILES ============
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  plan_tier TEXT DEFAULT 'free',
  is_admin BOOLEAN DEFAULT false,
  storage_used_bytes BIGINT DEFAULT 0,
  active_device_ids TEXT[] DEFAULT '{}',
  active_devices JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============ PROJECTS ============
CREATE TABLE projects (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'bg-blue-500',
  status TEXT DEFAULT 'on-track',
  workspace_id UUID,
  hlc_timestamp TEXT,
  deleted_hlc TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ TASKS ============
CREATE TABLE tasks (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  deleted_hlc TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ NOTES ============
-- Shared between Flutter (mobile) and Web.
-- Flutter uses: body, category, priority, is_task, CRDT fields, etc.
-- Web uses: content (Tiptap/ProseMirror JSON in jsonb), pinned, excerpt.
CREATE TABLE notes (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,

  -- Web-specific fields
  -- `content` stores structured Tiptap JSON for the desktop/web editor.
  -- Legacy rows may still contain a JSON string until migrated.
  content JSONB,
  pinned BOOLEAN DEFAULT false,
  excerpt TEXT,

  -- Flutter-specific fields
  body TEXT,
  category TEXT DEFAULT 'personal',
  priority TEXT DEFAULT 'none',
  is_task BOOLEAN DEFAULT false,
  is_all_day BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  is_recurring_instance BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  attachments TEXT[] DEFAULT '{}',
  links TEXT[] DEFAULT '{}',
  subtasks JSONB DEFAULT '[]',
  color INTEGER,
  "order" INTEGER DEFAULT 0,
  folder_id TEXT,
  parent_recurring_id TEXT,
  scheduled_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  reminder_time TIMESTAMPTZ,
  original_scheduled_time TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  recurrence_rule JSONB,
  device_last_edited TEXT,

  -- CRDT sync fields (Flutter sync engine)
  hlc_timestamp TEXT,
  deleted_hlc TEXT,
  field_versions JSONB DEFAULT '{}',

  -- Shared fields
  tags TEXT[],
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notes"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN notes.content IS 'Structured Tiptap/ProseMirror JSON for the web editor. Legacy rows may contain a JSON string until migrated.';

-- ============ FOLDERS ============
-- Used by Flutter for note organization
CREATE TABLE folders (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color INTEGER,
  parent_id UUID,
  "order" INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  hlc_timestamp TEXT,
  deleted_hlc TEXT,
  field_versions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ EVENTS (Calendar) ============
CREATE TABLE events (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  color TEXT DEFAULT 'bg-blue-500',
  is_deleted BOOLEAN DEFAULT false,
  deleted_hlc TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own events"
  ON events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ ACTIVITY FEED ============
CREATE TABLE activities (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activities are viewable by team members." ON activities FOR SELECT USING (true);

-- ============ RATE LIMITING ============
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "No direct user writes" ON rate_limits FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct user updates" ON rate_limits FOR UPDATE USING (false);
CREATE POLICY "No direct user deletes" ON rate_limits FOR DELETE USING (false);

-- ============ WAITLIST ============
CREATE TABLE waitlist (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON waitlist FOR INSERT TO anon WITH CHECK (true);

-- ============ FUNCTIONS ============

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rate limit checker
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_requests INT,
  p_window_seconds INT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO rate_limits (user_id, action, count, window_start)
  VALUES (p_user_id, p_action, 1, NOW())
  ON CONFLICT (user_id, action)
  DO UPDATE SET
    count = CASE 
      WHEN NOW() > rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE 
      WHEN NOW() > rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL THEN NOW()
      ELSE rate_limits.window_start
    END
  RETURNING count, window_start INTO v_current_count, v_window_start;

  RETURN v_current_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup cron job (requires pg_cron extension enabled in Supabase)
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', $$
--   DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
-- $$);

-- ============ REALTIME CONFIGURATION ============
ALTER TABLE notes REPLICA IDENTITY FULL;
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE projects REPLICA IDENTITY FULL;
ALTER TABLE events REPLICA IDENTITY FULL;
ALTER TABLE folders REPLICA IDENTITY FULL;

-- Ensure tables are added to publication
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table notes, tasks, projects, events, folders;

-- ============ TRASH & SOFT DELETE ============

-- 1. pg_cron cleanup job (14 days)
-- Runs daily at 2am
-- SELECT cron.schedule('hard-delete-trash', '0 2 * * *', $$
--   DELETE FROM notes WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '14 days';
--   DELETE FROM folders WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '14 days';
--   DELETE FROM tasks WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '14 days';
--   DELETE FROM events WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '14 days';
--   DELETE FROM projects WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '14 days';
-- $$);

-- 2. Trash items view
CREATE OR REPLACE VIEW trash_items AS
  SELECT 
    id, 
    user_id,
    title,
    deleted_at,
    'note' AS item_type,
    14 - EXTRACT(DAY FROM NOW() - deleted_at)::INT AS days_remaining
  FROM notes 
  WHERE is_deleted = true AND deleted_at IS NOT NULL

  UNION ALL

  SELECT id, user_id, name AS title, deleted_at, 'folder' AS item_type,
    14 - EXTRACT(DAY FROM NOW() - deleted_at)::INT AS days_remaining
  FROM folders 
  WHERE is_deleted = true AND deleted_at IS NOT NULL

  UNION ALL

  SELECT id, user_id, title, deleted_at, 'task' AS item_type,
    14 - EXTRACT(DAY FROM NOW() - deleted_at)::INT AS days_remaining
  FROM tasks 
  WHERE is_deleted = true AND deleted_at IS NOT NULL

  UNION ALL

  SELECT id, user_id, title, deleted_at, 'event' AS item_type,
    14 - EXTRACT(DAY FROM NOW() - deleted_at)::INT AS days_remaining
  FROM events 
  WHERE is_deleted = true AND deleted_at IS NOT NULL

  UNION ALL

  SELECT id, user_id, name AS title, deleted_at, 'project' AS item_type,
    14 - EXTRACT(DAY FROM NOW() - deleted_at)::INT AS days_remaining
  FROM projects 
  WHERE is_deleted = true AND deleted_at IS NOT NULL;

-- 3. RLS for trash_items view
ALTER VIEW trash_items SET (security_invoker = on);

-- 4. Restore function
CREATE OR REPLACE FUNCTION restore_item(
  p_item_id UUID,
  p_item_type TEXT
)
RETURNS VOID AS $$
BEGIN
  CASE p_item_type
    WHEN 'note' THEN
      UPDATE notes SET 
        is_deleted = false, 
        deleted_at = NULL,
        deleted_hlc = NULL
      WHERE id = p_item_id AND auth.uid() = user_id;
    WHEN 'folder' THEN
      UPDATE folders SET 
        is_deleted = false,
        deleted_at = NULL,
        deleted_hlc = NULL
      WHERE id = p_item_id AND auth.uid() = user_id;
    WHEN 'task' THEN
      UPDATE tasks SET 
        is_deleted = false,
        deleted_at = NULL,
        deleted_hlc = NULL
      WHERE id = p_item_id AND auth.uid() = user_id;
    WHEN 'event' THEN
      UPDATE events SET 
        is_deleted = false,
        deleted_at = NULL,
        deleted_hlc = NULL
      WHERE id = p_item_id AND auth.uid() = user_id;
    WHEN 'project' THEN
      UPDATE projects SET 
        is_deleted = false,
        deleted_at = NULL,
        deleted_hlc = NULL
      WHERE id = p_item_id AND auth.uid() = user_id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ AUTO-UPDATE updated_at (moddatetime) ============
-- Safety net: Postgres always bumps updated_at even if the app forgets.
-- This ensures Flutter's bootstrap cursor (gt updated_at) never misses
-- mutations made by the web app or any other client.

CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE OR REPLACE TRIGGER set_updated_at_notes
  BEFORE UPDATE ON notes FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE OR REPLACE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE OR REPLACE TRIGGER set_updated_at_events
  BEFORE UPDATE ON events FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE OR REPLACE TRIGGER set_updated_at_folders
  BEFORE UPDATE ON folders FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE OR REPLACE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
