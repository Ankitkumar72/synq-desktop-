import { supabase } from '@/lib/supabase.client'

const DEVICE_ID_KEY = 'synq_device_id'

/**
 * Returns a stable device ID for this browser.
 * Generated once and persisted in localStorage.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'

  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

/**
 * Get a human-readable device name from the browser's user agent.
 */
function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Server'

  const ua = navigator.userAgent
  let browser = 'Browser'
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edg')) browser = 'Edge'

  let os = 'Unknown OS'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return `${browser} on ${os}`
}

export interface DeviceRegistrationResult {
  allowed: boolean
  reason: string
  plan_tier?: string
  active_count?: number
  max_devices?: number
}

/**
 * Registers this browser as an active device for the current user.
 * Calls the Supabase RPC `register_device` which enforces plan-based limits.
 */
export async function registerDevice(): Promise<DeviceRegistrationResult> {
  const deviceId = getDeviceId()
  const deviceName = getDeviceName()

  const { data, error } = await supabase.rpc('register_device', {
    p_device_id: deviceId,
    p_device_name: deviceName,
    p_platform: 'web',
  })

  if (error) {
    console.error('[DeviceManager] Registration failed:', error.message)
    return {
      allowed: true, // fail-open: don't lock users out on network errors
      reason: `Registration error: ${error.message}`,
    }
  }

  return data as DeviceRegistrationResult
}

/**
 * Unregisters this browser from the current user's active devices.
 */
export async function unregisterDevice(): Promise<boolean> {
  const deviceId = getDeviceId()

  const { error } = await supabase.rpc('unregister_device', {
    p_device_id: deviceId,
  })

  if (error) {
    console.error('[DeviceManager] Unregistration failed:', error.message)
    return false
  }

  return true
}
