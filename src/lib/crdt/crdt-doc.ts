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

const IDB_PREFIX = 'synq-ydoc-'

// Cache of active Y.Doc instances (one per note)
const docCache = new Map<string, Y.Doc>()
const persistenceCache = new Map<string, IndexeddbPersistence>()

// Track which docs have been modified locally (to avoid echo loops)
const locallyModifiedDocs = new Set<string>()
// Suppress remote-to-ydoc updates while the user is actively editing
const activeEditDocs = new Set<string>()

/**
 * Get or create a Y.Doc for a given note ID.
 * The doc is automatically persisted to IndexedDB.
 */
export function getOrCreateYDoc(noteId: string): Y.Doc {
  const existing = docCache.get(noteId)
  if (existing) return existing

  const ydoc = new Y.Doc()
  docCache.set(noteId, ydoc)

  // Set up IndexedDB persistence
  const persistence = new IndexeddbPersistence(`${IDB_PREFIX}${noteId}`, ydoc)
  persistenceCache.set(noteId, persistence)

  return ydoc
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
export function initYDocFromPlainText(noteId: string, plainText: string): Y.Doc {
  const ydoc = getOrCreateYDoc(noteId)
  const fragment = ydoc.getXmlFragment('content')
  
  // Only initialize if the fragment is empty (don't overwrite existing CRDT state)
  if (fragment.length === 0 && plainText.trim()) {
    ydoc.transact(() => {
      const paragraphs = plainText.split('\n')
      for (const para of paragraphs) {
        const element = new Y.XmlElement('paragraph')
        if (para.trim()) {
          element.insert(0, [new Y.XmlText(para)])
        }
        fragment.push([element])
      }
    })
  }
  
  return ydoc
}

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

  // Don't apply if we just wrote this body ourselves (echo prevention)
  if (locallyModifiedDocs.has(noteId)) {
    locallyModifiedDocs.delete(noteId)
    return
  }

  const ydoc = getOrCreateYDoc(noteId)
  const fragment = ydoc.getXmlFragment('content')

  ydoc.transact(() => {
    // Clear existing content
    while (fragment.length > 0) {
      fragment.delete(0, 1)
    }

    // Insert new content from mobile's plain text
    const paragraphs = (newBody || '').split('\n')
    for (const para of paragraphs) {
      const element = new Y.XmlElement('paragraph')
      if (para.trim()) {
        element.insert(0, [new Y.XmlText(para)])
      }
      fragment.push([element])
    }
  }, 'mobile-sync')  // Origin tag to identify this transaction
}

/**
 * Mark a doc as locally modified (to prevent echo on Realtime).
 */
export function markLocallyModified(noteId: string): void {
  locallyModifiedDocs.add(noteId)
  // Auto-clear after 5 seconds as a safety net
  setTimeout(() => locallyModifiedDocs.delete(noteId), 5000)
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
 * Extract plain text from a Y.Doc's content fragment.
 * Used to generate the `body` field for Flutter compatibility.
 */
export function getPlainTextFromYDoc(noteId: string): string {
  const ydoc = docCache.get(noteId)
  if (!ydoc) return ''

  const fragment = ydoc.getXmlFragment('content')
  return extractTextFromFragment(fragment)
}

function extractTextFromFragment(fragment: Y.XmlFragment): string {
  const parts: string[] = []

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i)
    if (child instanceof Y.XmlText) {
      parts.push(child.toString())
    } else if (child instanceof Y.XmlElement) {
      parts.push(extractTextFromElement(child))
    }
  }

  return parts.join('\n')
}

function extractTextFromElement(element: Y.XmlElement): string {
  const parts: string[] = []

  for (let i = 0; i < element.length; i++) {
    const child = element.get(i)
    if (child instanceof Y.XmlText) {
      parts.push(child.toString())
    } else if (child instanceof Y.XmlElement) {
      parts.push(extractTextFromElement(child))
    }
  }

  return parts.join('')
}

/**
 * Build an excerpt from Y.Doc content.
 */
export function getExcerptFromYDoc(noteId: string): string | null {
  const text = getPlainTextFromYDoc(noteId)
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

  locallyModifiedDocs.delete(noteId)
  activeEditDocs.delete(noteId)
}

/**
 * Destroy all docs (cleanup on sign-out).
 */
export function destroyAllYDocs(): void {
  for (const [noteId] of docCache) {
    destroyYDoc(noteId)
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
