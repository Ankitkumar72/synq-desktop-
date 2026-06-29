-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
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

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'bg-blue-500',
  status TEXT DEFAULT 'on-track',
  workspace_id UUID,
  hlc_timestamp TEXT,
  field_versions JSONB DEFAULT '{}'::jsonb,
  is_favorite BOOLEAN DEFAULT false,
  deleted_hlc TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  field_versions JSONB DEFAULT '{}'::jsonb,
  deleted_hlc TEXT,
  hlc_timestamp TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB,
  pinned BOOLEAN DEFAULT false,
  excerpt TEXT,
  body TEXT,
  content_markdown TEXT,
  category TEXT DEFAULT 'personal',
  priority TEXT DEFAULT 'none',
  is_task BOOLEAN DEFAULT false,
  is_all_day BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  is_recurring_instance BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  attachments TEXT[] DEFAULT '{}',
  links TEXT[] DEFAULT '{}',
  subtasks JSONB DEFAULT '[]'::jsonb,
  color INTEGER,
  "order" INTEGER DEFAULT 0,
  folder_id UUID,
  parent_recurring_id TEXT,
  scheduled_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  reminder_time TIMESTAMPTZ,
  original_scheduled_time TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  recurrence_rule JSONB,
  device_last_edited TEXT,
  hlc_timestamp TEXT,
  deleted_hlc TEXT,
  field_versions JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

COMMENT ON COLUMN public.notes.content IS 'Structured Tiptap/ProseMirror JSON for the web editor. Legacy rows may contain a JSON string until migrated.';

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color INTEGER,
  parent_id UUID,
  "order" INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  hlc_timestamp TEXT,
  deleted_hlc TEXT,
  field_versions JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  color TEXT DEFAULT 'bg-blue-500',
  hlc_timestamp TEXT,
  field_versions JSONB DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN DEFAULT false,
  deleted_hlc TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web', 'desktop')),
  push_token TEXT,
  last_active_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, action)
);

-- CRDT oplog tables: notes use Yjs CRDT; other entities use LWW via hlc_timestamp + field_versions
CREATE TABLE IF NOT EXISTS public.crdt_documents (
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state BIGINT[] NOT NULL DEFAULT '{}',
  last_seq BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (entity_type, entity_id)
);

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

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'notes'
      AND constraint_name = 'fk_notes_folder'
  ) THEN
    ALTER TABLE public.notes
    ADD CONSTRAINT fk_notes_folder
    FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crdt_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crdt_note_updates ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Users can view own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Projects
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notes
DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
CREATE POLICY "Users can manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Folders
DROP POLICY IF EXISTS "Users can manage own folders" ON public.folders;
CREATE POLICY "Users can manage own folders" ON public.folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Events
DROP POLICY IF EXISTS "Users can manage own events" ON public.events;
CREATE POLICY "Users can manage own events" ON public.events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Devices
DROP POLICY IF EXISTS "Users can manage own devices" ON public.devices;
CREATE POLICY "Users can manage own devices" ON public.devices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Activities
DROP POLICY IF EXISTS "Activities are viewable by team members." ON public.activities;
DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
CREATE POLICY "Users can view own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);

-- Rate Limits
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "No direct user writes" ON public.rate_limits;
DROP POLICY IF EXISTS "No direct user updates" ON public.rate_limits;
DROP POLICY IF EXISTS "No direct user deletes" ON public.rate_limits;

CREATE POLICY "Users can view own rate limits" ON public.rate_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "No direct user writes" ON public.rate_limits FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct user updates" ON public.rate_limits FOR UPDATE USING (false);
CREATE POLICY "No direct user deletes" ON public.rate_limits FOR DELETE USING (false);

-- CRDT
DROP POLICY IF EXISTS "Users can manage own CRDT documents" ON public.crdt_documents;
CREATE POLICY "Users can manage own CRDT documents" ON public.crdt_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read accessible crdt note updates" ON public.crdt_note_updates;
DROP POLICY IF EXISTS "Users can insert accessible crdt note updates" ON public.crdt_note_updates;

