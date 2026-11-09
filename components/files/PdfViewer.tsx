'use client'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MessagesSquare, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist'
import { MIN_SELECTED } from '@/components/notes/ExplainBubble'
import { Working } from '@/components/ui/Working'
import { pdfEngine } from '@/lib/import/pdfEngine'
import { pixelsPerPoint, type PdfPart } from '@/lib/files/pdfView'

const WIDEST = 900 // at 100%, so a page on a large screen stays a readable size
const SMALLEST_ZOOM = 0.5
const LARGEST_ZOOM = 3
const ZOOM_STEP = 0.25
const DRAW_AHEAD = '800px 0px' // pages this close to the view are drawn; further away they are let go, so a long PDF does not fill a phone's memory
const A4 = Math.SQRT2
const PHONE = 768 // px: the same width the app's phone layout starts below

function letGo(holder: HTMLElement | null) {
  holder?.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0 })
  holder?.replaceChildren()
}

// One page: its place is kept from the start, and it is drawn (with its words laid over it, so they can be selected) once it comes near the view.
// The new drawing replaces the old one only when it is ready, so zooming never flashes blank.
function PdfPage({ doc, n, width, ratio, root }: { doc: PDFDocumentProxy; n: number; width: number; ratio: number; root: RefObject<HTMLDivElement | null> }) {
  const box = useRef<HTMLDivElement>(null)
  const paper = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [own, setOwn] = useState<number | null>(null)

  useEffect(() => {
    if (!box.current) return
    const seen = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { root: root.current, rootMargin: DRAW_AHEAD })
    seen.observe(box.current)
    return () => seen.disconnect()
  }, [root])

  useEffect(() => {
    if (!near || !width) { letGo(paper.current); words.current?.replaceChildren(); return }
    let live = true
    let task: RenderTask | null = null
    let layer: TextLayer | null = null
    void (async () => {
      const pdfjs = await pdfEngine()
      const page = await doc.getPage(n)
      if (!live) return
      const flat = page.getViewport({ scale: 1 })
      const scale = width / flat.width
      setOwn(flat.height / flat.width)
      const view = page.getViewport({ scale })
      const density = pixelsPerPoint(view.width, view.height, window.devicePixelRatio)
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(view.width * density)
      canvas.height = Math.floor(view.height * density)
      canvas.className = 'absolute inset-0 size-full'
      canvas.setAttribute('aria-hidden', 'true')
      task = page.render({ canvas, viewport: page.getViewport({ scale: scale * density }) })
      await task.promise
      if (!live) return
      letGo(paper.current)
      paper.current?.replaceChildren(canvas)
      const text = document.createElement('div')
      text.className = 'pdf-text'
      text.style.setProperty('--total-scale-factor', String(scale))
      layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: view })
      await layer.render()
      if (live) words.current?.replaceChildren(text)
    })().catch(() => {}) // a drawing replaced by a newer one is cancelled; a page that cannot be drawn stays a blank sheet
    return () => { live = false; task?.cancel(); layer?.cancel() }
  }, [doc, n, width, near])

  return (
    <div ref={box} data-page={n} role="group" aria-label={`Page ${n}`} className="relative mx-auto mb-3 overflow-hidden bg-white shadow-sm last:mb-0"
      style={{ width, height: width * (own ?? ratio) }}>
      <div ref={paper} />
      <div ref={words} />
    </div>
  )
}

