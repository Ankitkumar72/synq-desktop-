import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LucideIcon } from 'lucide-react'

export interface SearchResult {
  id: string
  type: 'task' | 'note' | 'doc' | 'event' | 'folder' | 'command'
  title: string
  metadata: string
  icon: LucideIcon
  color?: string
  bgColor?: string
  href?: string
  time?: string
  snippet?: string
  author?: string
  updatedAt?: string
}

interface UIState {
  isSidebarOpen: boolean
  isSettingsOpen: boolean
  isSearchOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openSettings: () => void
  closeSettings: () => void
  setSettingsOpen: (open: boolean) => void
  openSearch: () => void
  closeSearch: () => void
  setSearchOpen: (open: boolean) => void
  isCreateOpen: boolean
  createType: 'task' | 'project' | 'note' | 'event'
  openCreate: (type?: 'task' | 'project' | 'note' | 'event') => void
  closeCreate: () => void
  setCreateOpen: (open: boolean) => void
  recentSearches: SearchResult[]
  addRecentSearch: (item: SearchResult) => void
  clearRecentSearches: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      isSettingsOpen: false,
      isSearchOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),
      setSearchOpen: (open) => set({ isSearchOpen: open }),
      isCreateOpen: false,
      createType: 'task',
      openCreate: (type = 'task') => set({ isCreateOpen: true, createType: type }),
      closeCreate: () => set({ isCreateOpen: false }),
      setCreateOpen: (open: boolean) => set({ isCreateOpen: open }),
      recentSearches: [],
      addRecentSearch: (item: SearchResult) => set((state) => {
        const filtered = state.recentSearches.filter(i => i.id !== item.id)
        return { recentSearches: [item, ...filtered].slice(0, 10) }
      }),
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'ui-storage',
    }
  )
)
