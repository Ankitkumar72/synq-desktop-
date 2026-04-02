import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CalendarEvent } from '@/types'
import { supabase } from '@/lib/supabase.client'

interface EventState {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  restoreEvent: (id: string) => Promise<void>
  permanentlyDeleteEvent: (id: string) => Promise<void>
}

export const useEventStore = create<EventState>()(
  persist(
    (set) => ({
      events: [],
      setEvents: (events) => set({ events }),
      addEvent: async (e) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('events').insert([e])
        if (error) console.error('Error adding event:', error)
      },
      updateEvent: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('events').update(updates).eq('id', id)
        if (error) console.error('Error updating event:', error)
      },
      deleteEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const deleted_at = new Date().toISOString()
        
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at } : ev)
        }))

        const { error } = await supabase.from('events').update({ deleted_at }).eq('id', id)
        if (error) {
          console.error('Error moving event to trash:', error)
          set(state => ({
            events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: undefined } : ev)
          }))
        }
      },
      restoreEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: undefined } : ev)
        }))

        const { error } = await supabase.from('events').update({ deleted_at: null }).eq('id', id)
        if (error) {
          console.error('Error restoring event:', error)
          set(state => ({
            events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: new Date().toISOString() } : ev)
          }))
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
    }),
    { name: 'synq-events' }
  )
)
