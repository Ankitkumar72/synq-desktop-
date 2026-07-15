

import { supabase, isGhostClient } from '../supabase/supabase'
import { hlc } from '../hlc'
import {
  applyNoteCrdtUpdate,
  enqueueQueuedNoteCrdtUpdate,
  flushQueuedNoteCrdtUpdates,
  getQueuedNoteCrdtDepth,
  setLocalLastSeq,
  isNonRetryableError,
} from './oplog'
import {
  flushQueue,
  getQueueDepth,
  enqueueOperation,
  type QueuedOperation,
  RETRY_BACKOFF_MS,
} from './offline-queue'
import { getDocState, markLocallyModified, getMarkdownFromYDoc, getExcerptFromYDoc, getPlainTextFromYDoc } from './crdt-doc'
import type { RejectedField } from './field-crdt'
import { Telemetry } from '../telemetry'

const __DEV__ = process.env.NODE_ENV !== 'production'

type CircuitState = 'closed' | 'open' | 'half-open'

class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failures = 0
  private lastFailureAt = 0

  constructor(
    private readonly threshold = 5,        
    private readonly resetAfterMs = 30_000  
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureAt
      if (elapsed < this.resetAfterMs) {
        throw new Error('[CircuitBreaker] Open, skipping request')
      }
      this.state = 'half-open'
    }

    try {
      const result = await fn()
      this.reset()
      return result
    } catch (err) {
      this.recordFailure()
      throw err
    }
  }

  private reset() {
    this.failures = 0
    this.state = 'closed'
  }

  private recordFailure() {
    this.failures++
    this.lastFailureAt = Date.now()
    if (this.failures >= this.threshold) {
      if (__DEV__) console.warn(`[CircuitBreaker] Opened after ${this.failures} consecutive failures`)
      this.state = 'open'
    }
  }
}

const crdtBreaker = new CircuitBreaker(5, 30_000)

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
let flushTimer: ReturnType<typeof setTimeout> | null = null

let isInitialized = false
let isFlushing = false
let needsFlushAgain = false

const queueListeners = new Set<(depth: number) => void>()

export function initSyncManager(): void {
  if (isInitialized) return
  isInitialized = true

  if (typeof window === 'undefined') return

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  isOnline = navigator?.onLine ?? true
  console.log(`[SyncManager] Initialized. Online: ${isOnline}`)

  if (isOnline) {
    scheduleFlush(3000) 
  }
}

export function destroySyncManager(): void {
  if (typeof window === 'undefined') return

  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)

  if (flushTimer) clearTimeout(flushTimer)

  isInitialized = false
  isFlushing = false
  needsFlushAgain = false
  queueListeners.clear()
  console.log('[SyncManager] Destroyed')
}

function handleOnline(): void {
  console.log('[SyncManager] Back online — scheduling flush')
  isOnline = true
  scheduleFlush(300)
}

function handleOffline(): void {
  console.log('[SyncManager] Went offline')
  isOnline = false
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

function scheduleFlush(delayMs: number = 1000): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(async () => {
    flushTimer = null
    await performFlush()
  }, delayMs)
}

async function performFlush(): Promise<void> {
  if (!isOnline) return
  // No point flushing when the Supabase client is a ghost (missing env vars)
  if (isGhostClient()) return
  if (isFlushing) {
    needsFlushAgain = true
    return
  }
  isFlushing = true
  needsFlushAgain = false

  try {
    do {
      needsFlushAgain = false
      const [crudDepth, crdtDepth] = await Promise.all([
        getQueueDepth(),
        getQueuedNoteCrdtDepth(),
      ])
      if (crudDepth + crdtDepth === 0) break

      const [crudResult, crdtResult] = await Promise.all([
        flushQueue(executeOperation),
        flushQueuedNoteCrdtUpdates(),
      ])

      const [newCrudDepth, newCrdtDepth] = await Promise.all([
        getQueueDepth(),
        getQueuedNoteCrdtDepth(),
      ])
      const newDepth = newCrudDepth + newCrdtDepth
      notifyQueueListeners(newDepth)
      
      Telemetry.trackQueueDepth(newCrudDepth, newCrdtDepth)

      if ((crudResult.failed + crdtResult.failed) > 0) {
        scheduleFlush(RETRY_BACKOFF_MS * 2.5) 
        break 
      }
    } while (needsFlushAgain)
  } finally {
    isFlushing = false
  }
}

