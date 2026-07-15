"use client"

import { useEffect, useState, useRef, createContext, useContext } from 'react'
import { supabase } from "@/shared"
import { useUserStore } from "@/shared"
import { useProfileStore } from "@/shared"
import { useNotesStore } from "@/shared"
import { registerDevice, type DeviceRegistrationResult } from '@/lib/device-manager'
import { DeviceLimitPage } from '@/components/device-limit-page'
import { SyncEngine, SyncState } from '@/shared/sync/sync-engine'
import { initSyncManager, destroySyncManager } from '@/shared/crdt/sync-manager'
import { destroyAllYDocs } from '@/shared/crdt/crdt-doc'
import { Session } from '@supabase/supabase-js'

const SyncStateContext = createContext<SyncState>(SyncState.DISCONNECTED)
export const useSyncState = () => useContext(SyncStateContext)

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistrationResult | null>(null)
  const [syncState, setSyncState] = useState<SyncState>(SyncState.DISCONNECTED)
  
  const initStarted = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)
  
  // Specifically track which note the user is actively editing
  const activeEditNoteId = useNotesStore(s => s.activeEditNoteId)

  useEffect(() => {
    const engine = SyncEngine.getInstance();
    const unsubscribe = engine.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const engine = SyncEngine.getInstance();
    engine.setActiveNoteId(activeEditNoteId);
  }, [activeEditNoteId]);

  useEffect(() => {
    let mounted = true

    const executeInit = async (session: Session | null) => {
      const targetUserId = session?.user?.id || null
      if (initStarted.current && currentUserIdRef.current === targetUserId) return
      
      initStarted.current = true

      try {
        if (session) {
          currentUserIdRef.current = session.user.id
          
          initSyncManager()

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
            SyncEngine.getInstance().init(session);
          }
        } else {
          currentUserIdRef.current = null
          useUserStore.getState().setUser(null)
          setDeviceLimitExceeded(false)
          setDeviceInfo(null)
          destroyAllYDocs()
          destroySyncManager()
          SyncEngine.getInstance().teardown();
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

    return () => {
      mounted = false
      subscription.unsubscribe()
      destroySyncManager()
      SyncEngine.getInstance().teardown()
    }
  }, [])

  if (deviceLimitExceeded && deviceInfo) {
    return (
      <DeviceLimitPage
        activeCount={deviceInfo.active_count}
        maxDevices={deviceInfo.max_devices}
        planTier={deviceInfo.plan_tier}
      />
    )
  }

  return (
    <SyncStateContext.Provider value={syncState}>
      {children}
    </SyncStateContext.Provider>
  )
}
