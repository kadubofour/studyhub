'use client'
import { useEffect, useState } from 'react'
import { isDiagramToken } from './images'

// A picture stored before diagrams were named "fig-" is told apart by how it looks: mostly white paper, drawn in a handful of flat colours.
// A photo has a spread of colours and little pure white, so it is left as it is. Used to light the lines of diagrams in dark mode.

const SIDE = 64
const PAPER = 0.5 // at least this share of the picture is white paper
const MIN_SHARE = 0.005 // a colour counts when it covers this share
const MAX_COLOURS = 10 // a diagram is drawn in few colours; a photo in dozens

/** Whether RGBA pixels (a small sample of the picture) look like a drawing on white paper */
export function looksLikeDiagram(rgba: ArrayLike<number>): boolean {
  const total = Math.floor(rgba.length / 4)
  if (total === 0) return false
  const counts = new Map<number, number>()
  let white = 0
  for (let i = 0; i < total; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3]
    if (a < 200) return false // transparent pictures already sit on the page
    if (r > 240 && g > 240 && b > 240) white++
    const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    counts.set(q, (counts.get(q) ?? 0) + 1)
  }
  if (white / total < PAPER) return false
  let colours = 0
  for (const n of counts.values()) if (n / total >= MIN_SHARE) colours++
  return colours <= MAX_COLOURS
}

const verdicts = new Map<string, Promise<boolean>>()

function probe(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SIDE; canvas.height = SIDE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(false)
        ctx.drawImage(img, 0, 0, SIDE, SIDE)
        resolve(looksLikeDiagram(ctx.getImageData(0, 0, SIDE, SIDE).data))
      } catch { resolve(false) } // a picture the browser will not let be read stays as it is
    }
    img.onerror = () => resolve(false)
    img.src = url
  })
}

/** True when a note picture is a diagram: named so, or (for older pictures) looking like one. Only asked for in dark mode's sake, but cheap and cached. */
export function useIsDiagram(src: string, url: string | null): boolean {
  const named = isDiagramToken(src)
  const [seen, setSeen] = useState<{ src: string; yes: boolean } | null>(null)
  useEffect(() => {
    if (named || !url) return
    let live = true
    if (!verdicts.has(src)) verdicts.set(src, probe(url))
    verdicts.get(src)!.then(yes => { if (live) setSeen({ src, yes }) })
    return () => { live = false }
  }, [named, src, url])
  return named || (seen?.src === src && seen.yes)
}
