import { createClient } from '@/lib/supabase/client'

/**
 * Rate limit actions — shared constants used by both Next.js and Flutter.
 * Keep these in sync with your Flutter `rate_limit_constants.dart`.
 */
export const RATE_LIMIT_ACTIONS = {
  CRDT_SYNC: 'crdt_sync',
  NOTE_EDIT: 'note_edit',
  TASK_CREATE: 'task_create',
  PROJECT_CREATE: 'project_create',
  IMAGE_UPLOAD: 'image_upload',
  SEARCH: 'search',
  AUTH_LOGIN: 'auth_login',
} as const

export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[keyof typeof RATE_LIMIT_ACTIONS]

/**
 * Default rate limits per action.
 * These are the same limits enforced by the Supabase `check_rate_limit` PL/pgSQL function.
 */
export const RATE_LIMITS: Record<RateLimitAction, { maxRequests: number; windowSeconds: number }> = {
  [RATE_LIMIT_ACTIONS.CRDT_SYNC]: { maxRequests: 30, windowSeconds: 60 },
  [RATE_LIMIT_ACTIONS.NOTE_EDIT]: { maxRequests: 60, windowSeconds: 60 },
  [RATE_LIMIT_ACTIONS.TASK_CREATE]: { maxRequests: 30, windowSeconds: 60 },
  [RATE_LIMIT_ACTIONS.PROJECT_CREATE]: { maxRequests: 10, windowSeconds: 60 },
  [RATE_LIMIT_ACTIONS.IMAGE_UPLOAD]: { maxRequests: 10, windowSeconds: 60 },
  [RATE_LIMIT_ACTIONS.SEARCH]: { maxRequests: 30, windowSeconds: 60 },
  [RATE_LIMIT_ACTIONS.AUTH_LOGIN]: { maxRequests: 5, windowSeconds: 60 },
}

/**
 * Check rate limit via Supabase RPC.
 * This calls the `check_rate_limit` PL/pgSQL function in your Supabase database.
 * Both the Next.js web app and the Flutter app use the same underlying function.
 *
 * @param userId - The authenticated user's UUID
 * @param action - The action to rate limit (from RATE_LIMIT_ACTIONS)
 * @param options - Optional overrides for maxRequests and windowSeconds
 * @returns { allowed: boolean; error?: string }
 */
export async function checkRateLimit(
  userId: string,
  action: RateLimitAction,
  options?: { maxRequests?: number; windowSeconds?: number }
): Promise<{ allowed: boolean; error?: string }> {
  const supabase = createClient()
  const limits = RATE_LIMITS[action]

  const maxRequests = options?.maxRequests ?? limits.maxRequests
  const windowSeconds = options?.windowSeconds ?? limits.windowSeconds

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.error('[RateLimit] RPC error:', error.message)
      // Fail open — don't block users if the rate limiter itself has issues
      return { allowed: true }
    }

    if (!data) {
      return {
        allowed: false,
        error: `Rate limit exceeded for ${action}. Try again in ${windowSeconds}s.`,
      }
    }

    return { allowed: true }
  } catch (err) {
    console.error('[RateLimit] Unexpected error:', err)
    // Fail open
    return { allowed: true }
  }
}

/**
 * Check rate limit via the Supabase Edge Function.
 * Use this when you need server-verified rate limiting (e.g., before sync operations).
 * The Edge Function verifies the JWT and calls the same `check_rate_limit` PL/pgSQL function.
 *
 * @param action - The action to rate limit
 * @param options - Optional overrides
 * @returns { allowed: boolean; error?: string; retryAfter?: number }
 */
export async function checkRateLimitViaEdge(
  action: RateLimitAction,
  options?: { maxRequests?: number; windowSeconds?: number }
): Promise<{ allowed: boolean; error?: string; retryAfter?: number }> {
  const supabase = createClient()
  const limits = RATE_LIMITS[action]

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { allowed: false, error: 'Not authenticated' }
    }

    const response = await supabase.functions.invoke('rate-check', {
      body: {
        action,
        max_requests: options?.maxRequests ?? limits.maxRequests,
        window_seconds: options?.windowSeconds ?? limits.windowSeconds,
      },
    })

    if (response.error) {
      console.error('[RateLimit] Edge function error:', response.error)
      // Fail open
      return { allowed: true }
    }

    const result = response.data
    if (result?.error) {
      return {
        allowed: false,
        error: result.error,
        retryAfter: result.retryAfter,
      }
    }

    return { allowed: true }
  } catch (err) {
    console.error('[RateLimit] Edge function call failed:', err)
    // Fail open
    return { allowed: true }
  }
}

// ─────────────────────────────────────────────────────
// In-memory rate limiter for Next.js middleware/proxy
// ─────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes to prevent memory leaks
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

/**
 * In-memory sliding window rate limiter for Next.js middleware.
 * This runs at the edge (proxy.ts) before hitting Supabase at all.
 * Protects against rapid page loads and bot traffic.
 *
 * @param identifier - IP address or user ID
 * @param maxRequests - Maximum requests allowed in the window (default: 60)
 * @param windowMs - Window duration in milliseconds (default: 60000 = 1 min)
 * @returns { allowed: boolean; remaining: number; resetTime: number }
 */
export function checkInMemoryRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime }
}
