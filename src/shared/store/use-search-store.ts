import { create } from 'zustand'
import { createClient } from '@/shared/supabase/client'

export interface SearchResult {
  id: string
  title: string
  excerpt: string
  rank: number
  updated_at: string
}

interface SearchStore {
  query: string
  results: SearchResult[]
  isSearching: boolean
  setQuery: (query: string) => void
  clearSearch: () => void
  performSearch: (query: string) => Promise<void>
}

let searchTimeout: NodeJS.Timeout | null = null

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,

  setQuery: (query: string) => {
    set({ query })
    if (!query.trim()) {
      set({ results: [], isSearching: false })
      if (searchTimeout) clearTimeout(searchTimeout)
      return
    }

    if (searchTimeout) clearTimeout(searchTimeout)
    set({ isSearching: true })

    searchTimeout = setTimeout(() => {
      get().performSearch(query)
    }, 300)
  },

  clearSearch: () => {
    set({ query: '', results: [], isSearching: false })
    if (searchTimeout) clearTimeout(searchTimeout)
  },

  performSearch: async (query: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('search_notes', { p_query: query })
      
      if (error) {
        console.error('Search error:', error)
        set({ results: [], isSearching: false })
        return
      }

      set({ results: data || [], isSearching: false })
    } catch (err) {
      console.error('Failed to perform search:', err)
      set({ results: [], isSearching: false })
    }
  }
}))
