import { createClient } from './supabase/client'

// Use a Proxy to lazily initialize the supabase client.
// This prevents createClient() from being called during module evaluation/import.
// The client will only be created when a property (like .auth or .from) is first accessed.
let _supabase: any = null;

export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    if (!_supabase) {
      _supabase = createClient();
    }
    return _supabase[prop];
  }
});
