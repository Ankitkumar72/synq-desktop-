

import { supabase, isGhostClient } from '../supabase/supabase'
import { hlc } from '../hlc'
// Removed old oplog imports.
// Now using the unified mutation delivery system for CRDT updates.
import { MutationManager } from '../sync/mutation-manager'
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



// CircuitBreaker removed as logic was moved to new dispatcher

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

  initCRDTWorker()

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  isOnline = navigator?.onLine ?? true
  console.log(`[SyncManager] Initialized. Online: ${isOnline}`)

  if (isOnline) {
    scheduleFlush(3000) 
  }
}

let crdtWorker: Worker | null = null
const workerResolvers = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>()

function initCRDTWorker() {
  if (crdtWorker || typeof window === 'undefined') return
  
  crdtWorker = new Worker(new URL('./crdt.worker.ts', import.meta.url), { type: 'module' })
  
  crdtWorker.onmessage = (e) => {
    const data = e.data
    if (data.type === 'ACK' || data.type === 'ERROR') {
      const p = workerResolvers.get(data.msgId)
      if (p) {
        if (data.type === 'ERROR') p.reject(new Error(data.error))
        else p.resolve(data)
        workerResolvers.delete(data.msgId)
      }
    } else if (data.type === 'PATCH_READY') {
      // In hybrid architecture, we take the pre-computed patch from the background worker
      // and apply it to the main thread's live Y.Doc without blocking on the diff computation.
      import('./crdt-doc').then(({ applyRemoteUpdateIfLoaded }) => {
        applyRemoteUpdateIfLoaded(data.noteId, data.update)
      })
    }
  }
}

export function postToCRDTWorker(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!crdtWorker) {
      reject(new Error('CRDT Worker not initialized'))
      return
    }
    const msgId = crypto.randomUUID()
    workerResolvers.set(msgId, { resolve, reject })
    crdtWorker.postMessage({ msgId, req })
  })
}

export function destroySyncManager(): void {
  if (crdtWorker) {
    crdtWorker.terminate()
    crdtWorker = null
  }
  workerResolvers.clear()
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
      const crudDepth = await getQueueDepth()
      if (crudDepth === 0) break

      const crudResult = await flushQueue(executeOperation)

      const newCrudDepth = await getQueueDepth()
      notifyQueueListeners(newCrudDepth)
      
      Telemetry.trackQueueDepth(newCrudDepth, 0)

      if (crudResult.failed > 0) {
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

interface SaveYDocOptions {
  updateData?: Uint8Array
  opId?: string
  snapshot?: Uint8Array | null
  content?: unknown
  fieldVersions?: Record<string, string>
  allowEmptyBody?: boolean
}

export async function saveYDocToSupabase(noteId: string, userId: string, options: SaveYDocOptions = {}): Promise<void> {
  const state = getDocState(noteId)
  const updateData = options.updateData && options.updateData.length > 0 ? options.updateData : state
  const body = getMarkdownFromYDoc(noteId)
  const plainText = getPlainTextFromYDoc(noteId)
  const excerpt = getExcerptFromYDoc(noteId)
  const updatedAt = new Date().toISOString()
  const opId = options.opId || createOpId()
  const clientId = hlc.getNodeId()
  const snapshot = options.snapshot === undefined ? state : options.snapshot
  const content = options.content

  markLocallyModified(noteId)

  // Submit via the new unified MutationManager pipeline
  // This is durable before network, so we don't need to try RPC first and fallback to queue.
  await MutationManager.submit(
    'default', // workspaceId placeholder if we don't have it globally scoped here
    noteId,
    'NOTE_CRDT_UPDATE',
    {
      noteId,
      userId,
      clientId,
      opId,
      updateData: updateData ? Array.from(updateData) : null,
      snapshot: snapshot ? Array.from(snapshot) : null,
      body,
      excerpt,
      updatedAt,
      content,
      contentMarkdown: body,
      plainText,
      fieldVersions: options.fieldVersions,
      allowEmptyBody: options.allowEmptyBody ?? false,
    }
  );
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
  const crudDepth = await getQueueDepth()
  return crudDepth
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
