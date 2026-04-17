import { createClient } from './supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

// Use a Proxy to lazily initialize the supabase client.
// This prevents createClient() from being called during module evaluation/import.
// The client will only be created when a property (like .auth or .from) is first accessed.
let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as unknown as SupabaseClient, {
  get: (_target, prop) => {
    if (!_supabase) {
      _supabase = createClient();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (_supabase as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_supabase);
    }
    return value;
  }
});
