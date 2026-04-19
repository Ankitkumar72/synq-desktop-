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
import { AuthChangeEvent, Session, RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'

// Max retry attempts for realtime subscriptions
const MAX_REALTIME_RETRIES = 5
const RETRY_BASE_DELAY_MS = 2000
// Poll intervals (ms)
const POLL_INTERVAL_REALTIME_DOWN = 10_000 // 10s when realtime is down
const HEALTH_CHECK_INTERVAL = 45_000       // 45s health check

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)
  
  // Prevent double-initialization
  const initStarted = useRef(false)
  // Track active realtime channels so we can tear them down and rebuild
  const channelsRef = useRef<RealtimeChannel[]>([])
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeConnectedRef = useRef(false)
  const channelStatusRef = useRef<Record<string, string>>({})
  const currentUserIdRef = useRef<string | null>(null)

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
  // Realtime event handlers
  // -------------------------------------------------------------------------

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

  const handleRemoteTasks = useCallback((payload: RealtimePostgresChangesPayload<Task>) => {
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
  }, [])

  const handleRemoteProjects = useCallback((payload: RealtimePostgresChangesPayload<Project>) => {
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
  }, [])

  const handleRemoteEvents = useCallback((payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
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
  }, [])

  // -------------------------------------------------------------------------
  // Subscribe to realtime — ONLY called after auth is confirmed
  // -------------------------------------------------------------------------

  const subscribeToRealtime = useCallback(async (attempt = 0) => {
    const userId = currentUserIdRef.current
    if (!userId) {
      console.warn('[Realtime] No user ID — skipping subscription')
      return
    }

    // Gating realtime setup on an active, confirmed session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('[Realtime] No active session — skipping channel setup')
      return
    }

    // Tear down any existing channels first
    channelsRef.current.forEach(ch => supabase.removeChannel(ch))
    channelsRef.current = []
    channelStatusRef.current = {}
    realtimeConnectedRef.current = false

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    console.log(`[Realtime] Subscribing to channels (attempt ${attempt}, user ${userId.slice(0, 8)}…)`)

    const tables = [
      { name: 'tasks', handler: handleRemoteTasks },
      { name: 'projects', handler: handleRemoteProjects },
      { name: 'notes', handler: handleRemoteNotes },
      { name: 'events', handler: handleRemoteEvents },
    ]

    // Track how many channels have successfully connected
    let subscribedCount = 0
    let errorCount = 0
    const totalChannels = tables.length

    const channels = tables.map(({ name, handler }) => {
      // Use unique channel names per attempt to avoid stale channel reuse
      const suffix = attempt > 0 ? `_r${attempt}` : ''
      const channel = supabase
        .channel(`synq:${name}${name === 'notes' ? '' : suffix}${name === 'notes' ? `:${userId}` : ''}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: name,
            filter: `user_id=eq.${userId}`,
          },
          handler as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
        )

      if (name === 'notes') {
        channel.on(
          'broadcast',
          { event: 'note-update' },
          ({ payload }) => {
            // Convert broadcast payload to a mock Postgres payload to reuse handleRemoteNotes
            handleRemoteNotes({ 
              eventType: 'UPDATE', 
              new: payload as Note, 
              old: {} as Note,
              schema: 'public',
              table: 'notes',
              commit_timestamp: new Date().toISOString(),
              errors: []
            })
          }
        )
      }

      channel.subscribe((status, err) => {
        console.log(`[Realtime] ${name}: ${status}${err ? ` — ${err.message}` : ''}`)
        channelStatusRef.current[name] = status

        if (status === 'SUBSCRIBED') {
          subscribedCount++
          if (subscribedCount === totalChannels) {
            realtimeConnectedRef.current = true
            console.log('[Realtime] All channels connected ✓ — triggering sync')
            // Re-fetch everything once on subscription to ensure no missed events during the gap
            fetchData().catch(err => console.error('[Realtime] Reconnect fetch failed:', err))
          }
        } else if (
          status === 'TIMED_OUT' ||
          status === 'CHANNEL_ERROR' ||
          status === 'CLOSED'
        ) {
          realtimeConnectedRef.current = false
          channelStatusRef.current[name] = status
          errorCount++
          // Only retry once (from the first channel that errors), not per-channel
          if (errorCount === 1 && attempt < MAX_REALTIME_RETRIES) {
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
            console.warn(`[Realtime] ${name} failed (${status}), retrying in ${delay}ms...`)
            retryTimeoutRef.current = setTimeout(() => {
              subscribeToRealtime(attempt + 1)
            }, delay)
          } else if (attempt >= MAX_REALTIME_RETRIES) {
            console.error(`[Realtime] Gave up after ${MAX_REALTIME_RETRIES} attempts — using poll fallback`)
          }
        }
      })

      return channel
    })

    channelsRef.current = channels
  }, [fetchData, handleRemoteTasks, handleRemoteProjects, handleRemoteNotes, handleRemoteEvents])

  // -------------------------------------------------------------------------
  // Tear down realtime channels
  // -------------------------------------------------------------------------

  const teardownRealtime = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    channelsRef.current.forEach(ch => supabase.removeChannel(ch))
    channelsRef.current = []
    channelStatusRef.current = {}
    realtimeConnectedRef.current = false
    console.log('[Realtime] Channels torn down')
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
  // Health check — detects silently dropped channels and resubscribes
  // -------------------------------------------------------------------------

  const startHealthCheck = useCallback(() => {
    if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current)

    healthCheckTimerRef.current = setInterval(() => {
      if (!currentUserIdRef.current) return // not authenticated

      const statuses = channelStatusRef.current
      const allSubscribed = Object.keys(statuses).length > 0 &&
        Object.values(statuses).every(s => s === 'SUBSCRIBED')

      if (!allSubscribed) {
        console.warn('[HealthCheck] Channels not all subscribed:', statuses, '— resubscribing')
        subscribeToRealtime()
      }
    }, HEALTH_CHECK_INTERVAL)
  }, [subscribeToRealtime])

  // -------------------------------------------------------------------------
  // Main effect: auth + data + realtime
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Extract the init routine so both methods (manual & event) can run it safely
    const executeInit = async (session: Session | null) => {
      if (initStarted.current) return
      initStarted.current = true

      try {
        if (session) {
          const t0 = performance.now()
          currentUserIdRef.current = session.user.id
          useUserStore.getState().setUser(session.user)

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

          // Start realtime + background systems immediately
          subscribeToRealtime()
          startPollFallback()
          startHealthCheck()

          console.log(`[DatabaseProvider] Init complete in ${Math.round(performance.now() - t0)}ms`)
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
          (error as any).code === 'refresh_token_not_found'
        ) {
          await supabase.auth.signOut()
          window.location.href = '/login'
          return
        }
      }
      executeInit(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      console.log(`[DatabaseProvider] Auth change detected: ${_event}`)
      
      if (_event === 'TOKEN_REFRESHED' && !session) {
        // Session is gone — clean up and redirect
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }

      if ((_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') && initStarted.current) {
         initStarted.current = false // lift exact lock so it can re-init
         executeInit(session)
      } else if (_event === 'TOKEN_REFRESHED' && session) {
        // On token refresh, reconnect realtime channels with the new JWT
        console.log('[DatabaseProvider] Token refreshed — reconnecting realtime')
        subscribeToRealtime()
      } else if (!initStarted.current) {
         // Fallback just in case getSession hasn't run yet
         executeInit(session)
      }
    })

    return () => {
      subscription.unsubscribe()
      teardownRealtime()
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
