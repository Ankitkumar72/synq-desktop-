"use client"

import { useEffect, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase.client'
import { useTaskStore } from '@/lib/store/use-task-store'
import { useProjectStore } from '@/lib/store/use-project-store'
import { useNotesStore, sanitizeNote } from '@/lib/store/use-notes-store'
import { useUserStore } from '@/lib/store/use-user-store'
import { useEventStore } from '@/lib/store/use-event-store'
import { useProfileStore } from '@/lib/store/use-profile-store'
import { registerDevice, type DeviceRegistrationResult } from '@/lib/device-manager'
import { DeviceLimitPage } from '@/components/device-limit-page'
import { hlc, HLC } from '@/lib/hlc'
import { Task, Project, Note, CalendarEvent } from '@/types'
import { AuthChangeEvent, Session, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const setTasks = useTaskStore((s) => s.setTasks)
  const setProjects = useProjectStore((s) => s.setProjects)
  const setNotes = useNotesStore((s) => s.setNotes)
  const setEvents = useEventStore((s) => s.setEvents)

  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)

  const fetchData = useCallback(async () => {
    // RLS automatically scopes all queries to auth.uid() = user_id
    // We also filter out soft-deleted records
    const [
      { data: tasks },
      { data: projects },
      { data: notes },
      { data: events }
    ] = await Promise.all([
      supabase.from('tasks').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('notes').select('*').is('deleted_at', null).order('updated_at', { ascending: false }),
      supabase.from('events').select('*').is('deleted_at', null).order('start_date', { ascending: true }),
    ])

    if (tasks) {
      setTasks(tasks)
      // Sync HLC with existing data
      tasks.forEach((t: Task) => t.hlc_timestamp && hlc.receive(t.hlc_timestamp))
    }
    if (projects) setProjects(projects)
    if (notes) {
      setNotes(notes.map(sanitizeNote))
      // Sync HLC with existing data
      notes.forEach((n: Note) => n.hlc_timestamp && hlc.receive(n.hlc_timestamp))
    }
    if (events) {
      setEvents(events)
      events.forEach((e: CalendarEvent) => e.hlc_timestamp && hlc.receive(e.hlc_timestamp))
    }
  }, [setTasks, setProjects, setNotes, setEvents])

  useEffect(() => {
    // Listen for auth changes. Supabase v2 fires INITIAL_SESSION on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      console.log(`[DatabaseProvider] Auth change detected: ${_event}`)
      try {
        if (session) {
          useUserStore.getState().setUser(session.user)

          // Fetch profile on auth change
          await useProfileStore.getState().fetchProfile().catch(err => {
            console.error('[DatabaseProvider] Profile fetch failed on auth change:', err)
          })

          // Re-register device on auth change (e.g. token refresh)
          const result = await registerDevice().catch(err => {
            console.error('[DatabaseProvider] Device registration failed on auth change:', err)
            return { allowed: true }
          })

          if (result && !result.allowed) {
            setDeviceLimitExceeded(true)
            setDeviceInfo(result as DeviceRegistrationResult)
            return
          }

          setDeviceLimitExceeded(false)
          setDeviceInfo(null)
          fetchData().catch(err => {
            console.error('[DatabaseProvider] Data fetch failed on auth change:', err)
          })
        } else {
          // Clear data on sign out
          useUserStore.getState().setUser(null)
          setTasks([])
          setProjects([])
          setNotes([])
          setEvents([])
          setDeviceLimitExceeded(false)
          setDeviceInfo(null)
        }
      } catch (err) {
        console.error('[DatabaseProvider] Error handling auth change:', err)
      } finally {
        // Always ensure isInitialized is true after any session init attempt
        useUserStore.getState().setInitialized(true)
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
  }, [fetchData, setEvents, setNotes, setProjects, setTasks])

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