async function executeOperation(op: QueuedOperation): Promise<void> {
  let table = op.entityType === 'note' ? 'notes' : `${op.entityType}s`
  if (op.entityType === 'crdt_conflict_log') table = 'crdt_conflict_log'

  let payload = op.payload
  if (op.entityType === 'project') {
    const rest = { ...op.payload } as Record<string, unknown>
    delete rest.task_count
    delete rest.completed_task_count
    delete rest.progress
    payload = rest
  }

  switch (op.operationType) {
    case 'insert': {
      const { error } = await supabase.from(table).insert(payload)
      if (error) throw error
      break
    }
    case 'update': {
      const { error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', op.entityId)
      if (error) throw error
      break
    }
    case 'delete': {

      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString(), ...payload })
        .eq('id', op.entityId)
      if (error) throw error
      break
    }
    case 'hard_delete': {
      const { error } = await supabase.from(table).delete().eq('id', op.entityId)
      if (error) throw error
      break
    }
  }
}

function createOpId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isRpcUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const maybe = err as { code?: string; message?: string; details?: string }
  const message = `${maybe.message || ''} ${maybe.details || ''}`.toLowerCase()
  return maybe.code === '42883' || message.includes('function') && message.includes('does not exist')
}

interface SaveYDocOptions {
  updateData?: Uint8Array
  opId?: string
  snapshot?: Uint8Array | null
  content?: unknown
  fieldVersions?: Record<string, string>
}

export async function saveYDocToSupabase(noteId: string, userId: string, options: SaveYDocOptions = {}): Promise<void> {
  const state = getDocState(noteId)
  const updateData = options.updateData && options.updateData.length > 0 ? options.updateData : state
  const body = getMarkdownFromYDoc(noteId)
  const plainText = getPlainTextFromYDoc(noteId)
  const excerpt = getExcerptFromYDoc(noteId)
  const timestamp = hlc.increment()
  const updatedAt = new Date().toISOString()
  const opId = options.opId || createOpId()
  const clientId = hlc.getNodeId()
  const snapshot = options.snapshot === undefined ? state : options.snapshot
  const content = options.content

  markLocallyModified(noteId)

  if (!isOnline) {
    await enqueueQueuedNoteCrdtUpdate({
      noteId,
      userId,
      clientId,
      opId,
      updateData,
      body,
      excerpt,
      snapshot: snapshot ?? undefined,
      updatedAt,
      content,
      contentMarkdown: body,
      plainText,
      fieldVersions: options.fieldVersions,
    })
    return
  }

  try {
    const result = await crdtBreaker.execute(() =>
      applyNoteCrdtUpdate({
        noteId,
        userId,
        clientId,
        opId,
        updateData,
        snapshot: snapshot ?? undefined,
        body,
        excerpt,
        updatedAt,
        content,
        contentMarkdown: body,
        plainText,
        fieldVersions: options.fieldVersions,
      })
    )
    if (result.seq > 0) {
      setLocalLastSeq(noteId, result.seq)
    }
    return
  } catch (rpcError) {

    if (isNonRetryableError(rpcError)) {
      if (__DEV__) console.error('[SyncManager] Non-retryable RPC error, discarding operation:', rpcError)
      return
    }

    if (!isRpcUnavailableError(rpcError)) {
      try {
        await enqueueQueuedNoteCrdtUpdate({
          noteId,
          userId,
          clientId,
          opId,
          updateData,
          body,
          excerpt,
          snapshot: snapshot ?? undefined,
          updatedAt,
          content,
          contentMarkdown: body,
          fieldVersions: options.fieldVersions,
        })
        triggerFlush()
        return
      } catch (queueErr) {
        if (__DEV__) console.error('[SyncManager] Failed to enqueue CRDT op after RPC error:', queueErr)
        throw rpcError
      }
    }

    if (__DEV__) console.warn('[SyncManager] Atomic RPC unavailable, falling back to legacy save path:', rpcError)
  }

  const { error: crdtError } = await supabase
    .from('crdt_documents')
    .upsert({
      entity_type: 'note',
      entity_id: noteId,
      user_id: userId,
      state: Array.from(state),
      updated_at: updatedAt,
    }, { onConflict: 'entity_type,entity_id' })

  if (crdtError) {
    const errorMessage = crdtError instanceof Error
      ? crdtError.message
      : (crdtError && typeof crdtError === 'object' && Object.keys(crdtError).length > 0
        ? JSON.stringify(crdtError)
        : 'Unknown error (check crdt_documents table exists)')
    if (__DEV__) console.error('[SyncManager] Failed to save CRDT state:', errorMessage)
  }

  const noteUpdate: Record<string, unknown> = {
    body,
    content_markdown: body,
    plain_text: plainText,
    excerpt,
    hlc_timestamp: timestamp,
    updated_at: updatedAt,
  }
  if (content !== undefined) {
    noteUpdate.content = content
  }
  if (options.fieldVersions) {
    noteUpdate.field_versions = options.fieldVersions
  }

  const { error: noteError } = await supabase
    .from('notes')
    .update(noteUpdate)
    .eq('id', noteId)

  if (noteError) {
    const errorMessage = noteError instanceof Error
      ? noteError.message
      : (noteError && typeof noteError === 'object' && Object.keys(noteError).length > 0
        ? JSON.stringify(noteError)
        : 'Unknown error')
    if (__DEV__) console.error('[SyncManager] Failed to update note body:', errorMessage)
  }
}

