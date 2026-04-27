import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TABLES, COLUMNS } from '@/lib/constants'
import { hlc, HLC } from '@/lib/hlc'
import { Note } from '@/types'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'
import { enqueueOperation } from '@/lib/crdt/offline-queue'
import { triggerFlush, getOnlineStatus, saveYDocToSupabase } from '@/lib/crdt/sync-manager'
import { 
  getOrCreateYDoc, 
  setActiveEdit, 
  markLocallyModified, 
  applyMobileBodyUpdate,
  getPlainTextFromYDoc,
  getExcerptFromYDoc,
  initYDocFromPlainText,
  destroyYDoc,
} from '@/lib/crdt/crdt-doc'

export function sanitizeNote(note: Partial<Note>): Note {
  return {
    ...note,
    title: note.title ?? '',
    content: note.content || null,
    body: note.body || null,
    excerpt: note.excerpt || null,
    tags: Array.isArray(note.tags) ? note.tags : [],
    category: note.category ?? 'personal',
    priority: note.priority ?? 'none',
    hlc_timestamp: note.hlc_timestamp || hlc.now(),
    is_deleted: note.is_deleted ?? false,
    pinned: note.pinned ?? false,
    updated_at: note.updated_at ?? new Date().toISOString(),
    created_at: note.created_at ?? new Date().toISOString(),
    field_versions: note.field_versions || {}
  } as Note;
}

interface NotesState {
  notes: Note[]
  selectedNoteId: string | null
  activeEditNoteId: string | null
  activeEditAt: number
  isLoading: boolean
  error: string | null
  setNotes: (notes: Note[]) => void
  addNote: (note: Partial<Note> & { title: string }) => Promise<string | undefined>
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>
  updateNoteLocal: (id: string, updates: Partial<Note>) => void
  mergeNoteLocal: (remoteNote: Note) => void
  deleteNote: (id: string) => Promise<void>
  restoreNote: (id: string) => Promise<void>
  permanentlyDeleteNote: (id: string) => Promise<void>
  fetchNotes: (includeDeleted?: boolean) => Promise<void>
  setSelectedNoteId: (id: string | null) => void
  pinNote: (id: string, isPinned: boolean) => Promise<void>
  focusedNoteId: string | null
  setFocusedNoteId: (id: string | null) => void
  markNoteActivity: (id: string) => void
  clearActiveNoteActivity: (id?: string) => void
  saveNoteContent: (id: string) => Promise<void>
  clearStore: () => void
}

