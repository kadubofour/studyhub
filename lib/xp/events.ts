'use client'
import { useEffect, useRef } from 'react'

// Anything that earns XP or changes which cards are due says so once it is saved, so the top bar, Home and Progress read again
export const PROGRESS_CHANGED = 'studyhub:progress-changed'
export const announceProgressChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROGRESS_CHANGED)) }

export function useProgressChanged(react: () => void) {
  const latest = useRef(react)
  useEffect(() => { latest.current = react })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(PROGRESS_CHANGED, heard)
    return () => window.removeEventListener(PROGRESS_CHANGED, heard)
  }, [])
}
