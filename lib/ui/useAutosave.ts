'use client'
import { useEffect, useRef, useState } from 'react'
import { createAutosaver, type SaveStatus } from './autosave'

export function useAutosave<T>(save: (v: T) => Promise<void>, delayMs = 1000) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  const saver = useRef<ReturnType<typeof createAutosaver<T>> | null>(null)
  if (saver.current === null) saver.current = createAutosaver<T>(v => saveRef.current(v), setStatus, delayMs)

  useEffect(() => {
    const s = saver.current!
    const onOnline = () => { if (s.hasPending()) void s.flush() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (s.hasPending()) { void s.flush(); e.preventDefault() } }
    const onHide = () => { if (document.visibilityState === 'hidden') void s.flush() }
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onHide)
      void s.flush() // leaving the note: save what's pending
    }
  }, [])

  return { update: (v: T) => saver.current!.update(v), flush: () => saver.current!.flush(), status }
}
