'use client'
import { useEffect, useRef, useState } from 'react'

// A row that scrolls sideways (chips, a toolbar on a phone): `more` while some of it is past the right edge, so that edge can
// fade (CSS [data-more] in app/globals.css) and it is clear the row scrolls. Put `ref` on the row and `data-more={more || undefined}`.
export function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const row = ref.current
    if (!row) return
    const check = () => setMore(row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
    check()
    row.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    // what is in the row can change (counts arriving, a course added)
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(check) : null
    mo?.observe(row, { childList: true, subtree: true, characterData: true })
    return () => { row.removeEventListener('scroll', check); window.removeEventListener('resize', check); mo?.disconnect() }
  }, [])
  return { ref, more }
}
