import { create } from 'zustand'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'

type PlanTier = 'free' | 'pro'

interface ProfileState {
  planTier: PlanTier
  isPro: boolean
  isAdmin: boolean
  isLoading: boolean
  error: string | null
  fetchProfile: () => Promise<void>
}

export const useProfileStore = create<ProfileState>((set) => ({
  planTier: 'free',
  isPro: false,
  isAdmin: false,
  isLoading: true,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = useUserStore.getState().user
      if (!user) {
        set({ isLoading: false, planTier: 'free', isPro: false, isAdmin: false })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('plan_tier, is_admin')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const planTier = (data?.plan_tier as PlanTier) || 'free'
      const isAdmin = data?.is_admin || false

      set({
        planTier,
        isPro: planTier === 'pro' || isAdmin,
        isAdmin,
        isLoading: false,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ProfileStore] Error fetching profile:', message)
      set({ error: message, isLoading: false })
    }
  },
}))
