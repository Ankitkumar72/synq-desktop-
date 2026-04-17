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

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { setTasks } = useTaskStore()
  const { setProjects } = useProjectStore()
  const { setNotes } = useNotesStore()
  const { setEvents } = useEventStore()

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
      tasks.forEach(t => t.hlc_timestamp && hlc.receive(t.hlc_timestamp))
    }
    if (projects) setProjects(projects)
    if (notes) {
      setNotes(notes.map(sanitizeNote))
      // Sync HLC with existing data
      notes.forEach(n => n.hlc_timestamp && hlc.receive(n.hlc_timestamp))
    }
    if (events) {
      setEvents(events)
      events.forEach(e => e.hlc_timestamp && hlc.receive(e.hlc_timestamp))
    }
  }, [setTasks, setProjects, setNotes, setEvents])

  useEffect(() => {
    // Initial fetch only if session exists
    const checkUserAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        useUserStore.getState().setUser(session.user)

        // Fetch profile (plan_tier, isPro)
        await useProfileStore.getState().fetchProfile()

        // Register this browser as an active device
        const result = await registerDevice()
        if (!result.allowed) {
          setDeviceLimitExceeded(true)
          setDeviceInfo(result)
          useUserStore.getState().setInitialized(true)
          return // Don't fetch data if device is blocked
        }

        await fetchData()
      } else {
        useUserStore.getState().setUser(null)
      }
      useUserStore.getState().setInitialized(true)
    }

    checkUserAndFetch()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        useUserStore.getState().setUser(session.user)

        // Fetch profile on auth change
        await useProfileStore.getState().fetchProfile()

        // Re-register device on auth change (e.g. token refresh)
        const result = await registerDevice()
        if (!result.allowed) {
          setDeviceLimitExceeded(true)
          setDeviceInfo(result)
          return
        }

        setDeviceLimitExceeded(false)
        setDeviceInfo(null)
        fetchData()
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
    })

    // Real-time handling functions
    const handleRemoteNotes = (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useNotesStore.getState()
      hlc.receive(newRecord.hlc_timestamp || '')
      
      if (eventType === 'INSERT') {
        const existing = store.notes.find(n => n.id === newRecord.id)
        if (!existing) store.setNotes([sanitizeNote(newRecord), ...store.notes])
      } else if (eventType === 'UPDATE') {
        const existing = store.notes.find(n => n.id === newRecord.id)
        if (!existing || HLC.compare(newRecord.hlc_timestamp, existing.hlc_timestamp) > 0) {
          store.updateNoteLocal(newRecord.id, sanitizeNote(newRecord))
        }
      } else if (eventType === 'DELETE') {
        store.setNotes(store.notes.filter(n => n.id !== oldRecord.id))
      }
    }

    const handleRemoteTasks = (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useTaskStore.getState()
      if (newRecord?.hlc_timestamp) hlc.receive(newRecord.hlc_timestamp)

      if (eventType === 'INSERT') {
        const existing = store.tasks.find(t => t.id === newRecord.id)
        if (!existing) store.setTasks([newRecord, ...store.tasks])
      } else if (eventType === 'UPDATE') {
        const existing = store.tasks.find(t => t.id === newRecord.id)
        if (!existing || HLC.compare(newRecord.hlc_timestamp, existing.hlc_timestamp || '') > 0) {
          store.setTasks(store.tasks.map(t => t.id === newRecord.id ? newRecord : t))
        }
      } else if (eventType === 'DELETE') {
        store.setTasks(store.tasks.filter(t => t.id !== oldRecord.id))
      }
    }

    const handleRemoteProjects = (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useProjectStore.getState()
      
      if (eventType === 'INSERT') {
        const existing = store.projects.find(p => p.id === newRecord.id)
        if (!existing) store.setProjects([newRecord, ...store.projects])
      } else if (eventType === 'UPDATE') {
        // Simple overwrite for projects
        store.setProjects(store.projects.map(p => p.id === newRecord.id ? newRecord : p))
      } else if (eventType === 'DELETE') {
        store.setProjects(store.projects.filter(p => p.id !== oldRecord.id))
      }
    }

    const handleRemoteEvents = (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      const store = useEventStore.getState()
      
      if (eventType === 'INSERT') {
        const existing = store.events.find(e => e.id === newRecord.id)
        if (!existing) store.setEvents([...store.events, newRecord])
      } else if (eventType === 'UPDATE') {
        store.setEvents(store.events.map(e => e.id === newRecord.id ? newRecord : e))
      } else if (eventType === 'DELETE') {
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
