"use client"

import { useEffect, useCallback, useState, useRef } from 'react'
import { supabase } from "@synq/shared"
import { useTaskStore } from "@synq/shared"
import { useProjectStore } from "@synq/shared"
import { useNotesStore } from "@synq/shared"
import { useUserStore } from "@synq/shared"
import { useEventStore } from "@synq/shared"
import { useProfileStore } from "@synq/shared"
import { useFolderStore } from "@synq/shared"
import { registerDevice, type DeviceRegistrationResult } from '@/lib/device-manager'
import { DeviceLimitPage } from '@/components/device-limit-page'
import { hlc } from "@synq/shared"
import { Task, Project, Note, CalendarEvent, Folder } from "@synq/shared"
import { Session, RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'
import { bindNoteBroadcastChannel, getNoteSyncClientId, NOTE_BROADCAST_EVENT, type NoteBroadcastPayload } from "@synq/shared"
import { initSyncManager, destroySyncManager } from "@synq/shared"
import { destroyAllYDocs, applyRemoteUpdate, applyRemoteUpdateIfLoaded, hasYDoc } from "@synq/shared"
import { getLocalLastSeq, getNoteCrdtUpdates, setLocalLastSeq, toUint8Update, type NoteCrdtUpdateRow, processWithTimeBudget } from "@synq/shared"

const MAX_REALTIME_RETRIES = 5
const RETRY_BASE_DELAY_MS = 2000
const INITIAL_SUBSCRIBE_DELAY_MS = 250
const POLL_INTERVAL_REALTIME_DOWN = 10_000
const HEALTH_CHECK_INTERVAL = 60_000
const HEALTH_CHECK_GRACE_MS = 30_000


export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)
  
  const initStarted = useRef(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPollAtRef = useRef(0)
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeConnectedRef = useRef(false)
  const isSubscribingRef = useRef(false)
  const lastSubscribeAttemptRef = useRef<number>(0)
  const subscriptionGenRef = useRef(0)
  const currentUserIdRef = useRef<string | null>(null)
  const oplogBufferRef = useRef<Map<string, NoteCrdtUpdateRow[]>>(new Map())
  const oplogDrainTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_bootstrap_data')
      
      if (error) {
        if (error.code !== 'PGRST202') {
          console.error('[DatabaseProvider] Error fetching bootstrap data:', error)
        }
        const promises = [
          useTaskStore.getState().fetchTasks(),
          useNotesStore.getState().fetchNotes(),
          useEventStore.getState().fetchEvents(),
          useProjectStore.getState().fetchProjects(),
          useFolderStore.getState().fetchFolders()
        ]
        await Promise.allSettled(promises)
        return
      }

      if (data) {
        const promises = [
          useTaskStore.getState().fetchTasks(false, data.tasks),
          useNotesStore.getState().fetchNotes(false, data.notes),
          useEventStore.getState().fetchEvents(false, data.events),
          useProjectStore.getState().fetchProjects(false, data.projects),
          useFolderStore.getState().fetchFolders(false, data.folders)
        ]
        await Promise.allSettled(promises)
      }
    } catch (err) {
      console.error('[DatabaseProvider] Unexpected error in fetchData:', err)
    }
  }, [])

  const handleRemoteNotes = useCallback((payload: RealtimePostgresChangesPayload<Note>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const notesStore = useNotesStore.getState()
    if (newRecord && 'is_task' in newRecord && (newRecord as Note).is_task) return
    if (newRecord && 'hlc_timestamp' in newRecord) hlc.receive(newRecord.hlc_timestamp || '')
    
    const note = newRecord as Note
    
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && note?.id) {
      notesStore.mergeNoteLocal(note)
    } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
      notesStore.setNotes(notesStore.notes.filter(n => n.id !== oldRecord.id))
    }
  }, [])

  const handleRemoteNoteBroadcast = useCallback((payload: NoteBroadcastPayload) => {
    if (payload.sender_id === getNoteSyncClientId()) return

    const notesStore = useNotesStore.getState()
    const existing = notesStore.notes.find(note => note.id === payload.id)
    if (!existing) return

    handleRemoteNotes({
      eventType: 'UPDATE',
      new: {
        ...existing,
        ...payload,
        field_versions: {
          ...(existing.field_versions || {}),
          ...(payload.field_versions || {}),
        },
      },
      old: {} as Note,
      schema: 'public',
      table: 'notes',
      commit_timestamp: new Date().toISOString(),
      errors: [],
    })
  }, [handleRemoteNotes])

  const handleRemoteTasks = useCallback((payload: RealtimePostgresChangesPayload<Task>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const store = useTaskStore.getState()
    if (newRecord && 'hlc_timestamp' in newRecord && newRecord.hlc_timestamp) hlc.receive(newRecord.hlc_timestamp)

    if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
      const existing = store.tasks.find(t => t.id === newRecord.id)
      if (!existing) {
        store.mergeTaskLocal(newRecord as Task)
      }
    } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
      store.mergeTaskLocal(newRecord as Task)
    } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
      store.setTasks(store.tasks.filter(t => t.id !== oldRecord.id))
    }
  }, [])

  const handleRemoteProjects = useCallback((payload: RealtimePostgresChangesPayload<Project>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const store = useProjectStore.getState()

    if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
      const existing = store.projects.find(p => p.id === newRecord.id)
      if (!existing) {
        store.mergeProjectLocal(newRecord as Project)
      }
    } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
      store.mergeProjectLocal(newRecord as Project)
    } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
      store.setProjects(store.projects.filter(p => p.id !== oldRecord.id))
    }
  }, [])

  const handleRemoteEvents = useCallback((payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const store = useEventStore.getState()
    
    if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
      const existing = store.events.find(e => e.id === newRecord.id)
      if (!existing) {
        store.mergeEventLocal(newRecord as CalendarEvent)
      }
    } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
      store.mergeEventLocal(newRecord as CalendarEvent)
    } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
      store.setEvents(store.events.filter(e => e.id !== oldRecord.id))
    }
  }, [])

  const handleRemoteFolders = useCallback((payload: RealtimePostgresChangesPayload<Folder>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const store = useFolderStore.getState()
    
    if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
      const existing = store.folders.find(f => f.id === newRecord.id)
      if (!existing) {
        store.mergeFolderLocal(newRecord as Folder)
      }
    } else if (eventType === 'UPDATE' && newRecord && 'id' in newRecord) {
      store.mergeFolderLocal(newRecord as Folder)
    } else if (eventType === 'DELETE' && oldRecord && 'id' in oldRecord) {
      store.setFolders(store.folders.filter(f => f.id !== oldRecord.id))
    }
  }, [])

  const handleRemoteCRDT = useCallback((payload: RealtimePostgresChangesPayload<{ entity_id?: string; state?: number[] }>) => {
    const { eventType, new: newRecord } = payload
    
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord && newRecord.entity_id) {
      if (newRecord.state && Array.isArray(newRecord.state)) {
        const binaryState = new Uint8Array(newRecord.state)
        applyRemoteUpdate(newRecord.entity_id, binaryState)
      }
    }
  }, [])

  const drainBufferedOplogRows = useCallback(async (noteId: string) => {
    const buffered = oplogBufferRef.current.get(noteId) || []
    oplogBufferRef.current.delete(noteId)
    if (!buffered.length || !hasYDoc(noteId)) return

    const sorted = [...buffered].sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))
    let cursor = getLocalLastSeq(noteId)
    let sawGap = false

    await processWithTimeBudget(sorted, (row) => {
      const seq = Number(row.seq || 0)
      if (seq <= cursor) return
      if (seq > cursor + 1) {
        sawGap = true
        return false
      }
      const update = toUint8Update(row.update_data)
      if (update) {
        applyRemoteUpdateIfLoaded(noteId, update)
      }
      cursor = seq
    })

    if (cursor > 0) {
      setLocalLastSeq(noteId, cursor)
    }

    if (!sawGap) return

    try {
      const catchUp = await getNoteCrdtUpdates(noteId, cursor, 500)
      const catchUpSorted = [...catchUp].sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))
      
      await processWithTimeBudget(catchUpSorted, (row) => {
        const seq = Number(row.seq || 0)
        if (seq <= cursor) return
        const update = toUint8Update(row.update_data)
        if (update) {
          applyRemoteUpdateIfLoaded(noteId, update)
        }
        cursor = seq
      })
      if (cursor > 0) {
        setLocalLastSeq(noteId, cursor)
      }
    } catch (err) {
      console.warn('[Realtime] Failed to catch up missing CRDT ops:', err)
    }
  }, [])

  const scheduleOplogDrain = useCallback((noteId: string) => {
    if (oplogDrainTimersRef.current.has(noteId)) return
    const timer = setTimeout(() => {
      oplogDrainTimersRef.current.delete(noteId)
      void drainBufferedOplogRows(noteId)
    }, 40)
    oplogDrainTimersRef.current.set(noteId, timer)
  }, [drainBufferedOplogRows])

  const handleRemoteCrdtNoteUpdate = useCallback((payload: RealtimePostgresChangesPayload<{
    seq?: number
    entity_id?: string
    entity_type?: string
    op_id?: string
    client_id?: string
    update_data?: number[]
    created_at?: string
  }>) => {
    const { eventType, new: newRecord } = payload
    if (eventType !== 'INSERT' || !newRecord?.entity_id) return
    if (newRecord.entity_type && newRecord.entity_type !== 'note') return

    const noteId = newRecord.entity_id
    if (!hasYDoc(noteId)) return

    const existing = oplogBufferRef.current.get(noteId) || []
    existing.push({
      seq: Number(newRecord.seq || 0),
      entity_id: noteId,
      op_id: String(newRecord.op_id || ''),
      client_id: String(newRecord.client_id || ''),
      update_data: Array.isArray(newRecord.update_data) ? newRecord.update_data : [],
      created_at: String(newRecord.created_at || new Date().toISOString()),
    })
    oplogBufferRef.current.set(noteId, existing)
    scheduleOplogDrain(noteId)
  }, [scheduleOplogDrain])

  const subscribeToRealtime = useCallback(async (attempt = 0) => {
    if (isSubscribingRef.current && attempt === 0) return
    
    const userId = currentUserIdRef.current
    if (!userId) return

    isSubscribingRef.current = true
    lastSubscribeAttemptRef.current = Date.now()
    const currentGen = ++subscriptionGenRef.current

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current)
      } catch (e) {
        console.warn('[Realtime] Error removing channel:', e)
      }
      channelRef.current = null
      bindNoteBroadcastChannel(null)
      realtimeConnectedRef.current = false
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    if (attempt === 0 && INITIAL_SUBSCRIBE_DELAY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, INITIAL_SUBSCRIBE_DELAY_MS))
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      isSubscribingRef.current = false
      return
    }

    await supabase.realtime.setAuth(session.access_token)

    const channel = supabase
      .channel(`synq:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        handleRemoteTasks as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        handleRemoteProjects as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        handleRemoteNotes as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crdt_documents' },
        handleRemoteCRDT as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crdt_note_updates' },
        handleRemoteCrdtNoteUpdate as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        handleRemoteEvents as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders' },
        handleRemoteFolders as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        'broadcast',
        { event: NOTE_BROADCAST_EVENT },
        ({ payload }) => {
          handleRemoteNoteBroadcast(payload as NoteBroadcastPayload)
        }
      )

    channelRef.current = channel

    channel.subscribe((status) => {
      if (subscriptionGenRef.current !== currentGen) return

      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✓ Connected — all tables listening')
        realtimeConnectedRef.current = true
        isSubscribingRef.current = false
        bindNoteBroadcastChannel(channel)
        if (attempt > 0) {
          fetchData().catch(e => console.error('[Realtime] Sync fetch failed:', e))
        }
      } else if (
        status === 'TIMED_OUT' ||
        status === 'CHANNEL_ERROR' ||
        status === 'CLOSED'
      ) {
        realtimeConnectedRef.current = false
        bindNoteBroadcastChannel(null)

        if (attempt < MAX_REALTIME_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
          retryTimeoutRef.current = setTimeout(() => {
            subscribeToRealtime(attempt + 1)
          }, delay)
        } else {
          isSubscribingRef.current = false
        }
      }
    })
  }, [fetchData, handleRemoteTasks, handleRemoteProjects, handleRemoteNotes, handleRemoteCRDT, handleRemoteCrdtNoteUpdate, handleRemoteNoteBroadcast, handleRemoteEvents, handleRemoteFolders])

  const teardownRealtime = useCallback(() => {
    subscriptionGenRef.current++
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current)
      } catch (e) {
        console.warn('[Realtime] Error during teardown:', e)
      }
      channelRef.current = null
    }
    bindNoteBroadcastChannel(null)
    realtimeConnectedRef.current = false
    isSubscribingRef.current = false
    for (const timer of oplogDrainTimersRef.current.values()) {
      clearTimeout(timer)
    }
    oplogDrainTimersRef.current.clear()
    oplogBufferRef.current.clear()
  }, [])

  const startPollFallback = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      
      if (realtimeConnectedRef.current) return
      
      const now = Date.now()
      lastPollAtRef.current = now
      fetchData().catch(err => console.error('[Poll] Error:', err))
    }, POLL_INTERVAL_REALTIME_DOWN)
  }, [fetchData])

  const startHealthCheck = useCallback(() => {
    if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current)
    healthCheckTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (!currentUserIdRef.current || isSubscribingRef.current) return
      const timeSinceLastAttempt = Date.now() - lastSubscribeAttemptRef.current
      if (timeSinceLastAttempt < HEALTH_CHECK_GRACE_MS) return
      if (!realtimeConnectedRef.current) subscribeToRealtime()
    }, HEALTH_CHECK_INTERVAL)
  }, [subscribeToRealtime])

  useEffect(() => {
    let mounted = true

    const executeInit = async (session: Session | null) => {
      const targetUserId = session?.user?.id || null
      if (initStarted.current && currentUserIdRef.current === targetUserId) return
      
      initStarted.current = true

      try {
        if (session) {
          useTaskStore.setState({ isLoading: false, error: null })
          useNotesStore.setState({ isLoading: false, error: null })
          useEventStore.setState({ isLoading: false, error: null })
          useProjectStore.setState({ isLoading: false, error: null })
          useFolderStore.setState({ isLoading: false, error: null })

          currentUserIdRef.current = session.user.id
          useUserStore.getState().setUser(session.user)
          initSyncManager()
          fetchData().catch(err => console.error('[DatabaseProvider] Initial fetch failed:', err))

          const [, deviceResult] = await Promise.allSettled([
            useProfileStore.getState().fetchProfile(),
            registerDevice().catch(() => ({ allowed: true })),
          ])

          const result = deviceResult.status === 'fulfilled' ? deviceResult.value : { allowed: true }
          if (result && !result.allowed) {
            setDeviceLimitExceeded(true)
            setDeviceInfo(result as DeviceRegistrationResult)
            return
          }

          setDeviceLimitExceeded(false)
          setDeviceInfo(null)

          if (mounted) {
            setTimeout(() => {
              if (mounted) {
                subscribeToRealtime()
                startPollFallback()
                startHealthCheck()
              }
            }, 1500)
          }
        } else {
          currentUserIdRef.current = null
          useUserStore.getState().setUser(null)
          useTaskStore.getState().setTasks([])
          useProjectStore.getState().setProjects([])
          useNotesStore.getState().setNotes([])
          useEventStore.getState().setEvents([])
          useFolderStore.getState().setFolders([])
          setDeviceLimitExceeded(false)
          setDeviceInfo(null)
          destroyAllYDocs()
          destroySyncManager()
          teardownRealtime()
        }
      } catch (err) {
        console.error('[DatabaseProvider] Error handling auth change:', err)
      } finally {
        useUserStore.getState().setInitialized(true)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'TOKEN_REFRESHED' && !session) {
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }
      if (_event === 'SIGNED_OUT') {
        initStarted.current = false
        if (mounted) executeInit(null)
      } else if (session && mounted) {
        executeInit(session)
      }
    })

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error && error.message.includes('refresh_token_not_found')) {
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }
      if (session && mounted) executeInit(session)
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          if (document.visibilityState === 'visible' && !realtimeConnectedRef.current && currentUserIdRef.current) {
            console.log('[Realtime] Tab active and disconnected. Lazy reconnecting...')
            subscribeToRealtime()
          }
        }, 500)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      teardownRealtime()
      destroySyncManager()
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current)
    }
  }, [fetchData, subscribeToRealtime, teardownRealtime, startPollFallback, startHealthCheck])

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
