-- 1. Create calendar_accounts table (with Envelope Encryption support)
CREATE TABLE IF NOT EXISTS public.calendar_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (char_length(provider) > 0),
    account_email TEXT NOT NULL,
    
    -- Encrypted Tokens (Ciphertext only)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    
    -- Cryptographic Metadata (AES-256-GCM)
    -- Stored as Base64 encoded strings
    access_token_iv TEXT NOT NULL,
    access_token_tag TEXT NOT NULL,
    refresh_token_iv TEXT,
    refresh_token_tag TEXT,
    
    -- Key Rotation Versioning
    key_version INTEGER NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create calendar_subscriptions table
CREATE TABLE IF NOT EXISTS public.calendar_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (char_length(provider) > 0),
    channel_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create sync_tokens table
CREATE TABLE IF NOT EXISTS public.sync_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (char_length(provider) > 0),
    sync_token TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create external_event_mappings table
CREATE TABLE IF NOT EXISTS public.external_event_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (char_length(provider) > 0),
    external_event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure an external event is only mapped once per provider
    CONSTRAINT uq_provider_external_event UNIQUE (provider, external_event_id)
);

-- Enable RLS on all tables
ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_event_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_accounts
DROP POLICY IF EXISTS "Users can view their own calendar accounts" ON public.calendar_accounts;
CREATE POLICY "Users can view their own calendar accounts" 
    ON public.calendar_accounts FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar accounts" ON public.calendar_accounts;
CREATE POLICY "Users can insert their own calendar accounts" 
    ON public.calendar_accounts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar accounts" ON public.calendar_accounts;
CREATE POLICY "Users can update their own calendar accounts" 
    ON public.calendar_accounts FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar accounts" ON public.calendar_accounts;
CREATE POLICY "Users can delete their own calendar accounts" 
    ON public.calendar_accounts FOR DELETE 
    USING (auth.uid() = user_id);

-- RLS Policies for calendar_subscriptions
DROP POLICY IF EXISTS "Users can view their own calendar subscriptions" ON public.calendar_subscriptions;
CREATE POLICY "Users can view their own calendar subscriptions" 
    ON public.calendar_subscriptions FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar subscriptions" ON public.calendar_subscriptions;
CREATE POLICY "Users can insert their own calendar subscriptions" 
    ON public.calendar_subscriptions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar subscriptions" ON public.calendar_subscriptions;
CREATE POLICY "Users can update their own calendar subscriptions" 
    ON public.calendar_subscriptions FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar subscriptions" ON public.calendar_subscriptions;
CREATE POLICY "Users can delete their own calendar subscriptions" 
    ON public.calendar_subscriptions FOR DELETE 
    USING (auth.uid() = user_id);

-- RLS Policies for sync_tokens
DROP POLICY IF EXISTS "Users can view their own sync tokens" ON public.sync_tokens;
CREATE POLICY "Users can view their own sync tokens" 
    ON public.sync_tokens FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sync tokens" ON public.sync_tokens;
CREATE POLICY "Users can insert their own sync tokens" 
    ON public.sync_tokens FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync tokens" ON public.sync_tokens;
CREATE POLICY "Users can update their own sync tokens" 
    ON public.sync_tokens FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync tokens" ON public.sync_tokens;
CREATE POLICY "Users can delete their own sync tokens" 
    ON public.sync_tokens FOR DELETE 
    USING (auth.uid() = user_id);

-- RLS Policies for external_event_mappings
DROP POLICY IF EXISTS "Users can view their own event mappings" ON public.external_event_mappings;
CREATE POLICY "Users can view their own event mappings" 
    ON public.external_event_mappings FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own event mappings" ON public.external_event_mappings;
CREATE POLICY "Users can insert their own event mappings" 
    ON public.external_event_mappings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own event mappings" ON public.external_event_mappings;
CREATE POLICY "Users can update their own event mappings" 
    ON public.external_event_mappings FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own event mappings" ON public.external_event_mappings;
CREATE POLICY "Users can delete their own event mappings" 
    ON public.external_event_mappings FOR DELETE 
    USING (auth.uid() = user_id);

-- Add update triggers for updated_at columns
CREATE OR REPLACE FUNCTION public.update_calendar_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_calendar_accounts_modtime ON public.calendar_accounts;
CREATE TRIGGER update_calendar_accounts_modtime 
BEFORE UPDATE ON public.calendar_accounts 
FOR EACH ROW EXECUTE PROCEDURE public.update_calendar_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_subscriptions_modtime ON public.calendar_subscriptions;
CREATE TRIGGER update_calendar_subscriptions_modtime 
BEFORE UPDATE ON public.calendar_subscriptions 
FOR EACH ROW EXECUTE PROCEDURE public.update_calendar_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_tokens_modtime ON public.sync_tokens;
CREATE TRIGGER update_sync_tokens_modtime 
BEFORE UPDATE ON public.sync_tokens 
FOR EACH ROW EXECUTE PROCEDURE public.update_calendar_updated_at_column();

-- 5. Create sync_jobs table (Queue Worker Architecture)
CREATE TABLE IF NOT EXISTS public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Restrict normal users since this is an internal queue (service_role bypasses RLS)
DROP POLICY IF EXISTS "Users cannot directly read or write sync jobs" ON public.sync_jobs;
CREATE POLICY "Users cannot directly read or write sync jobs" 
    ON public.sync_jobs FOR ALL 
    USING (false);

DROP TRIGGER IF EXISTS update_sync_jobs_modtime ON public.sync_jobs;
CREATE TRIGGER update_sync_jobs_modtime 
BEFORE UPDATE ON public.sync_jobs 
FOR EACH ROW EXECUTE PROCEDURE public.update_calendar_updated_at_column();

-- 6. Trigger to automatically invoke sync worker via pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_calendar_sync_worker()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- We expect these to be set in the database's custom settings (or Vault).
  -- For local dev, they fall back to the default local Supabase setup.
  edge_function_url := current_setting('app.settings.sync_worker_url', true);
  IF edge_function_url IS NULL THEN
    edge_function_url := 'http://host.docker.internal:54321/functions/v1/calendar-sync-worker';
  END IF;
  
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- We only fire the request if we have a valid key (preventing local errors if not configured yet)
  IF service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object('job_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sync_job_created ON public.sync_jobs;
CREATE TRIGGER on_sync_job_created
AFTER INSERT ON public.sync_jobs
FOR EACH ROW EXECUTE PROCEDURE public.trigger_calendar_sync_worker();
