/**
 * Sync Manager
 * 
 * Central orchestrator for CRDT sync:
 * - Monitors online/offline state
 * - Flushes offline queue on reconnect
 * - Schedules Yjs document saves to Supabase
 * - Coordinates all sync operations
 */

import { supabase } from '@/lib/supabase.client'
import { hlc } from '@/lib/hlc'
import {
  applyNoteCrdtUpdate,
  enqueueQueuedNoteCrdtUpdate,
  flushQueuedNoteCrdtUpdates,
  getQueuedNoteCrdtDepth,
  setLocalLastSeq,
} from './oplog'
import {
  flushQueue,
  getQueueDepth,
  type QueuedOperation,
  RETRY_BACKOFF_MS,
} from './offline-queue'
import { getDocState, markLocallyModified, getPlainTextFromYDoc, getExcerptFromYDoc } from './crdt-doc'

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
let flushTimer: ReturnType<typeof setTimeout> | null = null

let isInitialized = false

// Listeners for queue depth changes
const queueListeners = new Set<(depth: number) => void>()

/**
 * Initialize the sync manager.
 * Sets up online/offline listeners and starts the flush cycle.
 */
export function initSyncManager(): void {
  if (isInitialized) return
  isInitialized = true

  if (typeof window === 'undefined') return

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  isOnline = navigator.onLine
  console.log(`[SyncManager] Initialized. Online: ${isOnline}`)

  if (isOnline) {
    scheduleFlush(500) // Flush any pending ops from last session
  }
}

/**
 * Tear down the sync manager.
 */
export function destroySyncManager(): void {
  if (typeof window === 'undefined') return

  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)

  if (flushTimer) clearTimeout(flushTimer)

  
  isInitialized = false
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

/**
 * Schedule a queue flush after a delay.
 */
function scheduleFlush(delayMs: number = 1000): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(async () => {
    flushTimer = null
    await performFlush()
  }, delayMs)
}

/**
 * Execute the queue flush.
 */
async function performFlush(): Promise<void> {
  if (!isOnline) return

  const [crudDepth, crdtDepth] = await Promise.all([
    getQueueDepth(),
    getQueuedNoteCrdtDepth(),
  ])
  if (crudDepth + crdtDepth === 0) return

  const [crudResult, crdtResult] = await Promise.all([
    flushQueue(executeOperation),
    flushQueuedNoteCrdtUpdates(),
  ])

  // Notify listeners of new queue depth
  const [newCrudDepth, newCrdtDepth] = await Promise.all([
    getQueueDepth(),
    getQueuedNoteCrdtDepth(),
  ])
  const newDepth = newCrudDepth + newCrdtDepth
  notifyQueueListeners(newDepth)

  // If there were failures, schedule a retry with backoff
  if ((crudResult.failed + crdtResult.failed) > 0) {
    scheduleFlush(RETRY_BACKOFF_MS)
  }
}

/**
 * Execute a single queued operation against Supabase.
 */
async function executeOperation(op: QueuedOperation): Promise<void> {
  const table = op.entityType === 'note' ? 'notes' : `${op.entityType}s`

  switch (op.operationType) {
    case 'insert': {
      const { error } = await supabase.from(table).insert(op.payload)
      if (error) throw error
      break
    }
    case 'update': {
      const { error } = await supabase
        .from(table)
        .update(op.payload)
        .eq('id', op.entityId)
      if (error) throw error
      break
    }
    case 'delete': {
      // Soft delete — set deleted_at
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString(), ...op.payload })
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

/**
 * Save a Yjs document state to Supabase.
 * Also updates body/excerpt for Flutter compatibility.
 */
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
}

export async function saveYDocToSupabase(noteId: string, userId: string, options: SaveYDocOptions = {}): Promise<void> {
  const state = getDocState(noteId)
  const updateData = options.updateData && options.updateData.length > 0 ? options.updateData : state
  const body = getPlainTextFromYDoc(noteId)
  const excerpt = getExcerptFromYDoc(noteId)
  const timestamp = hlc.increment()
  const updatedAt = new Date().toISOString()
  const opId = options.opId || createOpId()
  const clientId = hlc.getNodeId()
  const snapshot = options.snapshot === undefined ? null : options.snapshot

  // Mark as locally modified to prevent echo from Realtime
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
    })
    return
  }

  // Preferred: atomic RPC (op-log append + metadata + optional snapshot)
  try {
    const result = await applyNoteCrdtUpdate({
      noteId,
      userId,
      clientId,
      opId,
      updateData,
      snapshot: snapshot ?? undefined,
      body,
      excerpt,
      updatedAt,
    })
    if (result.seq > 0) {
      setLocalLastSeq(noteId, result.seq)
    }
    return
  } catch (rpcError) {
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
        })
        triggerFlush()
        return
      } catch (queueErr) {
        console.error('[SyncManager] Failed to enqueue CRDT op after RPC error:', queueErr)
        throw rpcError
      }
    }

    // Backward compatibility: if migration/RPC is not present yet, fall back.
    console.warn('[SyncManager] Atomic RPC unavailable, falling back to legacy save path:', rpcError)
  }

  // Fallback: legacy non-atomic dual write
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
    console.error('[SyncManager] Failed to save CRDT state:', errorMessage)
  }

  const { error: noteError } = await supabase
    .from('notes')
    .update({
      body,
      excerpt,
      hlc_timestamp: timestamp,
      updated_at: updatedAt,
    })
    .eq('id', noteId)

  if (noteError) {
    const errorMessage = noteError instanceof Error
      ? noteError.message
      : (noteError && typeof noteError === 'object' && Object.keys(noteError).length > 0
        ? JSON.stringify(noteError)
        : 'Unknown error')
    console.error('[SyncManager] Failed to update note body:', errorMessage)
  }
}

/**
 * Load a Yjs document state from Supabase.
 */
export async function loadYDocFromSupabase(noteId: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase
    .from('crdt_documents')
    .select('state')
    .eq('entity_type', 'note')
    .eq('entity_id', noteId)
    .maybeSingle()

  if (error || !data?.state) return null
  return new Uint8Array(data.state)
}

/**
 * Trigger a flush immediately (e.g., when a mutation is enqueued).
 */
export function triggerFlush(): void {
  if (isOnline && !flushTimer) {
    scheduleFlush(250)
  }
}

/**
 * Subscribe to queue depth changes.
 */
export function onQueueDepthChange(listener: (depth: number) => void): () => void {
  queueListeners.add(listener)
  return () => queueListeners.delete(listener)
}

function notifyQueueListeners(depth: number): void {
  for (const listener of queueListeners) {
    listener(depth)
  }
}

/**
 * Check if we're currently online.
 */
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
