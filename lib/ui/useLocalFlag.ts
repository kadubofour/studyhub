'use client'
import { useCallback, useSyncExternalStore } from 'react'

// A boolean remembered in localStorage (per device), shared live between components.
const EVENT = 'studyhub:local-flag'

function read(key: string): boolean {
  try { return window.localStorage.getItem(key) === '1' } catch { return false }
}

export function useLocalFlag(key: string): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    cb => {
      window.addEventListener(EVENT, cb); window.addEventListener('storage', cb)
      return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb) }
    },
    () => read(key),
    () => false,
  )
  const set = useCallback((v: boolean) => {
    try { window.localStorage.setItem(key, v ? '1' : '0') } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT))
  }, [key])
  return [value, set]
}
