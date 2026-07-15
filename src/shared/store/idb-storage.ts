import { get, set, del } from 'idb-keyval'
import { StateStorage } from 'zustand/middleware'

const ACTIVE_PREFIX_KEY = 'synq_active_idb_prefix'
const DEFAULT_PREFIX = ''

export function getActivePrefix(): string {
  if (typeof window === 'undefined') return DEFAULT_PREFIX
  return localStorage.getItem(ACTIVE_PREFIX_KEY) || DEFAULT_PREFIX
}

export function setActivePrefix(prefix: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_PREFIX_KEY, prefix)
}

function getPrefixedName(name: string): string {
  // If it's a mutation journal or purely internal, we might not want to prefix,
  // but for Zustand stores (synq-notes, etc.), we apply the prefix.
  if (name.startsWith('synq-mutation-journal')) return name
  return `${getActivePrefix()}${name}`
}

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null
    try {
      const value = await get(getPrefixedName(name))
      return value || null
    } catch (e) {
      console.warn('IDB getItem failed, falling back to localStorage', e)
      return typeof window !== 'undefined' ? (globalThis as any).localStorage.getItem(getPrefixedName(name)) : null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return
    try {
      await set(getPrefixedName(name), value)
    } catch (e) {
      console.warn('IDB setItem failed, falling back to localStorage', e)
      if (typeof window !== 'undefined') {
        (globalThis as any).localStorage.setItem(getPrefixedName(name), value)
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return
    try {
      await del(getPrefixedName(name))
    } catch (e) {
      console.warn('IDB removeItem failed, falling back to localStorage', e)
      if (typeof window !== 'undefined') {
        (globalThis as any).localStorage.removeItem(getPrefixedName(name))
      }
    }
  },
}

export async function writeToShadowPrefix(prefix: string, name: string, value: any): Promise<void> {
  const prefixedName = `${prefix}${name}`
  await set(prefixedName, typeof value === 'string' ? value : JSON.stringify(value))
}

export async function clearShadowPrefix(prefix: string, storeNames: string[]): Promise<void> {
  for (const name of storeNames) {
    await del(`${prefix}${name}`)
  }
}
