import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CalendarEvent } from '@/types'
import { hlc, HLC } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'
import { mergeFields, stampFields } from '@/lib/crdt/field-crdt'
import { enqueueOperation } from '@/lib/crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '@/lib/crdt/sync-manager'

const SKIP_FIELDS = ['id', 'user_id', 'created_at', 'field_versions', 'hlc_timestamp', 'deleted_hlc']

interface EventState {
  events: CalendarEvent[]
  isLoading: boolean
  error: string | null
  setEvents: (events: CalendarEvent[]) => void
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  restoreEvent: (id: string) => Promise<void>
  permanentlyDeleteEvent: (id: string) => Promise<void>
  fetchEvents: (includeDeleted?: boolean) => Promise<void>
  mergeEventLocal: (remote: CalendarEvent) => void
  clearStore: () => void
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],
      isLoading: false,
      error: null,
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
        const eventPayload = { 
          ...e, 
          user_id: userId,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        // Optimistic insert
        const tempId = crypto.randomUUID()
        const optimisticEvent: CalendarEvent = {
          ...eventPayload,
          id: tempId,
          created_at: now,
        }
        set(state => ({ events: [...state.events, optimisticEvent] }))

        if (getOnlineStatus()) {
          const { data, error } = await supabase
            .from('events')
            .insert([eventPayload])
            .select()
          if (error) {
            console.error('Error adding event:', error)
            await enqueueOperation({
              entityType: 'event',
              entityId: tempId,
              operationType: 'insert',
              payload: eventPayload,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          } else if (data) {
            set(state => ({ 
              events: state.events.map(ev => ev.id === tempId ? data[0] : ev)
            }))
          }
        } else {
          await enqueueOperation({
            entityType: 'event',
            entityId: tempId,
            operationType: 'insert',
            payload: eventPayload,
            hlcTimestamp: timestamp,
          })
        }
      },

      updateEvent: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const currentEvent = get().events.find(ev => ev.id === id)
        
        // Build field versions for updated fields
        const updatedKeys = Object.keys(updates).filter(k => !SKIP_FIELDS.includes(k))
        const existingVersions = currentEvent?.field_versions || {}
        const newVersions = stampFields(existingVersions, updatedKeys, timestamp)

        const payload = {
          ...updates,
          hlc_timestamp: timestamp,
          field_versions: newVersions,
          updated_at: now,
        }

        // Optimistic update
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, ...payload } : ev)
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from('events').update(payload).eq('id', id)
          if (error) {
            console.error('Error updating event:', error)
            await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      deleteEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: now, is_deleted: true } : ev)
        }))

        const payload = { 
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from('events').update(payload).eq('id', id)
          if (error) {
            console.error('Error moving event to trash:', error)
            await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      restoreEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        
        set(state => ({
          events: state.events.map(ev => ev.id === id ? { ...ev, deleted_at: undefined, is_deleted: false } : ev)
        }))

        const payload = { 
          deleted_at: null,
          is_deleted: false,
          deleted_hlc: null,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from('events').update(payload).eq('id', id)
          if (error) {
            console.error('Error restoring event:', error)
            await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      permanentlyDeleteEvent: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          events: state.events.filter(ev => ev.id !== id)
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from('events').delete().eq('id', id)
          if (error) {
            console.error('Error permanently deleting event:', error)
            await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'hard_delete', payload: {}, hlcTimestamp: hlc.increment() })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'event', entityId: id, operationType: 'hard_delete', payload: {}, hlcTimestamp: hlc.increment() })
        }
      },

      fetchEvents: async (includeDeleted = false) => {
        if (!supabase) return
        set({ isLoading: true, error: null })
        
        let userId = useUserStore.getState().user?.id
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) {
          console.warn('[EventStore] fetchEvents called without authenticated user')
          set({ isLoading: false, error: 'No authenticated user' })
          return
        }

        try {
          // RLS automatically filters by user_id (auth.uid() = user_id)
          let query = supabase
            .from('events')
            .select('*')
            .eq('user_id', userId)
          
          if (!includeDeleted) {
            query = query.eq('is_deleted', false)
          }
          
          const { data, error, status, statusText } = await query
            .order('start_date', { ascending: true })
          
          if (error) {
            console.error('[EventStore] Error fetching events:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              status,
              statusText
            })
            set({ isLoading: false, error: error.message })
          } else {
            const currentEvents = get().events
            const merged = mergeEventsList(currentEvents, data || [], true, includeDeleted)
            set({ events: merged, isLoading: false })
          }
        } catch (err) {
          console.error('[EventStore] Unexpected error in fetchEvents:', err)
          set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
        }
      },

      /**
       * CRDT merge: merge a remote event into local state using per-field LWW.
       * Called by DatabaseProvider when a Realtime change arrives.
       */
      mergeEventLocal: (remote: CalendarEvent) => {
        // Advance our clock
        if (remote.hlc_timestamp) {
          hlc.receive(remote.hlc_timestamp)
        }

        set(state => {
          const localIdx = state.events.findIndex(ev => ev.id === remote.id)

          if (localIdx === -1) {
            // New event from remote
            if (remote.is_deleted) return state
            return { events: [...state.events, remote] }
          }

          const local = state.events[localIdx]
          const remoteClientId = remote.hlc_timestamp ? HLC.extractNodeId(remote.hlc_timestamp) : 'unknown'
          const localClientId = hlc.getNodeId()

          // Handle deletion
          if (remote.is_deleted) {
            return { events: state.events.map(ev => ev.id === remote.id ? { ...ev, ...remote } : ev) }
          }

          // Per-field CRDT merge
          const { merged, mergedVersions } = mergeFields(
            local,
            remote,
            local.field_versions || {},
            remote.field_versions || {},
            localClientId,
            remoteClientId,
            SKIP_FIELDS
          )

          merged.field_versions = mergedVersions

          const newEvents = [...state.events]
          newEvents[localIdx] = merged
          return { events: newEvents }
        })
      },

      clearStore: () => set({ events: [] })
    }),
    { name: 'synq-events' }
  )
)

