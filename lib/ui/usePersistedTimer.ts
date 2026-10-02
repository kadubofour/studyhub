'use client'
import { useEffect, useRef, useState } from 'react'
import type { TimerState } from '../timer'
import { localDayKey } from '../dates'
import { loadTimer, saveTimer } from './timerStore'

// Keeps the focus timer in localStorage so a reload (or sleep) doesn't lose a running session.
export function usePersistedTimer(initial: () => TimerState, tz: string) {
  const [timer, setTimer] = useState(initial)
  const [completedFocus, setCompletedFocus] = useState(0)
  // `ready` is state, not a ref: it flips in the same render as the restored timer, so the
  // save effect never runs with the fresh initial state and can't clobber a saved session.
  const [ready, setReady] = useState(false)
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return // StrictMode re-runs effects; restore once
    restored.current = true
    const saved = loadTimer(window.localStorage)
    const today = localDayKey(new Date(), tz)
    // Syncing from localStorage must happen after hydration (the server has no storage),
    // so setting state here is intentional and runs once.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) { setTimer(saved.state); setCompletedFocus(saved.dayKey === today ? saved.completedFocus : 0) }
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tz])

  useEffect(() => {
    if (ready) saveTimer(window.localStorage, { state: timer, completedFocus, dayKey: localDayKey(new Date(), tz) })
  }, [ready, timer, completedFocus, tz])

  return { timer, setTimer, completedFocus, setCompletedFocus }
}
