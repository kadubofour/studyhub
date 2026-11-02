'use client'
import { useEffect } from 'react'

// While a full-screen layer is open (the live voice screen, a visual lesson), the page behind it does not scroll: the wheel and touch go to the layer
// alone. Several layers may be open at once, so the page is freed only when the last one closes.
let open = 0
let before: { html: string; body: string } | null = null

export function useLockScroll(on = true) {
  useEffect(() => {
    if (!on) return
    if (open++ === 0) {
      before = { html: document.documentElement.style.overflow, body: document.body.style.overflow }
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    }
    return () => {
      if (--open === 0 && before) {
        document.documentElement.style.overflow = before.html
        document.body.style.overflow = before.body
        before = null
      }
    }
  }, [on])
}
