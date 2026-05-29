import { supabase } from '@/lib/supabase.client'
import { hlc } from '@/lib/hlc'
import { del as idbDel, get as idbGet, keys as idbKeys, set as idbSet } from 'idb-keyval'

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
  content?: unknown
}

export interface ApplyNoteCrdtUpdateResult {
  applied: boolean
  seq: number
}

export interface NoteCrdtUpdateRow {
  seq: number
  entity_id?: string
  op_id: string
  client_id: string
  update_data: number[]
  created_at: string
}

export interface QueuedNoteCrdtUpdate {
  id: string
  input: ApplyNoteCrdtUpdateInput
  queuedAt: number
  retryCount: number
}

function toIntArray(input?: Uint8Array): number[] | null {
  if (!input) return null
  return Array.from(input)
}

const OPLOG_QUEUE_PREFIX = 'synq-crdt-opq:'
const OPLOG_LAST_SEQ_PREFIX = 'synq-crdt-last-seq:'
const MAX_QUEUE_RETRIES = 20

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

  // If rich content is provided, also persist it directly to the notes.content JSONB column
  if (input.content !== undefined) {
    const { error: contentError } = await supabase
      .from('notes')
      .update({ content: input.content })
      .eq('id', input.noteId)
    
    if (contentError) {
      console.warn('[Oplog] Failed to update notes.content column:', contentError)
    }
  }

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

export function toUint8Update(updateData: number[] | null | undefined): Uint8Array | null {
  if (!Array.isArray(updateData) || updateData.length === 0) return null
  return new Uint8Array(updateData)
}

export function getLocalLastSeq(noteId: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(`${OPLOG_LAST_SEQ_PREFIX}${noteId}`)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function setLocalLastSeq(noteId: string, seq: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(seq) || seq <= 0) return
  try {
    window.localStorage.setItem(`${OPLOG_LAST_SEQ_PREFIX}${noteId}`, String(Math.floor(seq)))
  } catch {
    // no-op: local storage unavailable
  }
}

export function clearLocalLastSeq(noteId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(`${OPLOG_LAST_SEQ_PREFIX}${noteId}`)
  } catch {
    // no-op: local storage unavailable
  }
}

export async function enqueueQueuedNoteCrdtUpdate(input: ApplyNoteCrdtUpdateInput): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const queued: QueuedNoteCrdtUpdate = {
    id,
    input,
    queuedAt: Date.now(),
    retryCount: 0,
  }
  await idbSet(`${OPLOG_QUEUE_PREFIX}${id}`, queued)
  return id
}

export async function getQueuedNoteCrdtUpdates(): Promise<QueuedNoteCrdtUpdate[]> {
  const allKeys = await idbKeys()
  const queueKeys = (allKeys as string[]).filter((k) => typeof k === 'string' && k.startsWith(OPLOG_QUEUE_PREFIX))
  const pending: QueuedNoteCrdtUpdate[] = []
  for (const key of queueKeys) {
    const op = await idbGet<QueuedNoteCrdtUpdate>(key)
    if (op) pending.push(op)
  }
  return pending.sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function dequeueQueuedNoteCrdtUpdate(id: string): Promise<void> {
  await idbDel(`${OPLOG_QUEUE_PREFIX}${id}`)
}

export async function markQueuedNoteCrdtRetry(id: string): Promise<void> {
  const key = `${OPLOG_QUEUE_PREFIX}${id}`
  const op = await idbGet<QueuedNoteCrdtUpdate>(key)
  if (!op) return
  op.retryCount = Math.min(MAX_QUEUE_RETRIES, (op.retryCount || 0) + 1)
  await idbSet(key, op)
}

export async function getQueuedNoteCrdtDepth(): Promise<number> {
  const allKeys = await idbKeys()
  return (allKeys as string[]).filter((k) => typeof k === 'string' && k.startsWith(OPLOG_QUEUE_PREFIX)).length
}

export async function flushQueuedNoteCrdtUpdates(): Promise<{ flushed: number; failed: number }> {
  const pending = await getQueuedNoteCrdtUpdates()
  if (pending.length === 0) return { flushed: 0, failed: 0 }

  let flushed = 0
  let failed = 0
  for (const op of pending) {
    try {
      const result = await applyNoteCrdtUpdate(op.input)
      if (result.seq > 0) {
        setLocalLastSeq(op.input.noteId, result.seq)
      }
      await dequeueQueuedNoteCrdtUpdate(op.id)
      flushed++
    } catch {
      await markQueuedNoteCrdtRetry(op.id)
      failed++
    }
  }

  return { flushed, failed }
}

export async function getLatestNoteCrdtSeq(noteId: string): Promise<number> {
  const { data, error } = await supabase
    .from('crdt_note_updates')
    .select('seq')
    .eq('entity_type', 'note')
    .eq('entity_id', noteId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[Oplog] Failed to fetch latest seq:', error)
    return 0
  }
  return data ? Number(data.seq) : 0
}

