import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

// ─────────────────────────────────────────────────────
// In-memory rate limiter for the proxy layer
// Runs before auth/session logic to block abusive traffic early
// ─────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const PROXY_RATE_LIMIT = 120   // max requests per window
const PROXY_WINDOW_MS = 60_000 // 1 minute window

// Periodic cleanup to prevent memory bloat
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

function checkProxyRateLimit(identifier: string): {
  allowed: boolean
  remaining: number
  resetTime: number
} {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + PROXY_WINDOW_MS })
    return { allowed: true, remaining: PROXY_RATE_LIMIT - 1, resetTime: now + PROXY_WINDOW_MS }
  }

  if (entry.count >= PROXY_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  entry.count++
  return { allowed: true, remaining: PROXY_RATE_LIMIT - entry.count, resetTime: entry.resetTime }
}

/**
 * Proxy function replaces Middleware in Next.js 16.0+
 * It handles:
 * 1. IP-level rate limiting (first line of defense)
 * 2. Supabase session refreshing and route protection
 */
export async function proxy(request: NextRequest) {
  // Get client IP — use forwarded header in production, fall back to a default
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const { allowed, remaining, resetTime } = checkProxyRateLimit(clientIp)

  if (!allowed) {
    const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000)
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(PROXY_RATE_LIMIT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetTime).toISOString(),
        },
      }
    )
  }

  // If rate limit passes, continue to session handling + route protection
  const response = await updateSession(request)

  // Attach rate limit headers to every response for client visibility
  response.headers.set('X-RateLimit-Limit', String(PROXY_RATE_LIMIT))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString())

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
