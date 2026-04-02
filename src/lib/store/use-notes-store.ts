import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Note } from '@/types'
import { supabase } from '@/lib/supabase.client'

interface NotesState {
  notes: Note[]
  selectedNoteId: string | null
  setNotes: (notes: Note[]) => void
  addNote: (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => Promise<string | undefined>
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>
  updateNoteLocal: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => Promise<void>
  restoreNote: (id: string) => Promise<void>
  permanentlyDeleteNote: (id: string) => Promise<void>
  setSelectedNoteId: (id: string | null) => void
  pinNote: (id: string, isPinned: boolean) => Promise<void>
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      selectedNoteId: null,
      setNotes: (notes) => set((state) => ({ 
        notes, 
        selectedNoteId: state.selectedNoteId || (notes.length > 0 ? notes[0].id : null)
      })),
      addNote: async (note) => {
        if (!supabase) return undefined
        const { data, error } = await supabase.from('notes').insert([note]).select()
        if (error) {
          console.error('Error adding note:', error)
          return undefined
        }
        const newNote = data[0]
        set((state) => ({ notes: [newNote, ...state.notes] }))
        return newNote.id
      },
      updateNote: async (id, updates) => {
        if (!supabase) return
        const { error } = await supabase.from('notes').update(updates).eq('id', id)
        if (error) console.error('Error updating note:', error)
      },
      updateNoteLocal: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n))
        }))
      },
      deleteNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const deleted_at = new Date().toISOString()
        
        // Optimistic update
        set(state => ({
          notes: state.notes.map(n => n.id === id ? { ...n, deleted_at } : n)
        }))

        const { error } = await supabase.from('notes').update({ deleted_at }).eq('id', id)
        if (error) {
          console.error('Error moving note to trash:', error)
          // Revert on error
          set(state => ({
            notes: state.notes.map(n => n.id === id ? { ...n, deleted_at: undefined } : n)
          }))
        }
      },
      restoreNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        // Optimistic update
        set(state => ({
          notes: state.notes.map(n => n.id === id ? { ...n, deleted_at: undefined } : n)
        }))

        const { error } = await supabase.from('notes').update({ deleted_at: null }).eq('id', id)
        if (error) {
          console.error('Error restoring note:', error)
          // Revert on error
          set(state => ({
            notes: state.notes.map(n => n.id === id ? { ...n, deleted_at: new Date().toISOString() } : n)
          }))
        }
      },
      permanentlyDeleteNote: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          notes: state.notes.filter(n => n.id !== id),
          selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
        }))

        const { error } = await supabase.from('notes').delete().eq('id', id)
        if (error) console.error('Error permanently deleting note:', error)
      },
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      pinNote: async (id, isPinned) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, pinned: isPinned } : n))
        }))
        if (!supabase) return
        const { error } = await supabase.from('notes').update({ pinned: isPinned }).eq('id', id)
        if (error) console.error('Error pinning note:', error)
      },
    }),
    { name: 'synq-notes' }
  )
)
