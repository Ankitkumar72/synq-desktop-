import { supabase } from '@/lib/supabase.client'
import { hlc } from '@/lib/hlc'

export interface ApplyNoteCrdtUpdateInput {
  noteId: string
  userId: string
  clientId: string
  opId: string
  updateData: Uint8Array
  body: string | null
  excerpt: string | null
  snapshot?: Uint8Array
  updatedAt?: string
}

export interface ApplyNoteCrdtUpdateResult {
  applied: boolean
  seq: number
}

export interface NoteCrdtUpdateRow {
  seq: number
  op_id: string
  client_id: string
  update_data: number[]
  created_at: string
}

function toIntArray(input?: Uint8Array): number[] | null {
  if (!input) return null
  return Array.from(input)
}

/**
 * Atomically appends a CRDT op and updates note metadata.
 * This is idempotent by (noteId, opId).
 */
export async function applyNoteCrdtUpdate(input: ApplyNoteCrdtUpdateInput): Promise<ApplyNoteCrdtUpdateResult> {
  const { data, error } = await supabase.rpc('apply_note_crdt_update', {
    p_entity_id: input.noteId,
    p_user_id: input.userId,
    p_client_id: input.clientId,
    p_op_id: input.opId,
    p_update_data: toIntArray(input.updateData) || [],
    p_body: input.body,
    p_excerpt: input.excerpt,
    p_hlc_timestamp: hlc.increment(),
    p_updated_at: input.updatedAt || new Date().toISOString(),
    p_snapshot: toIntArray(input.snapshot),
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  return {
    applied: !!row?.applied,
    seq: Number(row?.seq || 0),
  }
}

/**
 * Fetches incremental CRDT operations after a given sequence number.
 */
export async function getNoteCrdtUpdates(noteId: string, afterSeq: number, limit = 500): Promise<NoteCrdtUpdateRow[]> {
  const { data, error } = await supabase.rpc('get_note_crdt_updates', {
    p_entity_id: noteId,
    p_after_seq: afterSeq,
    p_limit: limit,
  })

  if (error) throw error
  return (data || []) as NoteCrdtUpdateRow[]
}
