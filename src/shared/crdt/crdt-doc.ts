/**
 * CRDT Document Manager (Yjs)
 * 
 * Manages Y.Doc lifecycle for rich-text notes.
 * Handles bidirectional sync:
 *   Web  → writes Yjs state + body/excerpt to Supabase
 *   Mobile → writes body to Supabase → web detects via Realtime → updates Y.Doc
 * 
 * Uses IndexedDB for offline persistence of Yjs documents.
 */

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Editor } from '@tiptap/core'
import { getHeadlessExtensions } from './headless-extensions'

const IDB_PREFIX = 'synq-ydoc-'
const MAX_CACHED_DOCS = 10

// Cache of active Y.Doc instances (one per note)
const docCache = new Map<string, Y.Doc>()
const persistenceCache = new Map<string, IndexeddbPersistence>()
const docRefCount = new Map<string, number>()
const releaseTimers = new Map<string, NodeJS.Timeout>()

// Track which docs have been modified locally (to avoid echo loops)
const locallyModifiedDocs = new Set<string>()
const modifiedTimers = new Map<string, NodeJS.Timeout>()
// Suppress remote-to-ydoc updates while the user is actively editing
const activeEditDocs = new Set<string>()

/**
 * Get or create a Y.Doc for a given note ID.
 * The doc is automatically persisted to IndexedDB.
 */
export function getOrCreateYDoc(noteId: string): Y.Doc {
  const existing = docCache.get(noteId)
  if (existing) {
    // Move to the end of the Map's insertion order to maintain LRU behavior
    docCache.delete(noteId)
    docCache.set(noteId, existing)
    return existing
  }

  const ydoc = new Y.Doc()
  docCache.set(noteId, ydoc)

  // Set up IndexedDB persistence
  const persistence = new IndexeddbPersistence(`${IDB_PREFIX}${noteId}`, ydoc)
  persistenceCache.set(noteId, persistence)

  // Evict idle docs to prevent unbounded memory growth in long sessions
  evictIdleDocs()

  return ydoc
}

/**
 * Acquire a Y.Doc, incrementing its reference count.
 * Cancels any scheduled release/destruction timer.
 */
export function acquireYDoc(noteId: string): Y.Doc {
  const timer = releaseTimers.get(noteId)
  if (timer) {
    clearTimeout(timer)
    releaseTimers.delete(noteId)
  }

  const currentCount = docRefCount.get(noteId) || 0
  docRefCount.set(noteId, currentCount + 1)

  return getOrCreateYDoc(noteId)
}

/**
 * Release a Y.Doc reference.
 * If the reference count drops to 0, schedules destruction after a 30-second delay
 * to allow quick transitions back to the same note.
 */
export function releaseYDoc(noteId: string): void {
  const currentCount = docRefCount.get(noteId) || 0
  const nextCount = Math.max(0, currentCount - 1)

  if (nextCount === 0) {
    docRefCount.delete(noteId)
    const existing = releaseTimers.get(noteId)
    if (existing) clearTimeout(existing)

    releaseTimers.set(noteId, setTimeout(() => {
      releaseTimers.delete(noteId)
      destroyYDoc(noteId)
      console.log(`[CRDTDoc] Reference count reached 0 for ${noteId.slice(0, 8)}… — destroyed idle doc`)
    }, 30000))
  } else {
    docRefCount.set(noteId, nextCount)
  }
}


/**
 * Get the XML fragment used by TipTap's collaboration extension.
 */
export function getYFragment(noteId: string): Y.XmlFragment {
  const ydoc = getOrCreateYDoc(noteId)
  return ydoc.getXmlFragment('content')
}

/**
 * Wait for IndexedDB persistence to finish syncing.
 */
export async function waitForPersistence(noteId: string): Promise<void> {
  const persistence = persistenceCache.get(noteId)
  if (!persistence) return
  
  if (persistence.synced) return
  
  return new Promise<void>((resolve) => {
    persistence.once('synced', () => resolve())
  })
}

/**
 * Apply a Yjs state update (binary) from a remote source.
 * Used when receiving CRDT state from Supabase.
 */
export function applyRemoteUpdate(noteId: string, update: Uint8Array): void {
  const ydoc = getOrCreateYDoc(noteId)
  
  // Don't apply if the user is actively editing this note on web
  // and the update would cause a significant shift, but for CRDTs 
  // we usually want to merge regardless. 
  // However, we MUST use an origin to avoid save loops.
  ydoc.transact(() => {
    Y.applyUpdate(ydoc, update)
  }, 'remote')
}

/**
 * Apply remote update only if a Y.Doc is already loaded in-memory.
 * This avoids eagerly instantiating docs for background notes.
 */
export function applyRemoteUpdateIfLoaded(noteId: string, update: Uint8Array): boolean {
  const existing = docCache.get(noteId)
  if (!existing) return false
  existing.transact(() => {
    Y.applyUpdate(existing, update)
  }, 'remote')
  return true
}

/**
 * Get the full Yjs state as a binary snapshot.
 * Used for persisting to Supabase crdt_documents table.
 */
export function getDocState(noteId: string): Uint8Array {
  const ydoc = getOrCreateYDoc(noteId)
  return Y.encodeStateAsUpdate(ydoc)
}

/**
 * Get the state vector (for incremental sync).
 */
export function getStateVector(noteId: string): Uint8Array {
  const ydoc = getOrCreateYDoc(noteId)
  return Y.encodeStateVector(ydoc)
}

/**
 * Get incremental update since a given state vector.
 */
export function getStateDiff(noteId: string, remoteStateVector: Uint8Array): Uint8Array {
  const ydoc = getOrCreateYDoc(noteId)
  return Y.encodeStateAsUpdate(ydoc, remoteStateVector)
}

