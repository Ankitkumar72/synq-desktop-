import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Note } from '../types'

export const NOTE_BROADCAST_EVENT = 'note-update'
export const NOTE_META_BROADCAST_EVENT = 'note-meta-update'

export interface NoteBroadcastPayload extends Pick<Note, 'id' | 'content' | 'body' | 'excerpt' | 'hlc_timestamp' | 'updated_at'> {
  field_versions: Record<string, string>
  sender_id: string
}

export interface NoteMetaBroadcastPayload extends Pick<Note, 'id' | 'title' | 'excerpt' | 'updated_seq_id' | 'updated_at' | 'is_deleted'> {
  sender_id: string
}

let globalBroadcastChannel: RealtimeChannel | null = null
let activeNoteBroadcastChannel: RealtimeChannel | null = null

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

export function bindGlobalBroadcastChannel(channel: RealtimeChannel | null) {
  globalBroadcastChannel = channel
}

export function bindActiveNoteChannel(channel: RealtimeChannel | null) {
  activeNoteBroadcastChannel = channel
}

export async function sendNoteBroadcast(payload: Omit<NoteBroadcastPayload, 'sender_id'>) {
  if (!activeNoteBroadcastChannel) return 'not-ready'

  try {
    return await activeNoteBroadcastChannel.send({
      type: 'broadcast',
      event: NOTE_BROADCAST_EVENT,
      payload: {
        ...payload,
        sender_id: getNoteSyncClientId(),
      },
    })
  } catch (error) {
    console.warn('[NoteSync] CRDT Broadcast send failed:', error)
    return 'error'
  }
}

export async function sendNoteMetadataBroadcast(payload: Omit<NoteMetaBroadcastPayload, 'sender_id'>) {
  if (!globalBroadcastChannel) return 'not-ready'

  try {
    return await globalBroadcastChannel.send({
      type: 'broadcast',
      event: NOTE_META_BROADCAST_EVENT,
      payload: {
        ...payload,
        sender_id: getNoteSyncClientId(),
      },
    })
  } catch (error) {
    console.warn('[NoteSync] Metadata Broadcast send failed:', error)
    return 'error'
  }
}
