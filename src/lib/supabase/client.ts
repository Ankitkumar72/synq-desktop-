import { createBrowserClient } from '@supabase/ssr'
import { createGhostClient } from './ghost'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn('[Supabase Client] Missing environment variables. Returning GhostClient.', { 
      hasUrl: !!url, 
      hasKey: !!key,
      env: process.env.NODE_ENV 
    })
    return createGhostClient<ReturnType<typeof createBrowserClient>>()
  }

  return createBrowserClient(url, key, {
    global: {
      fetch: async (url, options) => {
        console.debug('[Supabase Request]', { url, method: options?.method })
        try {
          const res = await fetch(url, options)
          return res
        } catch (err) {
          console.error('[Supabase Fetch Error]', {
            url,
            method: options?.method,
            error: err instanceof Error ? {
              message: err.message,
              name: err.name,
              stack: err.stack
            } : err
          })
          throw err
        }
      }
    }
  })
}
