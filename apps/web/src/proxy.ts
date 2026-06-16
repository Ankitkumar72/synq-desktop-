import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from "@synq/shared"

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const PROXY_RATE_LIMIT = 120
const PROXY_WINDOW_MS = 60_000

if (typeof setInterval !== 'undefined') {
  if (!(globalThis as any)._proxyRateLimitCleanupInterval) {
    (globalThis as any)._proxyRateLimitCleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetTime) {
          rateLimitMap.delete(key)
        }
      }
    }, 5 * 60 * 1000)
  }
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

export async function proxy(request: NextRequest) {
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

  const response = await updateSession(request)

  response.headers.set('X-RateLimit-Limit', String(PROXY_RATE_LIMIT))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString())

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
