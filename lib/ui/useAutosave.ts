'use client'
import { useEffect, useState } from 'react'
import { createAutosaver, type SaveStatus } from './autosave'

export function useAutosave<T>(save: (v: T) => Promise<void>, delayMs = 1000) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  // One saver per mounted editor, bound to the first `save`. Callers must remount (e.g. key by
  // note id) when the save target changes, so edits can never be written to the wrong note.
  const [saver] = useState(() => createAutosaver<T>(save, setStatus, delayMs))

  useEffect(() => {
    const onOnline = () => { if (saver.hasPending()) void saver.flush() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (saver.hasPending()) { void saver.flush(); e.preventDefault() } }
    const onHide = () => { if (document.visibilityState === 'hidden') void saver.flush() }
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onHide)
      void saver.flush() // leaving the note: save what's pending
    }
  }, [saver])

  return { update: saver.update, flush: saver.flush, status }
}