// A PDF shown inside the app, page by page: the same on a phone as on a computer, where a browser's own PDF viewer is not.
// onExplain adds the Explain button, for the words selected or else the page being read.
export function PdfViewer({ url, name, onExplain, className = 'h-[80dvh] rounded-2xl border border-line' }: {
  url: string; name: string; onExplain?: (part: PdfPart) => void | Promise<void>; className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState<'locked' | 'broken' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [ratio, setRatio] = useState(A4)
  const [fit, setFit] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<{ page: number; text: string; x: number; y: number; below: boolean } | null>(null)
  const [explaining, setExplaining] = useState(false)
  const keepPlace = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    let opening: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> } | null = null
    pdfEngine().then(pdfjs => {
      if (!live) return null
      opening = pdfjs.getDocument({ url })
      return opening.promise
    }).then(async d => {
      if (!d || !live) return
      const flat = (await d.getPage(1)).getViewport({ scale: 1 })
      if (!live) return
      setRatio(flat.height / flat.width)
      setDoc(d)
    }).catch((e: unknown) => { if (live) setFailed((e as { name?: string })?.name === 'PasswordException' ? 'locked' : 'broken') })
    return () => { live = false; void opening?.destroy() }
  }, [url, attempt])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = new ResizeObserver(([e]) => setFit(Math.floor(e.contentRect.width)))
    measure.observe(el)
    return () => measure.disconnect()
  }, [])

  // Words selected in this PDF get the same Explain button as words selected in a note, by the selection: above it on a computer, below on a phone,
  // where the browser's own selection menu is above. It follows the words as they scroll, and goes when they leave the view.
  useEffect(() => {
    if (!onExplain) return
    const place = () => {
      const s = document.getSelection()
      const text = s?.toString().trim() ?? ''
      const node = s?.anchorNode ?? null
      const view = scroller.current
      const from = node && view?.contains(node) ? (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-page]') : null
      if (!s?.rangeCount || !view || !from || text.replace(/\s/g, '').length < MIN_SELECTED) { setPicked(null); return }
      const words = s.getRangeAt(0).getBoundingClientRect()
      const frame = view.getBoundingClientRect()
      if (words.bottom < frame.top || words.top > frame.bottom) { setPicked(null); return }
      const below = window.innerWidth < PHONE
      setPicked({ page: Number(from.dataset.page), text, below, x: Math.min(window.innerWidth - 80, Math.max(80, (words.left + words.right) / 2)), y: below ? words.bottom + 10 : words.top - 10 })
    }
    document.addEventListener('selectionchange', place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('selectionchange', place)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [onExplain])

  // Zooming keeps the student at the same place in the PDF
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && keepPlace.current !== null) el.scrollTop = keepPlace.current * el.scrollHeight
    keepPlace.current = null
  }, [zoom])

  function zoomTo(next: number) {
    const el = scroller.current
    if (el) keepPlace.current = el.scrollTop / Math.max(el.scrollHeight, 1)
    setZoom(Math.min(LARGEST_ZOOM, Math.max(SMALLEST_ZOOM, next)))
  }

  function track() {
    const el = scroller.current
    if (!el) return
    const line = el.scrollTop + el.clientHeight / 3
    let at = 1
    for (const p of el.querySelectorAll<HTMLElement>('[data-page]')) {
      if (p.offsetTop > line) break
      at = Number(p.dataset.page)
    }
    setPage(at)
  }

  async function explainSelection() {
    if (!onExplain || !picked || explaining) return
    setExplaining(true)
    try { await onExplain({ page: picked.page, text: picked.text, picked: true }) } finally { setExplaining(false) }
  }

  async function explainPage() {
    if (!doc || !onExplain || explaining) return
    setExplaining(true)
    try {
      let text = ''
      try {
        const content = await (await doc.getPage(page)).getTextContent()
        text = content.items.map(i => ('str' in i ? i.str : '')).join(' ')
      } catch { /* the tutor still has the file itself */ }
      await onExplain({ page, text, picked: false })
    } finally { setExplaining(false) }
  }

  const width = Math.round(Math.min(fit, WIDEST) * zoom)
  return (
    <div className={`flex flex-col overflow-hidden bg-raised ${className}`}>
      {doc && (
        <div role="toolbar" aria-label={`${name} controls`} className="flex flex-wrap items-center gap-1 border-b border-line bg-bg px-2 py-1.5 text-sm">
          <span className="px-2 tabular-nums text-muted">Page {page} of {doc.numPages}</span>
          <span className="ml-auto flex items-center gap-1">
            <button type="button" className="btn-ghost !px-2" aria-label="Zoom out" disabled={zoom <= SMALLEST_ZOOM} onClick={() => zoomTo(zoom - ZOOM_STEP)}><Minus size={14} aria-hidden /></button>
            <button type="button" className="btn-ghost !px-2 tabular-nums" aria-label="Back to full width" title="Back to full width" onClick={() => zoomTo(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className="btn-ghost !px-2" aria-label="Zoom in" disabled={zoom >= LARGEST_ZOOM} onClick={() => zoomTo(zoom + ZOOM_STEP)}><Plus size={14} aria-hidden /></button>
            {onExplain && (
              <button type="button" className="btn ml-1" disabled={explaining} aria-label="Explain page" title="Ask the tutor to explain this page" onClick={() => { void explainPage() }}>
                {explaining ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <MessagesSquare size={14} aria-hidden />}Explain<span className="-ml-0.5 max-sm:hidden">page</span>
              </button>
            )}
          </span>
        </div>
      )}
      <div ref={scroller} tabIndex={0} role="region" aria-label={name} onScroll={track} className="relative min-h-0 flex-1 overflow-auto overscroll-contain p-2 sm:p-3">
        {failed
          ? <div role="alert" className="grid h-full place-items-center p-6 text-center text-sm text-muted">
              {failed === 'locked'
                ? <p>This PDF is protected by a password, so it can&apos;t be shown here. Download it to open it.</p>
                : <div className="space-y-3"><p>Couldn&apos;t show this PDF. Check your connection.</p><button type="button" className="btn" onClick={() => { setFailed(null); setAttempt(a => a + 1) }}>Try again</button></div>}
            </div>
          : !doc
            ? <Working kind="load" size="sm" label="Opening the PDF" className="p-4 text-sm text-muted" />
            : width > 0 && Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i + 1} doc={doc} n={i + 1} width={width} ratio={ratio} root={scroller} />)}
      </div>
      {picked && createPortal(
        // the press must not clear the selection it is about
        <button type="button" disabled={explaining} onMouseDown={e => e.preventDefault()} onPointerDown={e => { if (e.pointerType !== 'mouse') e.preventDefault() }}
          onClick={() => { void explainSelection() }} aria-label="Ask the tutor to explain the selected text" style={{ left: picked.x, top: picked.y }}
          className={`fixed z-50 inline-flex -translate-x-1/2 ${picked.below ? '' : '-translate-y-full'} items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-raised px-3.5 py-2 text-sm font-medium text-accent shadow-lg transition hover:bg-surface pointer-coarse:py-2.5`}>
          <MessagesSquare size={15} aria-hidden />Explain
        </button>,
        document.body,
      )}
    </div>
  )
}
