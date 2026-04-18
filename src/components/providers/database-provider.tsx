"use client"

import { useEffect, useCallback, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase.client'
import { useTaskStore } from '@/lib/store/use-task-store'
import { useProjectStore } from '@/lib/store/use-project-store'
import { useNotesStore } from '@/lib/store/use-notes-store'
import { useUserStore } from '@/lib/store/use-user-store'
import { useEventStore } from '@/lib/store/use-event-store'
import { useProfileStore } from '@/lib/store/use-profile-store'
import { registerDevice, type DeviceRegistrationResult } from '@/lib/device-manager'
import { DeviceLimitPage } from '@/components/device-limit-page'
import { hlc, HLC } from '@/lib/hlc'
import { Task, Project, Note, CalendarEvent } from '@/types'
import { AuthChangeEvent, Session, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)
  
  // Prevent double-initialization
  const initStarted = useRef(false)

  const fetchData = useCallback(async () => {
    // Rely on individual stores' optimized fetchers (handling chunking natively)
    // We run these in parallel, but they internally limit the payloads
    const promises = [
      useTaskStore.getState().fetchTasks(),
      useNotesStore.getState().fetchNotes(),
      useEventStore.getState().fetchEvents()
    ]
    
    // Project store doesn't have a fetchProjects method yet, so we'll fetch it safely here
    const fetchProj = async () => {
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (data) useProjectStore.getState().setProjects(data)
    }
    promises.push(fetchProj())

    await Promise.allSettled(promises)
  }, [])

  useEffect(() => {
    // Extract the init routine so both methods (manual & event) can run it safely
    const executeInit = async (session: Session | null) => {
      if (initStarted.current) return
      initStarted.current = true

      try {
        if (session) {
          useUserStore.getState().setUser(session.user)

          await useProfileStore.getState().fetchProfile().catch(err => {
            console.error('[DatabaseProvider] Profile fetch failed:', err)
          })

          const result = await registerDevice().catch(err => {
            console.error('[DatabaseProvider] Device registration failed:', err)
            return { allowed: true }
          })

          if (result && !result.allowed) {
            setDeviceLimitExceeded(true)
            setDeviceInfo(result as DeviceRegistrationResult)
            return
          }

          setDeviceLimitExceeded(false)
          setDeviceInfo(null)
          
          await fetchData().catch(err => {
            console.error('[DatabaseProvider] Data fetch failed:', err)
          })
        } else {
          // Clear data if logged out
          useUserStore.getState().setUser(null)
          useTaskStore.getState().setTasks([])
          useProjectStore.getState().setProjects([])
          useNotesStore.getState().setNotes([])
          useEventStore.getState().setEvents([])
          setDeviceLimitExceeded(false)
          setDeviceInfo(null)
        }
      } catch (err) {
        console.error('[DatabaseProvider] Error handling auth change:', err)
      } finally {
        // Always ensure isInitialized is true after any session init attempt
        useUserStore.getState().setInitialized(true)
      }
    }

    // Manual initial check (critical for standalone Electron/desktop runtimes)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('[DatabaseProvider] getSession error:', error)
      executeInit(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      console.log(`[DatabaseProvider] Auth change detected: ${_event}`)
      // If SIGNED_IN or SIGNED_OUT happened after we initialized already, we bypass the lock to reload context
      if ((_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') && initStarted.current) {
         initStarted.current = false // lift exact lock so it can re-init
         executeInit(session)
      } else if (!initStarted.current) {
         // Fallback just in case getSession hasn't run yet
         executeInit(session)
      }
    })

    // Real-time handling functions
    const handleRemoteNotes = (payload: RealtimePostgresChangesPayload<Note>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useNotesStore.getState()
      if (newRecord && 'hlc_timestamp' in newRecord) hlc.receive(newRecord.hlc_timestamp || '')
      
      if (eventType === 'INSERT' && 'id' in newRecord) {
        store.mergeNoteLocal(newRecord as Note)
      } else if (eventType === 'UPDATE' && 'id' in newRecord) {
        store.mergeNoteLocal(newRecord as Note)
      } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
        store.setNotes(store.notes.filter(n => n.id !== oldRecord.id))
      }
    }

    const handleRemoteTasks = (payload: RealtimePostgresChangesPayload<Task>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useTaskStore.getState()
      if (newRecord && 'hlc_timestamp' in newRecord && newRecord.hlc_timestamp) hlc.receive(newRecord.hlc_timestamp)

      if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
        const existing = store.tasks.find(t => t.id === newRecord.id)
        if (!existing) store.setTasks([newRecord as Task, ...store.tasks])
      } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
        const existing = store.tasks.find(t => t.id === newRecord.id)
        if (!existing || HLC.compare(newRecord.hlc_timestamp as string, existing.hlc_timestamp || '') > 0) {
          store.setTasks(store.tasks.map(t => t.id === newRecord.id ? (newRecord as Task) : t))
        }
      } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
        store.setTasks(store.tasks.filter(t => t.id !== oldRecord.id))
      }
    }

    const handleRemoteProjects = (payload: RealtimePostgresChangesPayload<Project>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useProjectStore.getState()
      
      if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
        const existing = store.projects.find(p => p.id === newRecord.id)
        if (!existing) store.setProjects([newRecord as Project, ...store.projects])
      } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
        // Simple overwrite for projects
        store.setProjects(store.projects.map(p => p.id === newRecord.id ? (newRecord as Project) : p))
      } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
        store.setProjects(store.projects.filter(p => p.id !== oldRecord.id))
      }
    }

    const handleRemoteEvents = (payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useEventStore.getState()
      
      if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
        const existing = store.events.find(e => e.id === newRecord.id)
        if (!existing) store.setEvents([...store.events, newRecord as CalendarEvent])
      } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
        store.setEvents(store.events.map(e => e.id === newRecord.id ? (newRecord as CalendarEvent) : e))
      } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
        store.setEvents(store.events.filter(e => e.id !== oldRecord.id))
      }
    }

    // Real-time subscriptions
    const channels = [
      supabase.channel('public:tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleRemoteTasks),
      supabase.channel('public:projects').on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleRemoteProjects),
      supabase.channel('public:notes').on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, handleRemoteNotes),
      supabase.channel('public:events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, handleRemoteEvents),
    ]

    channels.forEach(channel => channel.subscribe())

    return () => {
      subscription.unsubscribe()
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [fetchData])

  // Block the entire app if device limit is exceeded
  if (deviceLimitExceeded && deviceInfo) {
    return (
      <DeviceLimitPage
        activeCount={deviceInfo.active_count}
        maxDevices={deviceInfo.max_devices}
        planTier={deviceInfo.plan_tier}
      />
    )
  }

  return <>{children}</>
}
