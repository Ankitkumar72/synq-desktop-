import { useEffect, useRef } from 'react'

export function useDebounce<T extends (...args: never[]) => unknown>(callback: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const debouncedCallback = (...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }

  return debouncedCallback
}
