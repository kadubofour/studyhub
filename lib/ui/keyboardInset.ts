'use client'
import { useEffect, useState } from 'react'

// How much of the bottom of the window the on-screen keyboard covers, in px (0 when it is closed or there is none).
// A phone keeps fixed elements where they were when the keyboard opens and only shrinks the visible area, so a bar
// fixed to the bottom is lifted by this much to sit just above the keyboard, as in every notes app.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])
  return inset
}