/**
 * Merge a list of fetched events with the current local list.
 * Used during fetchEvents to avoid clobbering local optimistic state.
 * 
 * @param local Current local events
 * @param remote Events fetched from server
 * @param isComprehensive If true, we assume the remote list represents the full state (for the given filter)
 * @param includesDeleted If true, the remote list includes soft-deleted items
 */
function mergeEventsList(local: CalendarEvent[], remote: CalendarEvent[], isComprehensive = false, includesDeleted = false): CalendarEvent[] {
  const remoteMap = new Map(remote.map(e => [e.id, e]))
  const merged = new Map<string, CalendarEvent>()

  // 1. Process existing local events
  for (const localEvent of local) {
    const remoteEvent = remoteMap.get(localEvent.id)

    if (remoteEvent) {
      // Item exists in both: Merge using HLC
      const remoteHlc = remoteEvent.hlc_timestamp || ''
      const localHlc = localEvent.hlc_timestamp || ''
      
      if (HLC.compare(remoteHlc, localHlc) >= 0) {
        merged.set(localEvent.id, remoteEvent)
      } else {
        merged.set(localEvent.id, localEvent)
      }
    } else {
      // Item is in local but NOT in remote
      if (isComprehensive) {
        // If it's a new local item (unsynced), we MUST keep it
        const isNewLocal = localEvent.id.startsWith('local-') || !localEvent.user_id
        
        if (isNewLocal) {
          merged.set(localEvent.id, localEvent)
        } else {
          // It was a server item, but now it's missing from a comprehensive fetch.
          if (includesDeleted) {
            // We fetched EVERYTHING (including trash) and it's missing -> Hard Delete on server.
            continue 
          } else {
            // We only fetched active items. 
            if (localEvent.is_deleted) {
              merged.set(localEvent.id, localEvent)
            } else {
              // It was active locally, but missing from active remote -> Gone or Soft-Deleted.
              continue
            }
          }
        }
      } else {
        // Not a comprehensive fetch, keep what we have
        merged.set(localEvent.id, localEvent)
      }
    }
  }

  // 2. Add brand new remote events
  for (const remoteEvent of remote) {
    if (!merged.has(remoteEvent.id)) {
      merged.set(remoteEvent.id, remoteEvent)
    }
  }

  return Array.from(merged.values())
}