export interface RemoteDocSnapshot {
  state: Uint8Array | null
  lastSeq: number
}

export async function loadYDocFromSupabase(noteId: string): Promise<RemoteDocSnapshot | null> {
  const { data, error } = await supabase
    .from('crdt_documents')
    .select('state, last_seq')
    .eq('entity_type', 'note')
    .eq('entity_id', noteId)
    .maybeSingle()

  if (error || !data) return null
  return {
    state: data.state ? new Uint8Array(data.state) : null,
    lastSeq: data.last_seq ? Number(data.last_seq) : 0
  }
}

export function triggerFlush(): void {
  if (isOnline && !flushTimer) {
    scheduleFlush(250)
  }
}

export function onQueueDepthChange(listener: (depth: number) => void): () => void {
  queueListeners.add(listener)
  return () => queueListeners.delete(listener)
}

function notifyQueueListeners(depth: number): void {
  for (const listener of queueListeners) {
    listener(depth)
  }
}

export function getOnlineStatus(): boolean {
  return isOnline
}

export async function getTotalQueueDepth(): Promise<number> {
  const [crudDepth, crdtDepth] = await Promise.all([
    getQueueDepth(),
    getQueuedNoteCrdtDepth(),
  ])
  return crudDepth + crdtDepth
}

export async function logRejectedFields(
  entityType: 'event' | 'task' | 'project' | 'note' | 'folder',
  entityId: string,
  userId: string,
  rejectedFields: RejectedField[]
): Promise<void> {
  if (rejectedFields.length === 0) return;
  const timestamp = hlc.increment();
  for (const conflict of rejectedFields) {
    const payload = {
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      field_name: conflict.field,
      rejected_value: conflict.rejectedValue,
      incoming_hlc: conflict.incomingHlc,
      winning_hlc: conflict.winningHlc,
      reason: 'lww_stale'
    };
    await enqueueOperation({
      entityType: 'crdt_conflict_log',
      entityId: crypto.randomUUID(),
      operationType: 'insert',
      payload,
      hlcTimestamp: timestamp
    });
  }
  triggerFlush();
}
