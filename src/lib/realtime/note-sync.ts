import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Note } from '@/types'

export const NOTE_BROADCAST_EVENT = 'note-update'

export interface NoteBroadcastPayload extends Pick<Note, 'id' | 'content' | 'body' | 'excerpt' | 'hlc_timestamp' | 'updated_at'> {
  field_versions: Record<string, string>
  sender_id: string
}

let noteBroadcastChannel: RealtimeChannel | null = null
let fallbackClientId: string | null = null

function createFallbackClientId() {
  if (!fallbackClientId) {
    fallbackClientId = `web-${Math.random().toString(36).slice(2, 10)}`
  }

  return fallbackClientId
}

export function getNoteSyncClientId() {
  if (typeof window === 'undefined') return createFallbackClientId()

  const storageKey = 'synq-note-sync-client-id'

  try {
    const existing = window.sessionStorage.getItem(storageKey)
    if (existing) return existing

    const created = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? `web-${crypto.randomUUID()}`
      : createFallbackClientId()

    window.sessionStorage.setItem(storageKey, created)
    return created
  } catch {
    return createFallbackClientId()
  }
}

export function bindNoteBroadcastChannel(channel: RealtimeChannel | null) {
  noteBroadcastChannel = channel
}

export async function sendNoteBroadcast(payload: Omit<NoteBroadcastPayload, 'sender_id'>) {
  if (!noteBroadcastChannel) return 'not-ready'

  try {
    return await noteBroadcastChannel.send({
      type: 'broadcast',
      event: NOTE_BROADCAST_EVENT,
      payload: {
        ...payload,
        sender_id: getNoteSyncClientId(),
      },
    })
  } catch (error) {
    console.warn('[NoteSync] Broadcast send failed:', error)
    return 'error'
  }
}
