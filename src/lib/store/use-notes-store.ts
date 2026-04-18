import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TABLES, COLUMNS } from '@/lib/constants'
import { hlc, HLC } from '@/lib/hlc'
import { Note, SubTask } from '@/types'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'

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
    is_task: note.is_task ?? false,
    is_completed: note.is_completed ?? false,
    is_all_day: note.is_all_day ?? false,
    is_recurring_instance: note.is_recurring_instance ?? false,
    subtasks: Array.isArray(note.subtasks) ? note.subtasks : [],
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
  addSubtask: (noteId: string, title: string) => Promise<void>
  updateSubtask: (noteId: string, subtaskId: string, updates: Partial<SubTask>) => Promise<void>
  deleteSubtask: (noteId: string, subtaskId: string) => Promise<void>
  focusedNoteId: string | null
  setFocusedNoteId: (id: string | null) => void
}

// User state is now managed centrally in useUserStore

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      selectedNoteId: null,
      focusedNoteId: null,
      setFocusedNoteId: (id) => set({ focusedNoteId: id }),
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
          const defaultFields = ['title', 'content', 'body', 'excerpt', 'is_task', 'is_completed', 'pinned', 'category', 'priority', 'updated_at', 'created_at']
          
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
            is_task: note.is_task ?? false,
            is_completed: note.is_completed ?? false,
            category: note.category || 'personal',
            priority: note.priority || 'none'
          })

          // OPTIMISTIC UPDATE: Add to local state immediately
          set((state) => ({ 
            notes: [fullNote, ...state.notes],
            selectedNoteId: fullNote.id // Auto-select new note
          }))

          console.log('[NotesStore] Inserting note into database:', noteId);
          const { data, error } = await supabase
            .from(TABLES.NOTES)
            .insert([fullNote])
            .select()

          if (error) {
            console.error('[NotesStore] Database error, rolling back:', error.message);
            // ROLLBACK: Remove the note if insertion failed
            set((state) => ({
              notes: state.notes.filter(n => n.id !== noteId),
              selectedNoteId: state.selectedNoteId === noteId ? (state.notes.length > 1 ? state.notes[1].id : null) : state.selectedNoteId
            }))
            return undefined
          }

          if (data?.[0]) {
            // Update with the official record from database (e.g. server-side timestamps)
            set((state) => ({ 
              notes: state.notes.map(n => n.id === noteId ? data[0] : n)
            }))
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

        // Optimistic local update
        get().updateNoteLocal(id, syncUpdates)

        const { error } = await supabase.from(TABLES.NOTES).update(syncUpdates).eq(COLUMNS.ID, id)
        if (error) {
          console.error('Error updating note:', error)
          // Re-fetch on error to ensure consistency
          get().fetchNotes()
        }
      },
      updateNoteLocal: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n))
        }))
      },
      mergeNoteLocal: (remoteNote) => {
        // Sync our local clock with the incoming note to prevent drift
        hlc.receive(remoteNote.hlc_timestamp)

        set((state) => {
          const existingIndex = state.notes.findIndex(n => n.id === remoteNote.id)
          
          if (existingIndex === -1) {
            // New note arrived from remote
            return { notes: [sanitizeNote(remoteNote), ...state.notes] }
          }

          const existing = state.notes[existingIndex]
          
          // If the whole record is newer, or we don't have field versions, just merge it
          if (HLC.compare(remoteNote.hlc_timestamp, existing.hlc_timestamp) > 0) {
            // Combine fields selectively
            const mergedNode = { ...existing }
            const remoteFields = remoteNote.field_versions || {}
            const localFields = existing.field_versions || {}

            Object.entries(remoteNote).forEach(([key, value]) => {
              const remoteV = remoteFields[key]
              const localV = localFields[key]

              // If remote field is newer or missing locally
              if (remoteV && (!localV || HLC.compare(remoteV, localV) > 0)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (mergedNode as any)[key] = value
                if (!mergedNode.field_versions) mergedNode.field_versions = {}
                mergedNode.field_versions[key] = remoteV
              }
            })
            
            // Special handling for content/body syncing
            // FOCUS GUARD: If this note is currently being focused (edited),
            // skip updating the content to prevent cursor jumps.
            const isFocused = get().focusedNoteId === remoteNote.id;

            if (!isFocused && remoteFields['content'] && (!localFields['content'] || HLC.compare(remoteFields['content'], localFields['content']) > 0)) {
              mergedNode.body = remoteNote.body
              mergedNode.content = remoteNote.content
            }

            mergedNode.hlc_timestamp = remoteNote.hlc_timestamp
            
            const newNotes = [...state.notes]
            newNotes[existingIndex] = mergedNode
            return { notes: newNotes }
          }

          return state // No update needed
        })
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

        const { error } = await supabase.from(TABLES.NOTES).update({ 
          [COLUMNS.DELETED_AT]: now,
          [COLUMNS.IS_DELETED]: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          [COLUMNS.UPDATED_AT]: now
        }).eq(COLUMNS.ID, id)
        if (error) {
          console.error('Error moving note to trash:', error)
          get().fetchNotes()
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

        const { error } = await supabase.from(TABLES.NOTES).update({ 
          [COLUMNS.DELETED_AT]: null,
          [COLUMNS.IS_DELETED]: false,
          deleted_hlc: null,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          [COLUMNS.UPDATED_AT]: new Date().toISOString()
        }).eq(COLUMNS.ID, id)
        if (error) {
          console.error('Error restoring note:', error)
          get().fetchNotes()
        }
      },
      permanentlyDeleteNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          notes: state.notes.filter(n => n.id !== id),
          selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
        }))

        const { error } = await supabase.from(TABLES.NOTES).delete().eq(COLUMNS.ID, id)
        if (error) console.error('Error permanently deleting note:', error)
      },
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      fetchNotes: async (includeDeleted = false) => {
        if (!supabase) return
        
        // 1. First fetch: Rapidly load the most recent 50 notes
        const INITIAL_BATCH_SIZE = 50;
        let query = supabase.from(TABLES.NOTES).select('*');
        if (!includeDeleted) {
          query = query.eq(COLUMNS.IS_DELETED, false);
        }
        
        const { data: initialData, error: initialError } = await query
          .order('updated_at', { ascending: false })
          .limit(INITIAL_BATCH_SIZE);
        
        if (initialError) {
          console.error('Error fetching initial notes:', initialError);
          return;
        }

        if (initialData) {
          // Immediately update state with the first batch
          set({ notes: initialData.map(sanitizeNote) });

          // 2. Background catch-up: If we potentially have more notes, fetch the rest
          if (initialData.length === INITIAL_BATCH_SIZE) {
            // We fetch the next batch. In a production app with thousands of notes, 
            // you'd use a loop or cursor, but for most note users, fetching the 
            // next few hundred is sufficient for a single background pass.
            const { data: remainingData, error: remainingError } = await query
              .order('updated_at', { ascending: false })
              .range(INITIAL_BATCH_SIZE, INITIAL_BATCH_SIZE + 450); // Fetch up to 500 total notes for now
            
            if (remainingError) {
              console.error('Error in background note catch-up:', remainingError);
            } else if (remainingData && remainingData.length > 0) {
              set(state => ({
                notes: [...state.notes, ...remainingData.map(sanitizeNote)]
              }));
            }
          }
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
        const { error } = await supabase.from(TABLES.NOTES).update({ 
          [COLUMNS.PINNED]: isPinned,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          [COLUMNS.UPDATED_AT]: now
        }).eq(COLUMNS.ID, id)
        if (error) {
          console.error('Error pinning note:', error)
          get().fetchNotes()
        }
      },
      addSubtask: async (noteId, title) => {
        const note = get().notes.find(n => n.id === noteId)
        if (!note) return

        const newSubtask: SubTask = {
          id: crypto.randomUUID(),
          title,
          is_completed: false
        }

        const updatedSubtasks = [...note.subtasks, newSubtask]
        await get().updateNote(noteId, { subtasks: updatedSubtasks })
      },
      updateSubtask: async (noteId, subtaskId, updates) => {
        const note = get().notes.find(n => n.id === noteId)
        if (!note) return

        const updatedSubtasks = note.subtasks.map(st => 
          st.id === subtaskId ? { ...st, ...updates } : st
        )
        await get().updateNote(noteId, { subtasks: updatedSubtasks })
      },
      deleteSubtask: async (noteId, subtaskId) => {
        const note = get().notes.find(n => n.id === noteId)
        if (!note) return

        const updatedSubtasks = note.subtasks.filter(st => st.id !== subtaskId)
        await get().updateNote(noteId, { subtasks: updatedSubtasks })
      },
    }),
    { name: 'synq-notes' }
  )
)
