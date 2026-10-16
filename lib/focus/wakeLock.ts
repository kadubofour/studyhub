'use client'
import { useEffect } from 'react'

interface Sentinel { release: () => Promise<void>; addEventListener?: (type: 'release', fn: () => void) => void }
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
    let asking = false // an answer is on its way: asking again would leave two locks, one of them never let go
    let live = true
    const take = () => {
      if (document.visibilityState !== 'visible' || held || asking) return
      asking = true
      wake.request('screen').then(s => {
        asking = false
        if (!live) { void s.release().catch(() => {}); return }
        held = s
        s.addEventListener?.('release', () => { if (held === s) held = null }) // the system took it back
      }, () => { asking = false /* refused: low battery, or not allowed here */ })
    }
    const again = () => { held = null; take() } // the lock is gone once the page was hidden
    take()
    document.addEventListener('visibilitychange', again)
    return () => { live = false; document.removeEventListener('visibilitychange', again); void held?.release().catch(() => {}) }
  }, [active])
}
