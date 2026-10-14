'use client'
import { useEffect, useRef, useState } from 'react'
import { MarkupToolbar } from './MarkupToolbar'
import { BTN_SOLID } from '@/components/ui/buttonStyles'
import { COLORS, DEFAULT_WIDTH, isBrush, newId, type Mark, type Pt, type ToolKey } from '@/lib/markup/marks'
import { addMark, emptyHistory, eraseMark, redo, replaceMarks, undo, type History } from '@/lib/markup/history'
import { hitTest } from '@/lib/markup/hit'
import { rubOut, rubberRadius } from '@/lib/markup/rub'
import { INK_WIDTH, drawInk, inkPerPixel } from '@/lib/markup/ink'

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
 * Freehand drawing straight onto a note, with a choice of brushes, any thickness, and two erasers. The layer covers the
 * note's content (its parent must be `relative`) and scrolls with it. While `active` it takes the pointer and shows its
 * tools; otherwise it only shows what was drawn.
 */
export function InkLayer({ marks, active, onChange, onDone }: {
  marks: Mark[]; active: boolean; onChange?: (marks: Mark[]) => void; onDone?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [history, setHistory] = useState<History>(() => ({ ...emptyHistory(), marks }))
  const [draft, setDraft] = useState<Mark | null>(null)
  // What a rub-out gesture has left so far: shown while the pointer is down, and put in the history as one step when it lifts
  const [rubbed, setRubbed] = useState<Mark[] | null>(null)
  const rubbedNow = useRef<Mark[] | null>(null)
  const [tool, setTool] = useState<ToolKey>('pen')
  const [color, setColor] = useState<string>(COLORS[1].value)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
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
    const base = rubbed ?? history.marks
    drawInk(ctx, draft ? [...base, draft] : base, box.w, ratio)
  }, [box, history.marks, draft, rubbed])

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
    const id = hitTest(history.marks, pointOf(e), ERASE_REACH * inkPerPixel(e.currentTarget.getBoundingClientRect().width))
    if (id) setHistory(h => eraseMark(h, id))
  }
  const rubAt = (e: React.PointerEvent) => {
    const next = rubOut(rubbedNow.current ?? history.marks, pointOf(e), rubberRadius(width))
    if (next !== (rubbedNow.current ?? history.marks)) { rubbedNow.current = next; setRubbed(next) }
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (tool === 'eraser') { eraseAt(e); return }
    if (tool === 'rubber') { rubbedNow.current = null; rubAt(e); return }
    if (isBrush(tool)) setDraft({ id: newId(), brush: tool, color, width, points: [pointOf(e)] })
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    if (tool === 'eraser') { if (e.buttons) eraseAt(e); return }
    if (tool === 'rubber') { if (e.buttons) rubAt(e); return }
    if (!draft) return
    const p = pointOf(e)
    setDraft(d => (d ? { ...d, points: [...d.points, p] } : d))
  }
  const up = () => {
    if (rubbedNow.current) {
      const result = rubbedNow.current
      rubbedNow.current = null
      setRubbed(null)
      setHistory(h => replaceMarks(h, result))
    }
    if (!draft) return
    const d = draft
    setDraft(null)
    setHistory(h => addMark(h, { ...d, points: thin(d.points) }))
  }

  return (
    <>
      <canvas ref={canvasRef} aria-hidden={!active} data-ink data-active={active ? 'true' : 'false'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className={`absolute inset-0 z-10 h-full w-full ${active ? 'touch-none' : 'pointer-events-none'}`}
        style={{ cursor: !active ? undefined : tool === 'eraser' || tool === 'rubber' ? 'cell' : 'crosshair' }} />
      {active && (
        <div role="group" aria-label="Draw on the note" className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 mx-auto w-fit max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-raised p-2.5 shadow-xl">
          <MarkupToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} width={width} setWidth={setWidth}
            history={history} setHistory={setHistory}>
            <button type="button" className={`${BTN_SOLID} ml-auto`} onClick={() => onDone?.()}>Done</button>
          </MarkupToolbar>
        </div>
      )}
    </>
  )
}
