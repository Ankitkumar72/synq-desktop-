import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CalendarEvent } from '@/types'
import { hlc } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'

interface EventState {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  restoreEvent: (id: string) => Promise<void>
  permanentlyDeleteEvent: (id: string) => Promise<void>
  fetchEvents: (includeDeleted?: boolean) => Promise<void>
}

// User state is managed in useUserStore

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],
      setEvents: (events) => set({ events }),
      addEvent: async (e) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        let userId = useUserStore.getState().user?.id
        
        // Robust fallback: fetch user directly if store is empty
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) {
          return console.warn('No authenticated user')
        }

        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('events')
          .insert([{ 
            ...e, 
            user_id: userId,
            hlc_timestamp: timestamp,
            updated_at: now
          }])
          .select()
        if (error) {
          console.error('Error adding event:', error)
        } else if (data) {
          set(state => ({ events: [...state.events, data[0]] }))
        }
      },
      updateEvent: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        
        // Optimistic update
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, ...updates, hlc_timestamp: timestamp, updated_at: now } : ev)
        }))

        const { error } = await supabase.from('events').update({
          ...updates,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('id', id)
        if (error) {
          console.error('Error updating event:', error)
          get().fetchEvents()
        }
      },
      deleteEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: now, is_deleted: true } : ev)
        }))

        const { error } = await supabase.from('events').update({ 
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('id', id)
        if (error) {
          console.error('Error moving event to trash:', error)
          get().fetchEvents()
        }
      },
      restoreEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: undefined, is_deleted: false } : ev)
        }))

        const { error } = await supabase.from('events').update({ 
          deleted_at: null,
          is_deleted: false,
          deleted_hlc: null,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('id', id)
        if (error) {
          console.error('Error restoring event:', error)
          get().fetchEvents()
        }
      },
      permanentlyDeleteEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          events: state.events.filter(ev => ev.id !== id)
        }))

        const { error } = await supabase.from('events').delete().eq('id', id)
        if (error) console.error('Error permanently deleting event:', error)
      },
      fetchEvents: async (includeDeleted = false) => {
        if (!supabase) return
        
        // RLS automatically filters by user_id (auth.uid() = user_id)
        let query = supabase
          .from('events')
          .select('*')
        
        if (!includeDeleted) {
          query = query.eq('is_deleted', false)
        }
        
        const { data, error } = await query
          .order('start_date', { ascending: true })
        
        if (error) {
          console.error('Error fetching events:', error)
        } else {
          set({ events: data || [] })
        }
      },
    }),
    { name: 'synq-events' }
  )
)
