'use client'
import { useEffect, useRef, useState } from 'react'
import { MarkupToolbar } from './MarkupToolbar'
import { BTN_SOLID } from '@/components/ui/buttonStyles'
import { COLORS, newId, type Mark, type Pt, type SizeKey, type ToolKey } from '@/lib/markup/marks'
import { addMark, emptyHistory, eraseMark, redo, undo, type History } from '@/lib/markup/history'
import { hitTest } from '@/lib/markup/hit'
import { INK_TEXT_BASIS, INK_WIDTH, drawInk, inkPerPixel } from '@/lib/markup/ink'

const ERASE_REACH = 10 // screen pixels

// A stroke keeps only points a little apart: a long note full of ink stays small enough to save quickly
function thin(points: Pt[]): Pt[] {
  const out: Pt[] = [points[0]]
  for (const p of points.slice(1, -1)) {
    const last = out[out.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) out.push(p)
  }
  if (points.length > 1) out.push(points[points.length - 1])
  return out
}

/**
 * Pen, highlighter, shapes and text drawn straight onto a note. The layer covers the note's content (its parent must be
 * `relative`) and scrolls with it. While `active` it takes the pointer and shows its tools; otherwise it only shows what was drawn.
 */
export function InkLayer({ marks, active, onChange, onDone }: {
  marks: Mark[]; active: boolean; onChange?: (marks: Mark[]) => void; onDone?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [history, setHistory] = useState<History>(() => ({ ...emptyHistory(), marks }))
  const [draft, setDraft] = useState<Mark | null>(null)
  const [tool, setTool] = useState<ToolKey>('pen')
  const [color, setColor] = useState<string>(COLORS[1].value)
  const [size, setSize] = useState<SizeKey>('M')
  const [text, setText] = useState('')
  const [box, setBox] = useState({ w: 0, h: 0 })
  const sent = useRef(marks)

  // Every change to the drawing goes to the note, which saves it
  useEffect(() => {
    if (history.marks === sent.current) return
    sent.current = history.marks
    onChange?.(history.marks)
  }, [history.marks, onChange])

  // The layer is as big as the note's content, and keeps up as the note grows
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const measure = () => setBox({ w: c.clientWidth, h: c.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = canvasRef.current, ctx = c?.getContext('2d')
    if (!c || !ctx || !box.w || !box.h) return
    const ratio = window.devicePixelRatio || 1
    c.width = Math.round(box.w * ratio); c.height = Math.round(box.h * ratio)
    drawInk(ctx, draft ? [...history.marks, draft] : history.marks, box.w, ratio)
  }, [box, history.marks, draft])

  // Ctrl+Z / Ctrl+Shift+Z and Escape while drawing
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); setHistory(h => (e.shiftKey ? redo(h) : undo(h)))
      } else if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) onDone?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onDone])

  const pointOf = (e: React.PointerEvent): Pt => {
    const r = e.currentTarget.getBoundingClientRect()
    const k = INK_WIDTH / (r.width || INK_WIDTH)
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]
  }
  const eraseAt = (e: React.PointerEvent) => {
    const id = hitTest(history.marks, pointOf(e), INK_TEXT_BASIS, ERASE_REACH * inkPerPixel(e.currentTarget.getBoundingClientRect().width))
    if (id) setHistory(h => eraseMark(h, id))
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    e.preventDefault()
    const p = pointOf(e)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (tool === 'eraser') { eraseAt(e); return }
    if (tool === 'text') {
      const t = text.trim()
      if (t) { setHistory(h => addMark(h, { id: newId(), kind: 'text', color, size, at: p, text: t })); setText('') }
      return
    }
    setDraft(tool === 'pen' || tool === 'highlighter' ? { id: newId(), kind: tool, color, size, points: [p] } : { id: newId(), kind: tool, color, size, from: p, to: p })
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    if (tool === 'eraser') { if (e.buttons) eraseAt(e); return }
    if (!draft) return
    const p = pointOf(e)
    setDraft(d => (!d ? d : d.kind === 'pen' || d.kind === 'highlighter' ? { ...d, points: [...d.points, p] } : d.kind === 'text' ? d : { ...d, to: p }))
  }
  const up = () => {
    if (!draft) return
    const d = draft
    setDraft(null)
    const kept: Mark = d.kind === 'pen' || d.kind === 'highlighter' ? { ...d, points: thin(d.points) } : d
    const tiny = 'from' in d && Math.hypot(d.to[0] - d.from[0], d.to[1] - d.from[1]) < 4
    if (!tiny) setHistory(h => addMark(h, kept))
  }

  return (
    <>
      <canvas ref={canvasRef} aria-hidden={!active} data-ink data-active={active ? 'true' : 'false'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className={`absolute inset-0 z-10 h-full w-full ${active ? 'touch-none' : 'pointer-events-none'}`}
        style={{ cursor: !active ? undefined : tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }} />
      {active && (
        <div role="group" aria-label="Draw on the note" className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-fit flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-raised p-2.5 shadow-xl">
          <MarkupToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
            history={history} setHistory={setHistory} text={text} setText={setText} textHint="Type, then click the note" />
          <button type="button" className={BTN_SOLID} onClick={() => onDone?.()}>Done</button>
        </div>
      )}
    </>
  )
}
