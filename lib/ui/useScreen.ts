'use client'
import { useSyncExternalStore } from 'react'

// Which layout a screen gets: a phone's (narrower than md, 768px) or a computer's. null before the page is running in the
// browser (the server's render and hydration), when both are drawn and CSS shows the right one, so nothing flashes.
// Without matchMedia (tests) it is a computer.
export type Screen = 'phone' | 'computer'
const QUERY = '(max-width: 767.98px)'

function subscribe(onChange: () => void) {
  const list = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}
const current = (): Screen => (typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches ? 'phone' : 'computer')

export const useScreen = (): Screen | null => useSyncExternalStore(subscribe, current, () => null)

/** Draw the phone's layout (or the computer's): true while the screen is not known yet, so CSS can choose */
export const showsPhone = (s: Screen | null) => s !== 'computer'
export const showsComputer = (s: Screen | null) => s !== 'phone'