CREATE POLICY "Users can read accessible crdt note updates"
  ON public.crdt_note_updates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.id = crdt_note_updates.entity_id AND n.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert accessible crdt note updates"
  ON public.crdt_note_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- 1. Generic soft-delete sync (is_deleted <-> deleted_at)
CREATE OR REPLACE FUNCTION public.sync_deleted_status_generic()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_deleted, false) = true AND NEW.deleted_at IS NULL THEN
      NEW.deleted_at = timezone('utc'::text, now());
    ELSIF COALESCE(NEW.is_deleted, false) = false AND NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_deleted = true AND COALESCE(OLD.is_deleted, false) = false THEN
    NEW.deleted_at = COALESCE(NEW.deleted_at, timezone('utc'::text, now()));
  ELSIF NEW.is_deleted = false AND COALESCE(OLD.is_deleted, false) = true THEN
    NEW.deleted_at = NULL;
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.is_deleted = true;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    NEW.is_deleted = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_notes ON public.notes';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_notes BEFORE INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  END IF;

  IF to_regclass('public.folders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_folders ON public.folders';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_folders BEFORE INSERT OR UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  END IF;

  IF to_regclass('public.tasks') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_tasks ON public.tasks';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_tasks BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_events ON public.events';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_events BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_deleted_projects ON public.projects';
    EXECUTE 'CREATE TRIGGER trg_sync_deleted_projects BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_status_generic()';
  END IF;
END $$;

-- 2. Auto-update updated_at via moddatetime
DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_notes ON public.notes';
    EXECUTE 'CREATE TRIGGER set_updated_at_notes BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;

  IF to_regclass('public.tasks') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks';
    EXECUTE 'CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects';
    EXECUTE 'CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_events ON public.events';
    EXECUTE 'CREATE TRIGGER set_updated_at_events BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;

  IF to_regclass('public.folders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_folders ON public.folders';
    EXECUTE 'CREATE TRIGGER set_updated_at_folders BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles';
    EXECUTE 'CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;

  IF to_regclass('public.crdt_documents') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_crdt_documents ON public.crdt_documents';
    EXECUTE 'CREATE TRIGGER set_updated_at_crdt_documents BEFORE UPDATE ON public.crdt_documents FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at)';
  END IF;
END $$;

-- 3. Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 4. Apply CRDT note update
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
  p_title TEXT DEFAULT NULL
) RETURNS TABLE(applied BOOLEAN, seq BIGINT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.crdt_note_updates (entity_type, entity_id, user_id, client_id, op_id, update_data)
  VALUES ('note', p_entity_id, p_user_id, p_client_id, p_op_id, COALESCE(p_update_data, '{}'))
  ON CONFLICT (entity_type, entity_id, op_id) DO NOTHING
  RETURNING crdt_note_updates.seq INTO v_seq;

  IF v_seq IS NULL THEN
    SELECT u.seq INTO v_seq
    FROM public.crdt_note_updates u
    WHERE u.entity_type = 'note' AND u.entity_id = p_entity_id AND u.op_id = p_op_id
    LIMIT 1;

    RETURN QUERY SELECT FALSE, v_seq;
    RETURN;
  END IF;

  UPDATE public.notes n SET
    body = COALESCE(p_body, n.body),
    excerpt = COALESCE(p_excerpt, n.excerpt),
    title = COALESCE(p_title, n.title),
    hlc_timestamp = COALESCE(p_hlc_timestamp, n.hlc_timestamp),
    updated_at = COALESCE(p_updated_at, timezone('utc'::text, now()))
  WHERE n.id = p_entity_id AND n.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found or forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_snapshot IS NOT NULL THEN
    INSERT INTO public.crdt_documents (entity_type, entity_id, user_id, state, last_seq, updated_at)
    VALUES ('note', p_entity_id, p_user_id, p_snapshot, v_seq, COALESCE(p_updated_at, timezone('utc'::text, now())))
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      state = EXCLUDED.state,
      last_seq = EXCLUDED.last_seq,
      updated_at = EXCLUDED.updated_at;

    DELETE FROM public.crdt_note_updates AS del_cnu
    WHERE del_cnu.entity_type = 'note'
      AND del_cnu.entity_id = p_entity_id
      AND del_cnu.seq < COALESCE((
        SELECT inner_cnu.seq
        FROM public.crdt_note_updates AS inner_cnu
        WHERE inner_cnu.entity_type = 'note' AND inner_cnu.entity_id = p_entity_id
        ORDER BY inner_cnu.seq DESC
        OFFSET 499 LIMIT 1
      ), 0);
  END IF;

  RETURN QUERY SELECT TRUE, v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_note_crdt_update(UUID, UUID, TEXT, TEXT, BIGINT[], TEXT, TEXT, TEXT, TIMESTAMPTZ, BIGINT[], TEXT) TO authenticated;

-- 5. Get CRDT updates
CREATE OR REPLACE FUNCTION public.get_note_crdt_updates(
  p_entity_id UUID,
  p_after_seq BIGINT DEFAULT 0,
  p_limit INT DEFAULT 500
) RETURNS TABLE(seq BIGINT, op_id TEXT, client_id TEXT, update_data BIGINT[], created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT u.seq, u.op_id, u.client_id, u.update_data, u.created_at
  FROM public.crdt_note_updates u
  WHERE u.entity_type = 'note'
    AND u.entity_id = p_entity_id
    AND u.seq > COALESCE(p_after_seq, 0)
  ORDER BY u.seq ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000));
$$;

GRANT EXECUTE ON FUNCTION public.get_note_crdt_updates(UUID, BIGINT, INT) TO authenticated;

-- 6. Bootstrap data
CREATE OR REPLACE FUNCTION public.get_bootstrap_data()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_tasks json;
  v_notes json;
  v_events json;
  v_projects json;
  v_folders json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_tasks
  FROM public.tasks t
  WHERE t.user_id = v_user_id AND COALESCE(t.is_deleted, false) = false;

  SELECT COALESCE(json_agg(n), '[]'::json) INTO v_notes
  FROM public.notes n
  WHERE n.user_id = v_user_id
    AND COALESCE(n.is_task, false) = false
    AND COALESCE(n.is_deleted, false) = false;

  SELECT COALESCE(json_agg(e), '[]'::json) INTO v_events
  FROM public.events e
  WHERE e.user_id = v_user_id AND COALESCE(e.is_deleted, false) = false;

  SELECT COALESCE(json_agg(p), '[]'::json) INTO v_projects
  FROM public.projects p
  WHERE p.user_id = v_user_id AND COALESCE(p.is_deleted, false) = false;

  SELECT COALESCE(json_agg(f), '[]'::json) INTO v_folders
  FROM public.folders f
  WHERE f.user_id = v_user_id AND COALESCE(f.is_deleted, false) = false;

  RETURN json_build_object(
    'tasks', v_tasks,
    'notes', v_notes,
    'events', v_events,
    'projects', v_projects,
    'folders', v_folders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_bootstrap_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bootstrap_data() TO authenticated;

-- 6.5. Get CRDT document snapshot
CREATE OR REPLACE FUNCTION public.get_crdt_document(p_entity_type TEXT, p_entity_id UUID)
RETURNS TABLE(state BIGINT[], last_seq BIGINT)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT d.state, d.last_seq
  FROM public.crdt_documents d
  WHERE d.entity_type = p_entity_type AND d.entity_id = p_entity_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_crdt_document(TEXT, UUID) TO authenticated;

-- 7. Cascade folder soft delete / restore
CREATE OR REPLACE FUNCTION public.cascade_folder_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ;
  v_deleted_hlc TEXT;
  v_cascade_hlc TEXT := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT || ':0:server';
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    -- Cascade delete
    v_deleted_at := COALESCE(NEW.deleted_at, timezone('utc'::text, now()));
    v_deleted_hlc := COALESCE(NEW.deleted_hlc, NEW.hlc_timestamp);

    UPDATE public.folders
    SET is_deleted = true, deleted_at = v_deleted_at, deleted_hlc = v_deleted_hlc,
        hlc_timestamp = v_cascade_hlc, updated_at = timezone('utc'::text, now())
    WHERE parent_id = OLD.id AND is_deleted = false;

    UPDATE public.notes
    SET is_deleted = true, deleted_at = v_deleted_at, deleted_hlc = v_deleted_hlc,
        hlc_timestamp = v_cascade_hlc, updated_at = timezone('utc'::text, now())
    WHERE folder_id = OLD.id AND is_deleted = false;

  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    -- Cascade restore
    UPDATE public.folders
    SET is_deleted = false, deleted_at = NULL, deleted_hlc = NULL,
        hlc_timestamp = v_cascade_hlc, updated_at = timezone('utc'::text, now())
    WHERE parent_id = OLD.id AND is_deleted = true AND deleted_hlc = OLD.deleted_hlc;

    UPDATE public.notes
    SET is_deleted = false, deleted_at = NULL, deleted_hlc = NULL,
        hlc_timestamp = v_cascade_hlc, updated_at = timezone('utc'::text, now())
    WHERE folder_id = OLD.id AND is_deleted = true AND deleted_hlc = OLD.deleted_hlc;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_folder_soft_delete ON public.folders;
CREATE TRIGGER trigger_cascade_folder_soft_delete
BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.cascade_folder_soft_delete();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.web_notes WITH (security_invoker = true) AS
SELECT * FROM public.notes WHERE COALESCE(is_task, false) = false;

CREATE OR REPLACE VIEW public.web_notes_active WITH (security_invoker = true) AS
SELECT * FROM public.notes
WHERE COALESCE(is_task, false) = false AND deleted_at IS NULL;

GRANT SELECT ON public.web_notes TO authenticated;
GRANT SELECT ON public.web_notes_active TO authenticated;

CREATE OR REPLACE VIEW public.trash_items AS
  SELECT id, user_id, title, deleted_at, 'note' AS item_type,
    14 - EXTRACT(DAY FROM timezone('utc'::text, now()) - deleted_at)::INT AS days_remaining
  FROM public.notes WHERE is_deleted = true AND deleted_at IS NOT NULL
UNION ALL
  SELECT id, user_id, name AS title, deleted_at, 'folder' AS item_type,
    14 - EXTRACT(DAY FROM timezone('utc'::text, now()) - deleted_at)::INT AS days_remaining
  FROM public.folders WHERE is_deleted = true AND deleted_at IS NOT NULL
UNION ALL
  SELECT id, user_id, title, deleted_at, 'task' AS item_type,
    14 - EXTRACT(DAY FROM timezone('utc'::text, now()) - deleted_at)::INT AS days_remaining
  FROM public.tasks WHERE is_deleted = true AND deleted_at IS NOT NULL
UNION ALL
  SELECT id, user_id, title, deleted_at, 'event' AS item_type,
    14 - EXTRACT(DAY FROM timezone('utc'::text, now()) - deleted_at)::INT AS days_remaining
  FROM public.events WHERE is_deleted = true AND deleted_at IS NOT NULL
UNION ALL
  SELECT id, user_id, name AS title, deleted_at, 'project' AS item_type,
    14 - EXTRACT(DAY FROM timezone('utc'::text, now()) - deleted_at)::INT AS days_remaining
  FROM public.projects WHERE is_deleted = true AND deleted_at IS NOT NULL;

ALTER VIEW public.trash_items SET (security_invoker = on);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_start_at_active ON public.tasks(user_id, start_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON public.notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON public.notes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_scheduled ON public.notes(user_id, scheduled_time) WHERE scheduled_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_user_date ON public.events(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_events_range ON public.events(start_date, end_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crdt_documents_user_id ON public.crdt_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_crdt_documents_entity ON public.crdt_documents(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crdt_note_updates_entity_seq ON public.crdt_note_updates(entity_type, entity_id, seq);
CREATE INDEX IF NOT EXISTS idx_crdt_note_updates_user_created ON public.crdt_note_updates(user_id, created_at DESC);

-- ============================================================
-- REALTIME CONFIGURATION
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.notes REPLICA IDENTITY FULL';
  END IF;
  IF to_regclass('public.tasks') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tasks REPLICA IDENTITY FULL';
  END IF;
  IF to_regclass('public.projects') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.projects REPLICA IDENTITY FULL';
  END IF;
  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.events REPLICA IDENTITY FULL';
  END IF;
  IF to_regclass('public.folders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.folders REPLICA IDENTITY FULL';
  END IF;
  IF to_regclass('public.crdt_documents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crdt_documents REPLICA IDENTITY FULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF to_regclass('public.notes') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notes'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notes'; END IF;

    IF to_regclass('public.tasks') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks'; END IF;

    IF to_regclass('public.projects') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projects'; END IF;

    IF to_regclass('public.events') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events'; END IF;

    IF to_regclass('public.folders') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'folders'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.folders'; END IF;

    IF to_regclass('public.crdt_documents') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crdt_documents'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crdt_documents'; END IF;

    IF to_regclass('public.crdt_note_updates') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crdt_note_updates'
    ) THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crdt_note_updates'; END IF;
  END IF;
END $$;

-- ============================================================
-- DEVICE MANAGEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_device(
  p_device_id TEXT,
  p_device_name TEXT,
  p_platform TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_plan_tier TEXT;
  v_max_devices INT;
  v_active_devices TEXT[];
  v_active_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'Not authenticated');
  END IF;

  SELECT plan_tier, COALESCE(active_device_ids, '{}')
  INTO v_plan_tier, v_active_devices
  FROM public.profiles
  WHERE id = v_user_id;

  v_max_devices := CASE WHEN v_plan_tier = 'free' THEN 2 ELSE 999 END;
  v_active_count := COALESCE(array_length(v_active_devices, 1), 0);

  IF p_device_id = ANY(v_active_devices) THEN
    UPDATE public.devices SET last_active_at = timezone('utc'::text, now())
    WHERE user_id = v_user_id AND device_id = p_device_id;

    RETURN json_build_object(
      'allowed', true,
      'reason', 'Already registered',
      'plan_tier', v_plan_tier,
      'active_count', v_active_count,
      'max_devices', v_max_devices
    );
  END IF;

  IF v_active_count >= v_max_devices THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Device limit reached. Upgrade to Pro for unlimited devices.',
      'plan_tier', v_plan_tier,
      'active_count', v_active_count,
      'max_devices', v_max_devices
    );
  END IF;

  UPDATE public.profiles
  SET active_device_ids = array_append(v_active_devices, p_device_id)
  WHERE id = v_user_id;

  INSERT INTO public.devices (user_id, device_id, device_name, platform)
  VALUES (v_user_id, p_device_id, p_device_name, p_platform);

  RETURN json_build_object(
    'allowed', true,
    'reason', 'Registered successfully',
    'plan_tier', v_plan_tier,
    'active_count', v_active_count + 1,
    'max_devices', v_max_devices
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.unregister_device(p_device_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  UPDATE public.profiles
  SET active_device_ids = array_remove(active_device_ids, p_device_id)
  WHERE id = v_user_id;

  DELETE FROM public.devices
  WHERE user_id = v_user_id AND device_id = p_device_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unregister_device(TEXT) TO authenticated;