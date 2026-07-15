-- Migration: 20260716010000_cleanup_obsolete_rpc
-- Description: Drop get_bootstrap_data since all clients now use get_delta_sync

DROP FUNCTION IF EXISTS public.get_bootstrap_data();
