import * as Y from 'yjs'
import { idbStorage } from '@/shared/store/idb-storage'

// Typed RPC messages
export type WorkerRequest = 
  | { type: 'INIT_DOC', noteId: string }
  | { type: 'PERSIST_UPDATE', noteId: string, update: Uint8Array }
  | { type: 'PROCESS_OPLOG_QUEUE', noteId: string, oplogRows: any[] }
  | { type: 'GENERATE_SNAPSHOT', noteId: string }

export type WorkerResponse =
  | { type: 'ACK', msgId: string }
  | { type: 'DOC_LOADED', noteId: string, stateVector?: Uint8Array }
  | { type: 'PATCH_READY', noteId: string, update: Uint8Array }
  | { type: 'ERROR', error: string }

const docs: Map<string, Y.Doc> = new Map()

self.onmessage = async (e: MessageEvent<{ msgId: string, req: WorkerRequest }>) => {
  const { msgId, req } = e.data
  try {
    switch (req.type) {
      case 'INIT_DOC':
        await handleInitDoc(req.noteId)
        self.postMessage({ type: 'ACK', msgId })
        break
      case 'PERSIST_UPDATE':
        await handlePersistUpdate(req.noteId, req.update)
        self.postMessage({ type: 'ACK', msgId })
        break
      case 'PROCESS_OPLOG_QUEUE':
        const patch = await handleProcessOplog(req.noteId, req.oplogRows)
        if (patch) {
          self.postMessage({ type: 'PATCH_READY', noteId: req.noteId, update: patch })
        }
        self.postMessage({ type: 'ACK', msgId })
        break
      case 'GENERATE_SNAPSHOT':
        // stub for generating snapshot and compression
        self.postMessage({ type: 'ACK', msgId })
        break
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', msgId, error: err.message })
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

async function handleInitDoc(noteId: string) {
  if (!docs.has(noteId)) {
    docs.set(noteId, new Y.Doc())
  }
  // Load from IndexedDB
  const storedStr = await idbStorage.getItem(`crdt:${noteId}`)
  if (storedStr) {
    const doc = docs.get(noteId)!
    Y.applyUpdate(doc, base64ToUint8Array(storedStr))
  }
}

async function handlePersistUpdate(noteId: string, update: Uint8Array) {
  let doc = docs.get(noteId)
  if (!doc) {
    doc = new Y.Doc()
    docs.set(noteId, doc)
    const storedStr = await idbStorage.getItem(`crdt:${noteId}`)
    if (storedStr) Y.applyUpdate(doc, base64ToUint8Array(storedStr))
  }
  Y.applyUpdate(doc, update)
  const newState = Y.encodeStateAsUpdate(doc)
  await idbStorage.setItem(`crdt:${noteId}`, uint8ArrayToBase64(newState))
}

async function handleProcessOplog(noteId: string, oplogRows: any[]): Promise<Uint8Array | null> {
  let doc = docs.get(noteId)
  if (!doc) {
    doc = new Y.Doc()
    docs.set(noteId, doc)
  }
  
  let applied = false
  for (const row of oplogRows) {
    if (row.update_data) {
      // In a real app we might chunk this array and yield to event loop
      // to avoid blocking the worker for too long on massive queues
      const update = new Uint8Array(row.update_data)
      Y.applyUpdate(doc, update)
      applied = true
    }
  }
  
  if (applied) {
    const newState = Y.encodeStateAsUpdate(doc)
    await idbStorage.setItem(`crdt:${noteId}`, uint8ArrayToBase64(newState))
    return newState
  }
  
  return null
}
