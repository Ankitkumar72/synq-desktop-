import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createGhostClient } from './ghost'

export async function createClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time on Vercel, these might be missing.
  // Return a Ghost client to avoid crashing the build or runtime if keys are missing.
  if (!url || !key) {
    return createGhostClient<ReturnType<typeof createServerClient>>()
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
