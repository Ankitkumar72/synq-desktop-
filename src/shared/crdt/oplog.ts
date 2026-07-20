import { supabase, isGhostClient } from '../supabase/supabase'
import { hlc } from '../hlc'
import { del as idbDel, get as idbGet, keys as idbKeys, set as idbSet, getMany as idbGetMany } from 'idb-keyval'
import { Telemetry } from '../telemetry'

const __DEV__ = process.env.NODE_ENV !== 'production'
export class NonRetryableRpcError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message)
    this.name = 'NonRetryableRpcError'
  }
}

export function isNonRetryableError(err: unknown): boolean {
  if (err instanceof NonRetryableRpcError) return true
  if (!err || typeof err !== 'object') return false
  const maybe = err as { code?: string; status?: number; statusCode?: number }
  const status = maybe.status ?? maybe.statusCode ?? 0

  if (status >= 400 && status < 500) return true

  const nonRetryableCodes = ['42702', '42501', '42883', '42P01', '22P02', '23505']
  if (maybe.code && nonRetryableCodes.includes(maybe.code)) return true
  return false
}

export interface ApplyNoteCrdtUpdateInput {
  noteId: string
  userId: string
  clientId: string
  opId: string
  updateData: Uint8Array
  body?: string | null
  setBody?: boolean
  excerpt?: string | null
  setExcerpt?: boolean
  snapshot?: Uint8Array
  updatedAt?: string
  content?: unknown
  setContent?: boolean
  contentMarkdown?: string | null
  setContentMarkdown?: boolean
  plainText?: string | null
  setPlainText?: boolean
  fieldVersions?: Record<string, string>
  allowEmptyBody?: boolean
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
const MAX_QUEUE_RETRIES = 10

export async function applyNoteCrdtUpdate(input: ApplyNoteCrdtUpdateInput & { clientLastSync?: string }): Promise<ApplyNoteCrdtUpdateResult> {
  const clientLastSync = input.clientLastSync || (typeof window !== 'undefined' ? window.localStorage.getItem('synq_last_sync_time') || undefined : undefined);

  const { data, error } = await supabase.rpc('apply_note_crdt_update', {
    p_entity_id: input.noteId,
    p_user_id: input.userId,
    p_client_id: input.clientId,
    p_op_id: input.opId,
    p_update_data: toIntArray(input.updateData) || [],
    p_body: input.body,
    p_set_body: input.setBody ?? input.body !== undefined,
    p_excerpt: input.excerpt,
    p_set_excerpt: input.setExcerpt ?? input.excerpt !== undefined,
    p_content: input.content,
    p_set_content: input.setContent ?? input.content !== undefined,
    p_content_markdown: input.contentMarkdown ?? input.body,
    p_set_content_markdown: input.setContentMarkdown ?? (input.contentMarkdown !== undefined || input.body !== undefined),
    p_plain_text: input.plainText,
    p_set_plain_text: input.setPlainText ?? input.plainText !== undefined,
    p_field_versions: input.fieldVersions ?? {},
    p_hlc_timestamp: hlc.increment(),
    p_updated_at: input.updatedAt || new Date().toISOString(),
    p_snapshot: toIntArray(input.snapshot),
    p_client_last_sync: clientLastSync,
    p_allow_empty_body: input.allowEmptyBody ?? false,
  })

  if (error) {
    Telemetry.trackRpcResult('apply_note_crdt_update', false, error)
    if (isNonRetryableError(error)) {
      const status = (error as { status?: number }).status ?? 400
      const code = (error as { code?: string }).code
      if (__DEV__) console.error(`[Oplog] Non-retryable RPC error (${status}, code=${code}):`, error.message)
      throw new NonRetryableRpcError(error.message, status, code)
    }
    throw error
  }

  Telemetry.trackRpcResult('apply_note_crdt_update', true)
  const row = Array.isArray(data) ? data[0] : data
  return {
    applied: !!row?.applied,
    seq: Number(row?.seq || 0),
  }
}

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

  }
}

export function clearLocalLastSeq(noteId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(`${OPLOG_LAST_SEQ_PREFIX}${noteId}`)
  } catch {

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
  if (queueKeys.length === 0) return []

  const values = await idbGetMany(queueKeys)
  
  const pending: QueuedNoteCrdtUpdate[] = []
  for (const op of values) {
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
  // Skip flushing when using a ghost client (no Supabase env vars)
  if (isGhostClient()) return { flushed: 0, failed: 0 }

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
    } catch (err) {

      if (isNonRetryableError(err)) {
        if (__DEV__) console.error(`[Oplog] Non-retryable error for op ${op.id}, discarding:`, err)
        await dequeueQueuedNoteCrdtUpdate(op.id)
        failed++
        continue
      }

      if (op.retryCount >= MAX_QUEUE_RETRIES) {
        if (__DEV__) console.error(`[Oplog] Op ${op.id} exceeded ${MAX_QUEUE_RETRIES} retries, dead-lettering`)
        await dequeueQueuedNoteCrdtUpdate(op.id)
        failed++
        continue
      }

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
    if (__DEV__) console.warn('[Oplog] Failed to fetch latest seq:', error)
    return 0
  }
  return data ? Number(data.seq) : 0
}

