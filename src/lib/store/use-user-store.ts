import { create } from 'zustand'
import { supabase } from '@/lib/supabase.client'

interface UserState {
  user: {
    name: string
  }
  memberCount: number
  isLoading: boolean
  error: Error | string | null
  fetchMemberCount: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  user: {
    name: "Ankit Kumar", // Default or fetched user
  },
  memberCount: 0,
  isLoading: false,
  error: null,
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
