import { create } from 'zustand'
import { supabase } from '@/lib/supabase.client'
import { User } from '@supabase/supabase-js'

interface UserState {
  user: User | null
  memberCount: number
  isLoading: boolean
  isInitialized: boolean
  error: Error | string | null
  setUser: (user: User | null) => void
  setInitialized: (initialized: boolean) => void
  fetchMemberCount: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  memberCount: 0,
  isLoading: false,
  isInitialized: false,
  error: null,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  fetchMemberCount: async () => {
    set({ isLoading: true, error: null })
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      if (error) throw error
      
      set({ memberCount: count || 0, isLoading: false })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Error fetching member count:', errorMessage)
      set({ error: errorMessage, isLoading: false })
    }
  },
}))

