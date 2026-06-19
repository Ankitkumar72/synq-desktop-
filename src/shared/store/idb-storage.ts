import { get, set, del } from 'idb-keyval'
import { StateStorage } from 'zustand/middleware'

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null
    try {
      const value = await get(name)
      return value || null
    } catch (e) {
      console.warn('IDB getItem failed, falling back to localStorage', e)
      return typeof window !== 'undefined' ? (globalThis as any).localStorage.getItem(name) : null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return
    try {
      await set(name, value)
    } catch (e) {
      console.warn('IDB setItem failed, falling back to localStorage', e)
      if (typeof window !== 'undefined') {
        (globalThis as any).localStorage.setItem(name, value)
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return
    try {
      await del(name)
    } catch (e) {
      console.warn('IDB removeItem failed, falling back to localStorage', e)
      if (typeof window !== 'undefined') {
        (globalThis as any).localStorage.removeItem(name)
      }
    }
  },
}
