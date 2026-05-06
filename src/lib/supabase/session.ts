import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  /**
   * IMPORTANT: We cannot use the shared `createClient` from `./server` here
   * because it calls `cookies()` from `next/headers`, which is NOT supported
   * in Middleware/Edge Runtime and triggers a 500 Internal Server Error.
   */
  if (!url || !key) {
    // Return early if keys are missing to prevent crash during build/prerender
    // Return a Ghost client for type compatibility if needed, but here we just pass through
    return supabaseResponse
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && (error.message.includes('refresh_token_not_found') || error.message.includes('Refresh Token Not Found') || (error as { code?: string }).code === 'refresh_token_not_found')) {
    // If the token is dead, clear cookies to prevent an infinite error loop.
    await supabase.auth.signOut()
  }

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/signup') || 
                     request.nextUrl.pathname.startsWith('/auth') ||
                     request.nextUrl.pathname.startsWith('/debug-connectivity')

  if (
    !user &&
    !isAuthPage &&
    !request.nextUrl.pathname.startsWith('/_next')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in, and tries to go to auth pages, redirect to dashboard
  if (user && isAuthPage && request.nextUrl.pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
