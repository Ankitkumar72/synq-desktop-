import { createBrowserClient } from '@supabase/ssr'


export async function debugSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('[Debug] Initializing raw client with:', { url, hasKey: !!key })

  if (!url || !key) {
    console.error('[Debug] Missing Supabase environment variables')
    return
  }

  const client = createBrowserClient(url, key)

  try {
    const { data: { user } } = await client.auth.getUser()
    console.log('[Debug] Auth check:', { authenticated: !!user, userId: user?.id })

    if (!user) {
      console.warn('[Debug] No user logged in. Testing public access...')
    }

    const tables = ['tasks', 'notes', 'events', 'projects', 'profiles', 'activities', 'folders', 'devices', 'crdt_documents']

    for (const table of tables) {
      console.log(`[Debug] Testing table: ${table}...`)
      const t0 = performance.now()

      try {
        const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${(await client.auth.getSession()).data.session?.access_token}`
          }
        })

        const text = await response.text()
        const duration = Math.round(performance.now() - t0)

        console.log(`[Debug] Table ${table} raw response (${duration}ms):`, {
          status: response.status,
          statusText: response.statusText,
          bodySample: text.substring(0, 100),
          isJSON: text.trim().startsWith('[') || text.trim().startsWith('{')
        })

        if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
          console.log(`[Debug] Table ${table} parsed JSON:`, JSON.parse(text))
        }
      } catch (fetchErr) {
        console.error(`[Debug] Table ${table} fetch failed:`, fetchErr)
      }
    }
  } catch (err) {
    console.error('[Debug] Unexpected diagnostic failure:', err)
  }
}
