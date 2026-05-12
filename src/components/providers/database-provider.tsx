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
import { hlc } from '@/lib/hlc'
import { Task, Project, Note, CalendarEvent } from '@/types'
import { Session, RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'
import { bindNoteBroadcastChannel, getNoteSyncClientId, NOTE_BROADCAST_EVENT, type NoteBroadcastPayload } from '@/lib/realtime/note-sync'
import { initSyncManager, destroySyncManager } from '@/lib/crdt/sync-manager'
import { destroyAllYDocs, applyRemoteUpdate, applyRemoteUpdateIfLoaded, hasYDoc } from '@/lib/crdt/crdt-doc'
import { getLocalLastSeq, getNoteCrdtUpdates, setLocalLastSeq, toUint8Update, type NoteCrdtUpdateRow } from '@/lib/crdt/oplog'

// Realtime config
const MAX_REALTIME_RETRIES = 5
const RETRY_BASE_DELAY_MS = 2000
const INITIAL_SUBSCRIBE_DELAY_MS = 250
// Poll intervals (ms)
const POLL_INTERVAL_REALTIME_DOWN = 10_000  // 10s when realtime is down
const POLL_INTERVAL_REALTIME_UP = 30_000    // 30s when realtime is healthy
const HEALTH_CHECK_INTERVAL = 60_000        // 60s health check
const HEALTH_CHECK_GRACE_MS = 30_000        // Don't health-check within 30s of a subscribe attempt


export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)
  
  // Prevent double-initialization
  const initStarted = useRef(false)
  // Single realtime channel (all tables multiplexed on one channel)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPollAtRef = useRef(0)
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeConnectedRef = useRef(false)
  const isSubscribingRef = useRef(false)            // Lock: prevents concurrent subscriptions
  const lastSubscribeAttemptRef = useRef<number>(0)  // Timestamp of last subscribe attempt
  const subscriptionGenRef = useRef(0)               // Generation counter — ignores stale callbacks
  const currentUserIdRef = useRef<string | null>(null)
  const oplogBufferRef = useRef<Map<string, NoteCrdtUpdateRow[]>>(new Map())
  const oplogDrainTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // -------------------------------------------------------------------------
  // Fetch data from Supabase
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    const promises = [
      useTaskStore.getState().fetchTasks(),
      useNotesStore.getState().fetchNotes(),
      useEventStore.getState().fetchEvents(),
      useProjectStore.getState().fetchProjects()
    ]
    await Promise.allSettled(promises)
  }, [])

  // -------------------------------------------------------------------------
  // CRDT-aware Realtime event handlers
  // -------------------------------------------------------------------------

  /**
   * Notes handler — uses per-field LWW merge with mobile sync bridge.
   */
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

  /**
   * Note broadcast handler — for low-latency peer-to-peer updates.
   * Feeds into the same CRDT merge path.
   */
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

  /**
   * Tasks handler — uses per-field LWW-Register CRDT merge.
   */
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

  /**
   * Projects handler — uses per-field LWW-Register CRDT merge.
   */
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

  /**
   * Events handler — uses per-field LWW-Register CRDT merge.
   */
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

  /**
   * CRDT Documents handler — for binary Yjs state updates.
   */
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

    for (const row of sorted) {
      const seq = Number(row.seq || 0)
      if (seq <= cursor) continue
      if (seq > cursor + 1) {
        sawGap = true
        break
      }
      const update = toUint8Update(row.update_data)
      if (update && applyRemoteUpdateIfLoaded(noteId, update)) {
        cursor = seq
      }
    }

    if (cursor > 0) {
      setLocalLastSeq(noteId, cursor)
    }

    if (!sawGap) return

    try {
      const catchUp = await getNoteCrdtUpdates(noteId, cursor, 500)
      const catchUpSorted = [...catchUp].sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))
      for (const row of catchUpSorted) {
        const seq = Number(row.seq || 0)
        if (seq <= cursor) continue
        const update = toUint8Update(row.update_data)
        if (update && applyRemoteUpdateIfLoaded(noteId, update)) {
          cursor = seq
        }
      }
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
        fetchData().catch(e => console.error('[Realtime] Sync fetch failed:', e))
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
  }, [fetchData, handleRemoteTasks, handleRemoteProjects, handleRemoteNotes, handleRemoteCRDT, handleRemoteCrdtNoteUpdate, handleRemoteNoteBroadcast, handleRemoteEvents])

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
      const now = Date.now()
      if (realtimeConnectedRef.current) {
        if ((now - lastPollAtRef.current) < POLL_INTERVAL_REALTIME_UP) return
      }
      lastPollAtRef.current = now
      fetchData().catch(err => console.error('[Poll] Error:', err))
    }, POLL_INTERVAL_REALTIME_DOWN)
  }, [fetchData])

  const startHealthCheck = useCallback(() => {
    if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current)
    healthCheckTimerRef.current = setInterval(() => {
      if (!currentUserIdRef.current || isSubscribingRef.current) return
      const timeSinceLastAttempt = Date.now() - lastSubscribeAttemptRef.current
      if (timeSinceLastAttempt < HEALTH_CHECK_GRACE_MS) return
      if (!realtimeConnectedRef.current) subscribeToRealtime()
    }, HEALTH_CHECK_INTERVAL)
  }, [subscribeToRealtime])

  useEffect(() => {
    let mounted = true

    const executeInit = async (session: Session | null) => {
      if (initStarted.current) return
      initStarted.current = true

      try {
        if (session) {
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
            subscribeToRealtime()
            startPollFallback()
            startHealthCheck()
          }
        } else {
          currentUserIdRef.current = null
          useUserStore.getState().setUser(null)
          useTaskStore.getState().setTasks([])
          useProjectStore.getState().setProjects([])
          useNotesStore.getState().setNotes([])
          useEventStore.getState().setEvents([])
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

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        if (error.message.includes('refresh_token_not_found')) {
          await supabase.auth.signOut()
          window.location.href = '/login'
          return
        }
      }
      if (mounted) executeInit(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'TOKEN_REFRESHED' && !session) {
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }
      if ((_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') && initStarted.current) {
         initStarted.current = false
         if (mounted) executeInit(session)
      } else if (!initStarted.current) {
         if (mounted) executeInit(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
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
