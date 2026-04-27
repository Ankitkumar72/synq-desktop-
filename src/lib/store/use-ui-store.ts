import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  isSidebarOpen: boolean
  isSettingsOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openSettings: () => void
  closeSettings: () => void
  setSettingsOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      isSettingsOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
    }),
    {
      name: 'ui-storage',
    }
  )
)
