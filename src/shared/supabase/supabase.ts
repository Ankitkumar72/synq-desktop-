import { createClient } from './client'
import { SupabaseClient } from '@supabase/supabase-js'

// Use a Proxy to lazily initialize the supabase client.
// This prevents createClient() from being called during module evaluation/import.
// The client will only be created when a property (like .auth or .from) is first accessed.
let _supabase: SupabaseClient | null = null;

function ensureClient(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase!;
}

export const supabase = new Proxy({} as unknown as SupabaseClient, {
  get: (_target, prop) => {
    const client = ensureClient();
     
    const value = (client as any)[prop];
    if (typeof value === 'function' && !value.__isGhost) {
      return value.bind(client);
    }
    return value;
  }
});

/** Returns true when the supabase singleton is a GhostClient (no env vars configured). */
export function isGhostClient(): boolean {
  const client = ensureClient();
   
  return !!(client as any).__isGhost;
}
