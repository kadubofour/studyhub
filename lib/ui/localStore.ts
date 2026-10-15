'use client'
import { useSyncExternalStore } from 'react'

export interface LocalStore<T> {
  get: () => T
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
  fallback: T
}

/**
 * One small value kept in this browser's localStorage, readable by React without a flash: `get` returns the same object until the stored text
 * changes, `parse` cleans whatever is found there (so a hand-edited or old value cannot break the page), and other tabs' changes are picked up.
 */
export function localStore<T>(key: string, fallback: T, parse: (stored: unknown) => T): LocalStore<T> {
  let raw: string | null | undefined
  let cached = fallback
  const listeners = new Set<() => void>()
  const get = () => {
    try {
      const r = window.localStorage.getItem(key)
      if (r !== raw) { raw = r; cached = r === null ? fallback : parse(JSON.parse(r)) }
    } catch { raw = null; cached = fallback }
    return cached
  }
  const set = (value: T) => {
    try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable: the value is kept for this page only */ cached = value; raw = undefined }
    raw = undefined
    listeners.forEach(l => l())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => { if (e.key === key || e.key === null) { raw = undefined; listener() } }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
  }
  return { get, set, subscribe, fallback }
}

/** The store's value in a component: the fallback on the server and first paint, the stored value after */
export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.fallback)
}
