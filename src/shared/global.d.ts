/**
 * Minimal DOM type declarations for the shared package.
 *
 * The shared package is platform-agnostic (used by web + mobile) so we don't
 * include the full "dom" lib.  These declarations cover the browser APIs that
 * the CRDT / sync code accesses behind `typeof window !== 'undefined'` guards.
 */

/* eslint-disable no-var */

interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface Navigator {
  readonly onLine: boolean
}

interface WindowEventMap {
  online: Event
  offline: Event
}

interface Window {
  localStorage: Storage
  sessionStorage: Storage
  addEventListener<K extends keyof WindowEventMap>(
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
  ): void
  removeEventListener<K extends keyof WindowEventMap>(
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
  ): void
}

declare var window: Window | undefined
declare var navigator: Navigator | undefined
declare var sessionStorage: Storage