const ACTIVE_NOTE_EDIT_GRACE_MS = 1500

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      selectedNoteId: null,
      activeEditNoteId: null,
      activeEditAt: 0,
      isLoading: false,
      error: null,
      focusedNoteId: null,
      setFocusedNoteId: (id) => set({ focusedNoteId: id }),
      
      markNoteActivity: (id) => {
        set({ activeEditNoteId: id, activeEditAt: Date.now() })
        // Tell the CRDT doc manager this note is being actively edited
        setActiveEdit(id, true)
      },
      
      clearActiveNoteActivity: (id) => {
        set((state) => {
          if (!id || state.activeEditNoteId === id) {
            // Clear the active edit flag on the CRDT doc manager
            if (state.activeEditNoteId) {
              setActiveEdit(state.activeEditNoteId, false)
            }
            return { activeEditNoteId: null, activeEditAt: 0 }
          }
          return {}
        })
      },

      setNotes: (notes) => set((state) => ({ 
        notes, 
        selectedNoteId: state.selectedNoteId || (notes.length > 0 ? notes[0].id : null)
      })),

      addNote: async (note) => {
        console.log('[NotesStore] Attempting to add note:', note.title);
        if (!supabase) {
          console.error('[NotesStore] Supabase client not initialized');
          return undefined;
        }

        try {
          let userId = useUserStore.getState().user?.id
          if (!userId) {
            const { data: { user } } = await supabase.auth.getUser()
            userId = user?.id
          }

          if (!userId) {
            console.error('[NotesStore] No authenticated user found');
            return undefined;
          }

          const timestamp = hlc.increment()
          const now = new Date().toISOString()
          
          // Robust UUID generation
          const noteId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          
          const newFieldVersions: Record<string, string> = {}
          const defaultFields = ['title', 'content', 'body', 'excerpt', 'pinned', 'category', 'priority', 'updated_at', 'created_at']
          
          defaultFields.forEach(key => {
            newFieldVersions[key] = timestamp
          })

          const fullNote = sanitizeNote({
            ...note,
            id: noteId,
            user_id: userId,
            hlc_timestamp: timestamp,
            field_versions: newFieldVersions,
            updated_at: now,
            created_at: now,
            category: note.category || 'personal',
            priority: note.priority || 'none'
          })

          // Initialize a Y.Doc for this new note
          getOrCreateYDoc(noteId)

          // OPTIMISTIC UPDATE: Add to local state immediately
          set((state) => ({ 
            notes: [fullNote, ...state.notes],
            selectedNoteId: fullNote.id // Auto-select new note
          }))

          if (getOnlineStatus()) {
            console.log('[NotesStore] Inserting note into database:', noteId);
            const { data, error } = await supabase
              .from(TABLES.NOTES)
              .insert([fullNote])
              .select()

            if (error) {
              console.error('[NotesStore] Database error, queueing for retry:', error.message);
              await enqueueOperation({
                entityType: 'note',
                entityId: noteId,
                operationType: 'insert',
                payload: fullNote,
                hlcTimestamp: timestamp,
              })
              triggerFlush()
            } else if (data?.[0]) {
              set((state) => ({ 
                notes: state.notes.map(n => n.id === noteId ? data[0] : n)
              }))
            }
          } else {
            await enqueueOperation({
              entityType: 'note',
              entityId: noteId,
              operationType: 'insert',
              payload: fullNote,
              hlcTimestamp: timestamp,
            })
          }
          
          console.log('[NotesStore] Note created successfully:', noteId);
          return noteId
        } catch (err) {
          console.error('[NotesStore] Unexpected error in addNote:', err);
          return undefined;
        }
      },

      updateNote: async (id, updates) => {
        if (!supabase) return

        const timestamp = hlc.increment()
        const existingNote = get().notes.find(n => n.id === id)
        const newFieldVersions: Record<string, string> = { ...(existingNote?.field_versions || {}) }
        
        Object.keys(updates).forEach(key => {
          newFieldVersions[key] = timestamp
        })

        if ('content' in updates) newFieldVersions['body'] = timestamp;
        if ('body' in updates) newFieldVersions['content'] = timestamp;
        newFieldVersions['updated_at'] = timestamp;

        const syncUpdates: Partial<Note> = {
          ...updates,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          updated_at: new Date().toISOString()
        }

        // Mark as locally modified to prevent echo
        markLocallyModified(id)

        // Optimistic local update
        get().updateNoteLocal(id, syncUpdates)

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.NOTES).update(syncUpdates).eq(COLUMNS.ID, id)
          if (error) {
            console.error('Error updating note:', error)
            await enqueueOperation({
              entityType: 'note',
              entityId: id,
              operationType: 'update',
              payload: syncUpdates,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          }
        } else {
          await enqueueOperation({
            entityType: 'note',
            entityId: id,
            operationType: 'update',
            payload: syncUpdates,
            hlcTimestamp: timestamp,
          })
        }
      },

      updateNoteLocal: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n))
        }))
      },

      /**
       * CRDT merge: merge a remote note into local state using per-field LWW.
       * Also handles bidirectional mobile sync via body field.
       */
      mergeNoteLocal: (remoteNote) => {
        // Sync our local clock with the incoming note to prevent drift
        hlc.receive(remoteNote.hlc_timestamp)

        set((state) => {
          const existingIndex = state.notes.findIndex(n => n.id === remoteNote.id)
          
          if (existingIndex === -1) {
            // New note arrived from remote
            // Initialize Yjs doc from the body if it has text content
            if (remoteNote.body) {
              initYDocFromPlainText(remoteNote.id, remoteNote.body)
            }
            return { notes: [sanitizeNote(remoteNote), ...state.notes] }
          }

          const existing = state.notes[existingIndex]
          const isActivelyEditing =
            state.activeEditNoteId === remoteNote.id &&
            (Date.now() - state.activeEditAt) < ACTIVE_NOTE_EDIT_GRACE_MS
          
          // If the whole record is newer, or we don't have field versions, merge it
          if (HLC.compare(remoteNote.hlc_timestamp, existing.hlc_timestamp) > 0) {
            const mergedNode = { ...existing }
            const remoteFields = remoteNote.field_versions || {}
            const localFields = existing.field_versions || {}
            const hasRemoteFieldVersions = Object.keys(remoteFields).length > 0
            const mergedFieldVersions: Record<string, string> = { ...localFields }

            Object.entries(remoteNote).forEach(([key, value]) => {
              if (key === 'field_versions' || key === 'hlc_timestamp') return

              // For content/body, check if this came from mobile and update Yjs
              if (key === 'body' && !isActivelyEditing) {
                const remoteV = remoteFields[key]
                const localV = localFields[key]
                if (remoteV && (!localV || HLC.compare(remoteV, localV) > 0)) {
                  // This body change came from mobile — bridge to Yjs
                  const remoteNodeId = HLC.extractNodeId(remoteNote.hlc_timestamp)
                  if (!remoteNodeId.startsWith('web')) {
                    // Mobile edit detected — update Yjs doc
                    applyMobileBodyUpdate(remoteNote.id, value as string)
                  }
                }
              }

              if (isActivelyEditing && (key === 'content' || key === 'body' || key === 'excerpt')) {
                return
              }

              const remoteV = remoteFields[key]
              const localV = localFields[key]

              if (hasRemoteFieldVersions) {
                if (remoteV && (!localV || HLC.compare(remoteV, localV) > 0)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mergedNode as any)[key] = value
                  mergedFieldVersions[key] = remoteV
                }
              } else if (value !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (mergedNode as any)[key] = value
                mergedFieldVersions[key] = remoteNote.hlc_timestamp
              }
            })

            mergedNode.hlc_timestamp = remoteNote.hlc_timestamp
            mergedNode.field_versions = mergedFieldVersions
            
            const newNotes = [...state.notes]
            newNotes[existingIndex] = mergedNode
            return { notes: newNotes }
          }

          return state // No update needed
        })
      },

      /**
       * Save the current Yjs document state for a note to Supabase.
       * This also extracts body/excerpt for Flutter compatibility.
       */
      saveNoteContent: async (id) => {
        const userId = useUserStore.getState().user?.id
        if (!userId) return

        // Get body/excerpt from Yjs doc
        const body = getPlainTextFromYDoc(id)
        const excerpt = getExcerptFromYDoc(id)

        // Update local note state with latest body/excerpt
        get().updateNoteLocal(id, { body, excerpt })

        // Save Yjs state to Supabase (also writes body/excerpt)
        await saveYDocToSupabase(id, userId)
      },

      deleteNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        
        const existingNote = get().notes.find(n => n.id === id)
        const newFieldVersions: Record<string, string> = { ...(existingNote?.field_versions || {}) }
        newFieldVersions['deleted_at'] = timestamp
        newFieldVersions['is_deleted'] = timestamp
        newFieldVersions['updated_at'] = timestamp
        
        // Optimistic update
        set(state => ({
          notes: state.notes.map(n => n.id === id ? { ...n, deleted_at: now, is_deleted: true, field_versions: newFieldVersions } : n)
        }))

        // Clean up Yjs doc
        destroyYDoc(id)

        const payload = { 
          [COLUMNS.DELETED_AT]: now,
          [COLUMNS.IS_DELETED]: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          [COLUMNS.UPDATED_AT]: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.NOTES).update(payload).eq(COLUMNS.ID, id)
          if (error) {
            console.error('Error moving note to trash:', error)
            await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      restoreNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        
        const existingNote = get().notes.find(n => n.id === id)
        const newFieldVersions: Record<string, string> = { ...(existingNote?.field_versions || {}) }
        newFieldVersions['deleted_at'] = timestamp
        newFieldVersions['is_deleted'] = timestamp
        newFieldVersions['updated_at'] = timestamp
        
        // Optimistic update
        set(state => ({
          notes: state.notes.map(n => n.id === id ? { ...n, deleted_at: undefined, is_deleted: false, field_versions: newFieldVersions } : n)
        }))

        const payload = { 
          [COLUMNS.DELETED_AT]: null,
          [COLUMNS.IS_DELETED]: false,
          deleted_hlc: null,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          [COLUMNS.UPDATED_AT]: new Date().toISOString()
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.NOTES).update(payload).eq(COLUMNS.ID, id)
          if (error) {
            console.error('Error restoring note:', error)
            await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      permanentlyDeleteNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        // Clean up Yjs doc
        destroyYDoc(id)

        set(state => ({
          notes: state.notes.filter(n => n.id !== id),
          selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.NOTES).delete().eq(COLUMNS.ID, id)
          if (error) {
            console.error('Error permanently deleting note:', error)
            await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'hard_delete', payload: {}, hlcTimestamp: hlc.increment() })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'hard_delete', payload: {}, hlcTimestamp: hlc.increment() })
        }
      },

      setSelectedNoteId: (id) => set({ selectedNoteId: id }),

      fetchNotes: async (includeDeleted = false) => {
        if (!supabase) return
        
        const userId = useUserStore.getState().user?.id
        if (!userId) {
          console.warn('[NotesStore] fetchNotes called without authenticated user')
          return
        }

        try {
          set({ isLoading: true });
          
          // Fetch all notes in one query (up to 500)
          let query = supabase.from(TABLES.NOTES).select('*').eq(COLUMNS.USER_ID, userId);
          if (!includeDeleted) {
            query = query.eq(COLUMNS.IS_DELETED, false);
          }
          
          const { data, error, status, statusText } = await query
            .order('updated_at', { ascending: false })
            .limit(500);
          
          if (error) {
            console.error('[NotesStore] Error fetching notes:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              status,
              statusText
            });
            set({ isLoading: false });
            return;
          }

          if (data) {
            const currentNotes = get().notes
            const merged = mergeNotesList(currentNotes, data.map(sanitizeNote), true, includeDeleted)
            
            set({ notes: merged, isLoading: false });

            // Initialize Yjs docs for notes that have body content
            for (const note of merged) {
              if (note.body) {
                initYDocFromPlainText(note.id, note.body)
              }
            }
          } else {
            set({ isLoading: false });
          }
        } catch (err) {
          console.error('[NotesStore] Unexpected error in fetchNotes:', err);
          set({ isLoading: false });
        }
      },

      pinNote: async (id, isPinned) => {
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        
        const existingNote = get().notes.find(n => n.id === id)
        const newFieldVersions: Record<string, string> = { ...(existingNote?.field_versions || {}) }
        newFieldVersions['pinned'] = timestamp
        newFieldVersions['updated_at'] = timestamp
        
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, pinned: isPinned, updated_at: now, hlc_timestamp: timestamp, field_versions: newFieldVersions } : n))
        }))
        
        if (!supabase) return

        const payload = { 
          [COLUMNS.PINNED]: isPinned,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          [COLUMNS.UPDATED_AT]: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.NOTES).update(payload).eq(COLUMNS.ID, id)
          if (error) {
            console.error('Error pinning note:', error)
            await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'note', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      clearStore: () => {
        set({ 
          notes: [], 
          selectedNoteId: null, 
          activeEditNoteId: null,
          activeEditAt: 0,
          focusedNoteId: null 
        })
      }
    }),
    { name: 'synq-notes' }
  )
)