/**
 * Initialize a Y.Doc from existing TipTap JSONContent.
 * Used for migrating existing notes to Yjs.
 * 
 * This converts JSON content to plain text and inserts it into the Y.Doc's
 * XML fragment. TipTap's collaboration extension will then maintain it.
 */
export async function initYDocFromMarkdown(noteId: string, markdown: string): Promise<Y.Doc> {
  const ydoc = getOrCreateYDoc(noteId)
  
  // Wait for IndexedDB persistence to finish loading before checking fragment length
  await waitForPersistence(noteId)
  
  const fragment = ydoc.getXmlFragment('content')
  
  // Only initialize if the fragment is empty (don't overwrite existing CRDT state)
  if (fragment.length === 0 && markdown.trim()) {
    ydoc.transact(() => {
      const editor = new Editor({
        extensions: getHeadlessExtensions(ydoc)
      })
      editor.commands.setContent(markdown)
      editor.destroy()
    })
  }
  
  return ydoc
}

import { isEmptyQuillDelta } from '../../lib/utils/quill-utils'

/**
 * Apply a plain-text body update from mobile (Flutter).
 * This is the Mobile → Web bridge:
 * When Flutter writes a new `body` field, we update the Yjs document.
 * 
 * @param noteId - The note being updated
 * @param newBody - The new plain text body from mobile
 */
export function applyMobileBodyUpdate(noteId: string, newBody: string): void {
  // Don't apply if the user is actively editing this note on web
  if (activeEditDocs.has(noteId)) {
    console.log(`[CRDTDoc] Skipping mobile body update for ${noteId.slice(0, 8)}… — actively editing`)
    return
  }

  const ydoc = getOrCreateYDoc(noteId)

  ydoc.transact(() => {
    const editor = new Editor({
      extensions: getHeadlessExtensions(ydoc)
    })
    if (!isEmptyQuillDelta(newBody)) {
      editor.commands.setContent(newBody)
    } else {
      editor.commands.setContent('')
    }
    editor.destroy()
  }, 'mobile-sync')  // Origin tag to identify this transaction
}

/**
 * Mark a doc as locally modified (to prevent echo on Realtime).
 */
export function markLocallyModified(noteId: string): void {
  locallyModifiedDocs.add(noteId)
  // Debounce: clear any existing timer for this note, then set a new one
  const existing = modifiedTimers.get(noteId)
  if (existing) clearTimeout(existing)
  modifiedTimers.set(noteId, setTimeout(() => {
    locallyModifiedDocs.delete(noteId)
    modifiedTimers.delete(noteId)
  }, 5000))
}

/**
 * Mark a doc as actively being edited (suppress mobile overwrites).
 */
export function setActiveEdit(noteId: string, active: boolean): void {
  if (active) {
    activeEditDocs.add(noteId)
  } else {
    activeEditDocs.delete(noteId)
  }
}

/**
 * Extract markdown from a Y.Doc's content fragment.
 * Used to generate the `body` field for Flutter compatibility.
 */
export function getMarkdownFromYDoc(noteId: string): string {
  const ydoc = docCache.get(noteId)
  if (!ydoc) return ''

  const editor = new Editor({
    extensions: getHeadlessExtensions(ydoc)
  })
  const text = (editor.storage as any).markdown.getMarkdown()
  editor.destroy()
  return text
}

/**
 * Build an excerpt from Y.Doc content.
 */
export function getExcerptFromYDoc(noteId: string): string | null {
  const text = getMarkdownFromYDoc(noteId)
  if (!text) return null
  return text.length > 100 ? `${text.slice(0, 100)}...` : text
}

/**
 * Destroy a Y.Doc and clean up its persistence.
 */
export function destroyYDoc(noteId: string): void {
  const ydoc = docCache.get(noteId)
  if (ydoc) {
    ydoc.destroy()
    docCache.delete(noteId)
  }

  const persistence = persistenceCache.get(noteId)
  if (persistence) {
    persistence.destroy()
    persistenceCache.delete(noteId)
  }

  docRefCount.delete(noteId)
  const releaseTimer = releaseTimers.get(noteId)
  if (releaseTimer) {
    clearTimeout(releaseTimer)
    releaseTimers.delete(noteId)
  }

  locallyModifiedDocs.delete(noteId)
  activeEditDocs.delete(noteId)

  const timer = modifiedTimers.get(noteId)
  if (timer) {
    clearTimeout(timer)
    modifiedTimers.delete(noteId)
  }
}

/**
 * Destroy all docs (cleanup on sign-out).
 */
export function destroyAllYDocs(): void {
  // Clear all modified timers first
  for (const timer of modifiedTimers.values()) {
    clearTimeout(timer)
  }
  modifiedTimers.clear()

  // Clear all release timers
  for (const timer of releaseTimers.values()) {
    clearTimeout(timer)
  }
  releaseTimers.clear()
  docRefCount.clear()

  for (const [noteId] of docCache) {
    destroyYDoc(noteId)
  }
}

/**
 * Evict idle Y.Docs when the cache exceeds MAX_CACHED_DOCS.
 * Skips docs that are actively being edited.
 */
function evictIdleDocs(): void {
  if (docCache.size <= MAX_CACHED_DOCS) return
  const toEvict = docCache.size - MAX_CACHED_DOCS
  let evicted = 0
  for (const [noteId] of docCache) {
    if (activeEditDocs.has(noteId)) continue
    destroyYDoc(noteId)
    if (++evicted >= toEvict) break
  }
}

/**
 * Check if a Y.Doc exists in cache (has been opened this session).
 */
export function hasYDoc(noteId: string): boolean {
  return docCache.has(noteId)
}

/**
 * Get count of active Y.Docs.
 */
export function getActiveDocCount(): number {
  return docCache.size
}
