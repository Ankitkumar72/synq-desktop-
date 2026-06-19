import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Note } from '../types'

export const NOTE_BROADCAST_EVENT = 'note-update'

export interface NoteBroadcastPayload extends Pick<Note, 'id' | 'content' | 'body' | 'excerpt' | 'hlc_timestamp' | 'updated_at'> {
  field_versions: Record<string, string>
  sender_id: string
}

let noteBroadcastChannel: RealtimeChannel | null = null

let memoryClientId: string | null = null

function createFallbackClientId() {
  if (!memoryClientId) {
    memoryClientId = `web-${Math.random().toString(36).slice(2, 10)}`
  }
  return memoryClientId
}

export function getNoteSyncClientId() {
  if (typeof window === 'undefined') return createFallbackClientId()

  if (!memoryClientId) {
    memoryClientId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? `web-${crypto.randomUUID()}`
      : createFallbackClientId()
  }

  return memoryClientId
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
