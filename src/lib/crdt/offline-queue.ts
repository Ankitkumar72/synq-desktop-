
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import { isNonRetryableError } from './oplog'

const __DEV__ = process.env.NODE_ENV !== 'production'
export interface QueuedOperation {
  id: string              
  entityType: 'task' | 'project' | 'event' | 'note' | 'folder'
  entityId: string        
  operationType: 'insert' | 'update' | 'delete' | 'hard_delete'

  payload: Record<string, unknown>   
  hlcTimestamp: string     
  createdAt: number        
  retryCount: number       
}

const QUEUE_PREFIX = 'synq-opq:'
const MAX_RETRIES = 5
const RETRY_BACKOFF_MS = 2000

function generateOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

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

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const allKeys = await idbKeys()
  const queueKeys = (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX))

  const ops: QueuedOperation[] = []
  for (const key of queueKeys) {
    const op = await idbGet<QueuedOperation>(key)
    if (op) ops.push(op)
  }

  return ops.sort((a, b) => a.createdAt - b.createdAt)
}

export async function dequeueOperation(id: string): Promise<void> {
  await idbDel(`${QUEUE_PREFIX}${id}`)
}

export async function markRetry(id: string): Promise<boolean> {
  const op = await idbGet<QueuedOperation>(`${QUEUE_PREFIX}${id}`)
  if (!op) return false

  op.retryCount++
  if (op.retryCount >= MAX_RETRIES) {
    op.retryCount = MAX_RETRIES
    if (__DEV__) console.error(`[OfflineQueue] Operation ${id} reached retry cap; keeping for later retry`, op)
  }

  await idbSet(`${QUEUE_PREFIX}${id}`, op)
  return true
}

export function coalesceOperations(ops: QueuedOperation[]): QueuedOperation[] {
  const updateMap = new Map<string, QueuedOperation>()
  const result: QueuedOperation[] = []

  for (const op of ops) {

    if (op.operationType !== 'update') {
      result.push(op)
      continue
    }

    const key = `${op.entityType}:${op.entityId}`
    const existing = updateMap.get(key)

    if (existing) {

      existing.payload = { ...existing.payload, ...op.payload }
      existing.hlcTimestamp = op.hlcTimestamp 
      existing.createdAt = Math.max(existing.createdAt, op.createdAt)

      if (op.payload.field_versions && existing.payload.field_versions) {
        existing.payload.field_versions = {
          ...(existing.payload.field_versions as Record<string, string>),
          ...(op.payload.field_versions as Record<string, string>),
        }
      }
    } else {

      updateMap.set(key, { ...op, payload: { ...op.payload } })
    }
  }

  for (const op of updateMap.values()) {
    result.push(op)
  }

  return result.sort((a, b) => a.createdAt - b.createdAt)
}

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

      const originalOps = pending.filter(
        p => p.entityType === op.entityType && p.entityId === op.entityId &&
             (p.operationType === 'update' && op.operationType === 'update' ? true : p.id === op.id)
      )
      for (const orig of originalOps) {
        await dequeueOperation(orig.id)
      }
      flushed++
    } catch (err) {

      if (isNonRetryableError(err)) {
        if (__DEV__) console.error(`[OfflineQueue] Non-retryable error for op ${op.id}, discarding:`, err)
        const originalOps = pending.filter(
          p => p.entityType === op.entityType && p.entityId === op.entityId &&
               (p.operationType === 'update' && op.operationType === 'update' ? true : p.id === op.id)
        )
        for (const orig of originalOps) {
          await dequeueOperation(orig.id)
        }
        failed++
        continue
      }

      if (op.retryCount >= MAX_RETRIES) {
        if (__DEV__) console.error(`[OfflineQueue] Op ${op.id} exceeded ${MAX_RETRIES} retries, dead-lettering`)
        await dequeueOperation(op.id)
        failed++
        continue
      }

      if (__DEV__) console.error(`[OfflineQueue] Failed to flush operation:`, op.id, err)
      const canRetry = await markRetry(op.id)
      if (!canRetry) {
        if (__DEV__) console.error(`[OfflineQueue] Operation retry bookkeeping failed:`, op.id)
      }
      failed++
    }
  }

  console.log(`[OfflineQueue] Flush complete: ${flushed} succeeded, ${failed} failed`)
  return { flushed, failed }
}

export async function getQueueDepth(): Promise<number> {
  const allKeys = await idbKeys()
  return (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX)).length
}

export { RETRY_BACKOFF_MS }