/**
 * Merge a list of fetched notes with the current local list.
 * Used during fetchNotes to avoid clobbering local optimistic state.
 * 
 * @param local Current local notes
 * @param remote Notes fetched from server
 * @param isComprehensive If true, we assume the remote list represents the full state (for the given filter)
 * @param includesDeleted If true, the remote list includes soft-deleted items
 */
function mergeNotesList(local: Note[], remote: Note[], isComprehensive = false, includesDeleted = false): Note[] {
  const remoteMap = new Map(remote.map(n => [n.id, n]))
  const merged = new Map<string, Note>()

  // 1. Process existing local notes
  for (const localNote of local) {
    const remoteNote = remoteMap.get(localNote.id)

    if (remoteNote) {
      // Item exists in both: Merge using HLC
      const remoteHlc = remoteNote.hlc_timestamp || ''
      const localHlc = localNote.hlc_timestamp || ''
      
      if (HLC.compare(remoteHlc, localHlc) >= 0) {
        merged.set(localNote.id, remoteNote)
      } else {
        merged.set(localNote.id, localNote)
      }
    } else {
      // Item is in local but NOT in remote
      if (isComprehensive) {
        // If it's a new local item (unsynced), we MUST keep it
        const isNewLocal = localNote.id.startsWith('local-') || !localNote.user_id
        
        if (isNewLocal) {
          merged.set(localNote.id, localNote)
        } else {
          // It was a server item, but now it's missing from a comprehensive fetch.
          if (includesDeleted) {
            // We fetched EVERYTHING (including trash) and it's missing -> Hard Delete on server.
            continue 
          } else {
            // We only fetched active items. 
            if (localNote.is_deleted) {
              merged.set(localNote.id, localNote)
            } else {
              // It was active locally, but missing from active remote -> Gone or Soft-Deleted.
              continue
            }
          }
        }
      } else {
        // Not a comprehensive fetch, keep what we have
        merged.set(localNote.id, localNote)
      }
    }
  }

  // 2. Add brand new remote notes
  for (const remoteNote of remote) {
    if (!merged.has(remoteNote.id)) {
      merged.set(remoteNote.id, remoteNote)
    }
  }

  return Array.from(merged.values())
}
