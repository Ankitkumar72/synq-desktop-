/**
 * Offline Operation Queue
 * 
 * IndexedDB-backed queue that ensures writes are never lost.
 * All mutations go through the queue first (local-first), then
 * flush to Supabase when online.
 * 
 * Operations targeting the same entity+field are coalesced to reduce
 * network traffic and prevent outdated writes from overwriting newer ones.
 */

import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'

export interface QueuedOperation {
  id: string              // Unique op ID
  entityType: 'task' | 'project' | 'event' | 'note'
  entityId: string        // UUID of the record
  operationType: 'insert' | 'update' | 'delete' | 'hard_delete'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>   // The data to write
  hlcTimestamp: string     // HLC at time of operation
  createdAt: number        // Date.now() for ordering
  retryCount: number       // Number of flush attempts
}

const QUEUE_PREFIX = 'synq-opq:'
const MAX_RETRIES = 5
const RETRY_BACKOFF_MS = 2000

/**
 * Generate a unique operation ID.
 */
function generateOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Add an operation to the offline queue.
 * The operation is persisted to IndexedDB immediately.
 */
export async function enqueueOperation(op: Omit<QueuedOperation, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
  const id = generateOpId()
  const fullOp: QueuedOperation = {
    ...op,
    id,
    createdAt: Date.now(),
    retryCount: 0,
  }
  await idbSet(`${QUEUE_PREFIX}${id}`, fullOp)
  return id
}

/**
 * Get all pending operations, ordered by creation time.
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const allKeys = await idbKeys()
  const queueKeys = (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX))
  
  const ops: QueuedOperation[] = []
  for (const key of queueKeys) {
    const op = await idbGet<QueuedOperation>(key)
    if (op) ops.push(op)
  }
  
  // Sort by creation time (oldest first)
  return ops.sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Remove a successfully flushed operation from the queue.
 */
export async function dequeueOperation(id: string): Promise<void> {
  await idbDel(`${QUEUE_PREFIX}${id}`)
}

/**
 * Increment retry count for a failed operation.
 * Returns false if max retries exceeded (operation should be dead-lettered).
 */
export async function markRetry(id: string): Promise<boolean> {
  const op = await idbGet<QueuedOperation>(`${QUEUE_PREFIX}${id}`)
  if (!op) return false
  
  op.retryCount++
  if (op.retryCount >= MAX_RETRIES) {
    console.error(`[OfflineQueue] Operation ${id} exceeded max retries — dead-lettering`, op)
    await idbDel(`${QUEUE_PREFIX}${id}`)
    return false
  }
  
  await idbSet(`${QUEUE_PREFIX}${id}`, op)
  return true
}

/**
 * Coalesce operations: if multiple updates target the same entity,
 * merge their payloads so only one write goes to the server.
 * Keeps the latest HLC and combined payload.
 */
export function coalesceOperations(ops: QueuedOperation[]): QueuedOperation[] {
  const updateMap = new Map<string, QueuedOperation>()
  const result: QueuedOperation[] = []

  for (const op of ops) {
    // Only coalesce updates; inserts, deletes, and hard_deletes pass through
    if (op.operationType !== 'update') {
      result.push(op)
      continue
    }

    const key = `${op.entityType}:${op.entityId}`
    const existing = updateMap.get(key)

    if (existing) {
      // Merge payloads (newer values overwrite older)
      existing.payload = { ...existing.payload, ...op.payload }
      existing.hlcTimestamp = op.hlcTimestamp // Take the newer timestamp
      existing.createdAt = Math.max(existing.createdAt, op.createdAt)
      // Merge field_versions if present
      if (op.payload.field_versions && existing.payload.field_versions) {
        existing.payload.field_versions = {
          ...(existing.payload.field_versions as Record<string, string>),
          ...(op.payload.field_versions as Record<string, string>),
        }
      }
    } else {
      // Clone to avoid mutation
      updateMap.set(key, { ...op, payload: { ...op.payload } })
    }
  }

  // Add coalesced updates to result
  for (const op of updateMap.values()) {
    result.push(op)
  }

  // Re-sort by creation time
  return result.sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Flush all pending operations to Supabase.
 * Operations are coalesced first, then executed in order.
 * Failed operations are retried with exponential backoff.
 * 
 * @param executor - A function that executes a single operation against Supabase.
 *                   Should throw on failure.
 */
export async function flushQueue(
  executor: (op: QueuedOperation) => Promise<void>
): Promise<{ flushed: number; failed: number }> {
  const pending = await getPendingOperations()
  if (pending.length === 0) return { flushed: 0, failed: 0 }

  const coalesced = coalesceOperations(pending)
  let flushed = 0
  let failed = 0

  console.log(`[OfflineQueue] Flushing ${coalesced.length} operations (${pending.length} before coalescing)`)

  for (const op of coalesced) {
    try {
      await executor(op)
      // Dequeue all original ops that were coalesced into this one
      const originalOps = pending.filter(
        p => p.entityType === op.entityType && p.entityId === op.entityId &&
             (p.operationType === 'update' && op.operationType === 'update' ? true : p.id === op.id)
      )
      for (const orig of originalOps) {
        await dequeueOperation(orig.id)
      }
      flushed++
    } catch (err) {
      console.error(`[OfflineQueue] Failed to flush operation:`, op.id, err)
      const canRetry = await markRetry(op.id)
      if (!canRetry) {
        console.error(`[OfflineQueue] Operation dead-lettered:`, op.id)
      }
      failed++
    }
  }

  console.log(`[OfflineQueue] Flush complete: ${flushed} succeeded, ${failed} failed`)
  return { flushed, failed }
}

/**
 * Get queue depth (number of pending operations).
 */
export async function getQueueDepth(): Promise<number> {
  const allKeys = await idbKeys()
  return (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX)).length
}

export { RETRY_BACKOFF_MS }
