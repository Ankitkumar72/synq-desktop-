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
import { AuthChangeEvent, Session, RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'
import { bindNoteBroadcastChannel, getNoteSyncClientId, NOTE_BROADCAST_EVENT, type NoteBroadcastPayload } from '@/lib/realtime/note-sync'
import { initSyncManager, destroySyncManager } from '@/lib/crdt/sync-manager'
import { destroyAllYDocs, applyRemoteUpdate } from '@/lib/crdt/crdt-doc'

// Realtime config
const MAX_REALTIME_RETRIES = 5
const RETRY_BASE_DELAY_MS = 2000
const INITIAL_SUBSCRIBE_DELAY_MS = 1500  // Let the Realtime tenant warm up on first connect
// Poll intervals (ms)
const POLL_INTERVAL_REALTIME_DOWN = 10_000  // 10s when realtime is down
const HEALTH_CHECK_INTERVAL = 60_000        // 60s health check
const HEALTH_CHECK_GRACE_MS = 30_000        // Don't health-check within 30s of a subscribe attempt

function describeRealtimeError(err: unknown) {
  if (!err) return ''
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err

  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)
  
  // Prevent double-initialization
  const initStarted = useRef(false)
  // Single realtime channel (all tables multiplexed on one channel)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeConnectedRef = useRef(false)
  const isSubscribingRef = useRef(false)            // Lock: prevents concurrent subscriptions
  const lastSubscribeAttemptRef = useRef<number>(0)  // Timestamp of last subscribe attempt
  const subscriptionGenRef = useRef(0)               // Generation counter — ignores stale callbacks
  const currentUserIdRef = useRef<string | null>(null)

  // -------------------------------------------------------------------------
  // Fetch data from Supabase
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // CRDT-aware Realtime event handlers
  // -------------------------------------------------------------------------

  /**
   * Notes handler — uses per-field LWW merge with mobile sync bridge.
   */
  const handleRemoteNotes = useCallback((payload: RealtimePostgresChangesPayload<Note>) => {
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
   * Delegates to mergeTaskLocal which performs field-level conflict resolution.
   */
  const handleRemoteTasks = useCallback((payload: RealtimePostgresChangesPayload<Task>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const store = useTaskStore.getState()
    if (newRecord && 'hlc_timestamp' in newRecord && newRecord.hlc_timestamp) hlc.receive(newRecord.hlc_timestamp)

    if (eventType === 'INSERT' && newRecord && 'id' in newRecord) {
      // Check if we already have this task (optimistic insert)
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
   * Delegates to mergeProjectLocal for field-level conflict resolution.
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
   * Delegates to mergeEventLocal for field-level conflict resolution.
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

  // -------------------------------------------------------------------------
  // Subscribe to realtime — uses a SINGLE multiplexed channel
  // All four tables (tasks, projects, notes, events) share one channel.
  // This eliminates partial-failure states and reduces connection overhead.
  // -------------------------------------------------------------------------

  /**
   * CRDT Documents handler — for binary Yjs state updates.
   */
  const handleRemoteCRDT = useCallback((payload: RealtimePostgresChangesPayload<{ entity_id?: string; state?: number[] }>) => {
    const { eventType, new: newRecord } = payload
    
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord && newRecord.entity_id) {
      // Apply the binary update to the local Yjs doc
      if (newRecord.state && Array.isArray(newRecord.state)) {
        const binaryState = new Uint8Array(newRecord.state)
        applyRemoteUpdate(newRecord.entity_id, binaryState)
      }
    }
  }, [])

  const subscribeToRealtime = useCallback(async (attempt = 0) => {
    // LOCK: Prevent concurrent subscription attempts.
    // Retries (attempt > 0) bypass the lock since they're continuing the same sequence.
    if (isSubscribingRef.current && attempt === 0) {
      console.log('[Realtime] Subscription already in progress — skipping')
      return
    }
    
    const userId = currentUserIdRef.current
    if (!userId) {
      console.warn('[Realtime] No user ID — skipping subscription')
      return
    }

    isSubscribingRef.current = true
    lastSubscribeAttemptRef.current = Date.now()

    // Increment generation — any callbacks from older generations will be ignored.
    // This is critical because removeChannel() synchronously triggers the
    // subscribe callback with CLOSED status, which would otherwise schedule a
    // spurious retry while we're still mid-subscribe.
    const currentGen = ++subscriptionGenRef.current

    // Cancel any pending retry timer
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    // Tear down existing channel first
    if (channelRef.current) {
      console.log('[Realtime] Removing existing channel...')
      try {
        supabase.removeChannel(channelRef.current)
      } catch (e) {
        console.warn('[Realtime] Error removing channel:', e)
      }
      channelRef.current = null
      bindNoteBroadcastChannel(null)
      realtimeConnectedRef.current = false
      // Brief pause so the server can process the leave before we rejoin
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // On the first attempt, give the Realtime tenant time to warm up.
    // The server-side tenant is stopped after periods of inactivity and needs
    // ~2 seconds to re-initialize replication slots and DB connections.
    if (attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, INITIAL_SUBSCRIBE_DELAY_MS))
    }

    // Verify session is still active
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('[Realtime] No active session — skipping channel setup')
      isSubscribingRef.current = false
      return
    }

    // CRITICAL: Explicitly sync the user's JWT to the Realtime WebSocket.
    // getSession() returns the session but does NOT propagate the access token
    // to the Realtime transport — that normally happens via onAuthStateChange.
    // If we subscribe before onAuthStateChange fires, the Realtime client
    // connects with the anon key, and the server can't evaluate RLS filters,
    // causing CHANNEL_ERROR.
    await supabase.realtime.setAuth(session.access_token)

    console.log(`[Realtime] Subscribing (attempt ${attempt}, user ${userId.slice(0, 8)}…)`)

    // SINGLE channel with ALL table listeners multiplexed.
    // This means one subscribe() call, one status, one connection.
    // NOTE: We intentionally omit the `filter` option on postgres_changes.
    // RLS policies (auth.uid() = user_id) already protect data access server-side.
    // Filters are an optional optimization, but they can cause CHANNEL_ERROR if the
    // Realtime server fails to evaluate them during the channel join handshake.
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

    channel.subscribe((status, err) => {
      // CRITICAL: Ignore callbacks from stale subscriptions.
      // When removeChannel() is called, it synchronously fires the callback
      // with CLOSED — without this guard, that would schedule a spurious retry.
      if (subscriptionGenRef.current !== currentGen) {
        console.log(`[Realtime] Ignoring stale ${status} callback (gen ${currentGen}, current ${subscriptionGenRef.current})`)
        return
      }

      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✓ Connected — all tables listening (CRDT merge active)')
        realtimeConnectedRef.current = true
        isSubscribingRef.current = false
        bindNoteBroadcastChannel(channel)
        // Re-fetch data to pick up anything missed during the connection gap
        fetchData().catch(e => console.error('[Realtime] Sync fetch failed:', e))
      } else if (
        status === 'TIMED_OUT' ||
        status === 'CHANNEL_ERROR' ||
        status === 'CLOSED'
      ) {
        const errorMessage = describeRealtimeError(err)
        console.warn(`[Realtime] Channel ${status}${errorMessage ? ` — ${errorMessage}` : ''}`)
        realtimeConnectedRef.current = false
        bindNoteBroadcastChannel(null)

        if (attempt < MAX_REALTIME_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
          console.warn(`[Realtime] Retry ${attempt + 1}/${MAX_REALTIME_RETRIES} in ${delay}ms`)
          retryTimeoutRef.current = setTimeout(() => {
            subscribeToRealtime(attempt + 1)
          }, delay)
        } else {
          console.error('[Realtime] Max retries reached — using poll fallback only')
          isSubscribingRef.current = false
        }
      }
      // Ignore transitional statuses (JOINING, CHANNEL_INITIALIZED, etc.)
    })
  }, [fetchData, handleRemoteTasks, handleRemoteProjects, handleRemoteNotes, handleRemoteCRDT, handleRemoteNoteBroadcast, handleRemoteEvents])

  // -------------------------------------------------------------------------
  // Tear down realtime channel (synchronous — safe for React cleanup)
  // -------------------------------------------------------------------------

  const teardownRealtime = useCallback(() => {
    // Increment generation so any in-flight callbacks from the old channel are ignored
    subscriptionGenRef.current++

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    
    if (channelRef.current) {
      console.log('[Realtime] Tearing down channel...')
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
  }, [])

  // -------------------------------------------------------------------------
  // Poll fallback — keeps data fresh when realtime is unreliable
  // -------------------------------------------------------------------------

  const startPollFallback = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)

    pollTimerRef.current = setInterval(() => {
      // Only poll when the timer fires at the right cadence
      // Timer runs every 10s; skip if realtime is up and not enough time
      if (realtimeConnectedRef.current) {
        // When connected, only poll every 60s (skip 5 of every 6 ticks)
        const now = Math.floor(Date.now() / 1000)
        if (now % 60 > 10) return
      }

      console.log(`[Poll] Refreshing data (realtime=${realtimeConnectedRef.current ? 'up' : 'down'})`)
      fetchData().catch(err => console.error('[Poll] Error:', err))
    }, POLL_INTERVAL_REALTIME_DOWN)
  }, [fetchData])

  // -------------------------------------------------------------------------
  // Health check — detects silently dropped channels and resubscribes.
  // Has a grace period to avoid fighting with an in-progress connection.
  // -------------------------------------------------------------------------

  const startHealthCheck = useCallback(() => {
    if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current)

    healthCheckTimerRef.current = setInterval(() => {
      if (!currentUserIdRef.current) return // not authenticated

      // Don't interfere if we're already subscribing
      if (isSubscribingRef.current) return

      // Don't interfere if we recently started a subscribe attempt (grace period)
      const timeSinceLastAttempt = Date.now() - lastSubscribeAttemptRef.current
      if (timeSinceLastAttempt < HEALTH_CHECK_GRACE_MS) return

      if (!realtimeConnectedRef.current) {
        console.warn('[HealthCheck] Realtime not connected — resubscribing')
        subscribeToRealtime()
      }
    }, HEALTH_CHECK_INTERVAL)
  }, [subscribeToRealtime])

  // -------------------------------------------------------------------------
  // Main effect: auth + data + realtime + CRDT sync manager
  // -------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true

    // Extract the init routine so both methods (manual & event) can run it safely
    const executeInit = async (session: Session | null) => {
      if (initStarted.current) return
      initStarted.current = true

      try {
        if (session) {
          const t0 = performance.now()
          currentUserIdRef.current = session.user.id
          useUserStore.getState().setUser(session.user)

          // *** Initialize the CRDT Sync Manager ***
          initSyncManager()

          // *** SPEED FIX: Fire EVERYTHING in parallel ***
          // Profile, device check, data fetch, and realtime all start at once.
          // Only device registration can block the UI (if limit exceeded).
          const [profileResult, deviceResult] = await Promise.allSettled([
            useProfileStore.getState().fetchProfile(),
            registerDevice().catch(err => {
              console.error('[DatabaseProvider] Device registration failed:', err)
              return { allowed: true }
            }),
            fetchData(),  // data streams into stores as it arrives
          ])

          // Log any profile failure (non-blocking)
          if (profileResult.status === 'rejected') {
            console.error('[DatabaseProvider] Profile fetch failed:', profileResult.reason)
          }

          // Check device limit — the only blocking gate
          const result = deviceResult.status === 'fulfilled' ? deviceResult.value : { allowed: true }
          if (result && !result.allowed) {
            setDeviceLimitExceeded(true)
            setDeviceInfo(result as DeviceRegistrationResult)
            return
          }

          setDeviceLimitExceeded(false)
          setDeviceInfo(null)

          // Start realtime + background systems (only if still mounted)
          if (mounted) {
            subscribeToRealtime()
            startPollFallback()
            startHealthCheck()
          }

          console.log(`[DatabaseProvider] Init complete in ${Math.round(performance.now() - t0)}ms (CRDT sync active)`)
        } else {
          // Clear data if logged out
          currentUserIdRef.current = null
          useUserStore.getState().setUser(null)
          useTaskStore.getState().setTasks([])
          useProjectStore.getState().setProjects([])
          useNotesStore.getState().setNotes([])
          useEventStore.getState().setEvents([])
          setDeviceLimitExceeded(false)
          setDeviceInfo(null)

          // Clean up CRDT state on sign-out
          destroyAllYDocs()
          destroySyncManager()

          // Tear down realtime on sign-out
          teardownRealtime()
        }
      } catch (err) {
        console.error('[DatabaseProvider] Error handling auth change:', err)
      } finally {
        // Always ensure isInitialized is true after any session init attempt
        useUserStore.getState().setInitialized(true)
      }
    }

    // Manual initial check (critical for standalone Electron/desktop runtimes)
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('[DatabaseProvider] getSession error:', error)
        if (
          error.message.includes('refresh_token_not_found') ||
          error.message.includes('Invalid Refresh Token') ||
          (error as { code?: string }).code === 'refresh_token_not_found'
        ) {
          await supabase.auth.signOut()
          window.location.href = '/login'
          return
        }
      }
      if (mounted) executeInit(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      console.log(`[DatabaseProvider] Auth change: ${_event}`)
      
      if (_event === 'TOKEN_REFRESHED' && !session) {
        // Session is gone — clean up and redirect
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }

      if ((_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') && initStarted.current) {
         initStarted.current = false // lift exact lock so it can re-init
         if (mounted) executeInit(session)
      } else if (_event === 'TOKEN_REFRESHED' && session) {
        // Supabase Realtime auto-handles JWT refresh internally.
        // Do NOT tear down and rebuild channels — that causes CLOSED errors.
        console.log('[DatabaseProvider] Token refreshed — Realtime will auto-update')
      } else if (!initStarted.current) {
         // Fallback just in case getSession hasn't run yet
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
