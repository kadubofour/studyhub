'use client'
import { useEffect } from 'react'

interface Sentinel { release: () => Promise<void> }
type WakeNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }

/**
 * Keeps the screen on while `active` (a session is running). The browser drops the lock whenever the page is hidden, so it is taken again when the
 * student comes back. A browser without Screen Wake Lock, or one that refuses, simply lets the screen sleep as before.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wake = (navigator as WakeNav).wakeLock
    if (!active || !wake) return
    let held: Sentinel | null = null
    let live = true
    const take = () => {
      if (document.visibilityState !== 'visible' || held) return
      wake.request('screen').then(s => { if (live) held = s; else void s.release().catch(() => {}) }, () => { /* refused: low battery, or not allowed here */ })
    }
    const again = () => { held = null; take() } // the lock is gone once the page was hidden
    take()
    document.addEventListener('visibilitychange', again)
    return () => { live = false; document.removeEventListener('visibilitychange', again); void held?.release().catch(() => {}) }
  }, [active])
}
