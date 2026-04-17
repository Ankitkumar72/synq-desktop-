import { createBrowserClient } from '@supabase/ssr'
import { createGhostClient } from './ghost'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return createGhostClient<ReturnType<typeof createBrowserClient>>()
  }

  return createBrowserClient(url, key)
}
