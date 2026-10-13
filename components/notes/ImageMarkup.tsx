'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, Circle, Eraser, Highlighter, Minus, PenLine, Redo2, Square, Trash2, Type, Undo2, type LucideIcon } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { COLORS, newId, type Mark, type Pt, type SizeKey, type ToolKey } from '@/lib/markup/marks'
import { addMark, canRedo, canUndo, clearMarks, emptyHistory, eraseMark, redo, undo, type History } from '@/lib/markup/history'
import { hitTest } from '@/lib/markup/hit'
import { drawMarks, flatten } from '@/lib/markup/draw'

const TOOLS: { key: ToolKey; label: string; icon: LucideIcon }[] = [
  { key: 'pen', label: 'Pen', icon: PenLine },
  { key: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { key: 'line', label: 'Line', icon: Minus },
  { key: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { key: 'rect', label: 'Rectangle', icon: Square },
  { key: 'ellipse', label: 'Ellipse', icon: Circle },
  { key: 'text', label: 'Text', icon: Type },
  { key: 'eraser', label: 'Eraser', icon: Eraser },
]
const BLANK = { width: 1200, height: 800 }
const ERASE_REACH = 10 // screen pixels

/** Where the picture comes from: a link to draw on top of, or nothing for a blank white page */
export type MarkupSource = { url: string } | { blank: true }

// Draw on a picture, or on a blank page. The marks stay separate until Done, which hands back one flattened picture; Cancel hands back nothing.
export function ImageMarkup({ open, title, source, onCancel, onDone }: {
  open: boolean; title: string; source: MarkupSource; onCancel: () => void; onDone: (picture: Blob) => void | Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onCancel} aria-labelledby={titleId}
      className="m-auto flex max-h-[94vh] w-[min(96vw,1100px)] flex-col rounded-xl border border-line bg-bg p-4 text-fg backdrop:bg-black/50 open:flex">
      {open && <Editor key={'url' in source ? source.url : 'blank'} titleId={titleId} title={title} source={source} onCancel={onCancel} onDone={onDone} />}
    </dialog>
  )
}

function Editor({ titleId, title, source, onCancel, onDone }: {
  titleId: string; title: string; source: MarkupSource; onCancel: () => void; onDone: (picture: Blob) => void | Promise<void>
}) {
  const blank = 'blank' in source
  const url = 'url' in source ? source.url : null
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState<{ img: HTMLImageElement | null; width: number; height: number; failed: boolean } | null>(blank ? { img: null, ...BLANK, failed: false } : null)
  const [history, setHistory] = useState<History>(emptyHistory)
  const [draft, setDraft] = useState<Mark | null>(null)
  const [tool, setTool] = useState<ToolKey>('pen')
  const [color, setColor] = useState<string>(COLORS[1].value)
  const [size, setSize] = useState<SizeKey>('M')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The picture is loaded once; the canvas is drawn at the picture's own size and scaled down to fit by CSS
  useEffect(() => {
    if (!url) return
    let live = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { if (live) setLoaded({ img, width: img.naturalWidth, height: img.naturalHeight, failed: false }) }
    img.onerror = () => { if (live) setLoaded({ img: null, ...BLANK, failed: true }) }
    img.src = url
    return () => { live = false }
  }, [url])

  useEffect(() => {
    const c = canvasRef.current, ctx = c?.getContext('2d')
    if (!c || !ctx || !loaded || loaded.failed) return
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, loaded.width, loaded.height)
    if (loaded.img) ctx.drawImage(loaded.img, 0, 0, loaded.width, loaded.height)
    drawMarks(ctx, draft ? [...history.marks, draft] : history.marks, loaded.width)
  }, [loaded, history.marks, draft])

  const pointOf = useCallback((e: React.PointerEvent): Pt => {
    const r = e.currentTarget.getBoundingClientRect()
    const w = loaded?.width ?? 1, h = loaded?.height ?? 1
    return [((e.clientX - r.left) / (r.width || w)) * w, ((e.clientY - r.top) / (r.height || h)) * h]
  }, [loaded])
  // How many picture pixels one screen pixel covers: keeps the eraser's reach the same size on screen
  const scaleOf = (e: React.PointerEvent) => (loaded ? loaded.width / (e.currentTarget.getBoundingClientRect().width || loaded.width) : 1)

  const eraseAt = (e: React.PointerEvent) => {
    if (!loaded) return
    const id = hitTest(history.marks, pointOf(e), loaded.width, ERASE_REACH * scaleOf(e))
    if (id) setHistory(h => eraseMark(h, id))
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!loaded || loaded.failed) return
    e.preventDefault()
    const p = pointOf(e)
    if (tool === 'eraser') { e.currentTarget.setPointerCapture?.(e.pointerId); eraseAt(e); setDraft(null); return }
    if (tool === 'text') {
      const t = text.trim()
      if (t) { setHistory(h => addMark(h, { id: newId(), kind: 'text', color, size, at: p, text: t })); setText('') }
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDraft(tool === 'pen' || tool === 'highlighter' ? { id: newId(), kind: tool, color, size, points: [p] } : { id: newId(), kind: tool, color, size, from: p, to: p })
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'eraser') { if (e.buttons) eraseAt(e); return }
    if (!draft) return
    const p = pointOf(e)
    setDraft(d => (!d ? d : d.kind === 'pen' || d.kind === 'highlighter' ? { ...d, points: [...d.points, p] } : d.kind === 'text' ? d : { ...d, to: p }))
  }
  const up = () => {
    if (!draft) return
    const d = draft
    setDraft(null)
    const tiny = 'from' in d && Math.hypot(d.to[0] - d.from[0], d.to[1] - d.from[1]) < 3
    if (!tiny) setHistory(h => addMark(h, d))
  }

  const done = async () => {
    if (!loaded || loaded.failed || saving) return
    setSaving(true); setError('')
    try { await onDone(await flatten(loaded.img, loaded.width, loaded.height, history.marks)) } catch { setError('Couldn\'t save that. Try again.'); setSaving(false) }
  }

  const keys = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
    e.preventDefault()
    setHistory(h => (e.shiftKey ? redo(h) : undo(h)))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" onKeyDown={keys}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-medium">{title}</h2>
        <div className="flex gap-2">
          <button type="button" className={BTN_OUTLINE} onClick={onCancel}>Cancel</button>
          <button type="button" className={BTN_SOLID} onClick={() => void done()} disabled={!loaded || loaded.failed || saving}>{saving ? 'Saving…' : 'Done'}</button>
        </div>
      </div>

      {loaded?.failed ? (
        <p role="alert" className="rounded-lg bg-surface p-4 text-sm text-muted">That picture could not be opened for markup. Close this and try again.</p>
      ) : (
        <>
          <div role="toolbar" aria-label="Markup tools" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex gap-1">
              {TOOLS.map(t => (
                <button key={t.key} type="button" aria-label={t.label} aria-pressed={tool === t.key} title={t.label} onClick={() => setTool(t.key)}
                  className={`inline-flex size-9 items-center justify-center rounded-lg transition ${tool === t.key ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                  <t.icon size={17} aria-hidden />
                </button>
              ))}
            </div>
            <ChoiceChips label="Colour" size="sm" value={color} onChange={setColor} options={COLORS.map(c => ({ value: c.value, label: c.name, color: c.value }))} />
            <ChoiceChips label="Size" size="sm" value={size} onChange={v => setSize(v as SizeKey)} options={[{ value: 'S', label: 'Thin' }, { value: 'M', label: 'Medium' }, { value: 'L', label: 'Thick' }]} />
            <div className="flex gap-1">
              <button type="button" aria-label="Undo" title="Undo" disabled={!canUndo(history)} onClick={() => setHistory(undo)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-40"><Undo2 size={17} aria-hidden /></button>
              <button type="button" aria-label="Redo" title="Redo" disabled={!canRedo(history)} onClick={() => setHistory(redo)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-40"><Redo2 size={17} aria-hidden /></button>
              <button type="button" aria-label="Clear all" title="Clear all" disabled={!history.marks.length} onClick={() => setHistory(clearMarks)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger disabled:opacity-40"><Trash2 size={17} aria-hidden /></button>
            </div>
          </div>
          {tool === 'text' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Text to place</span>
              <input value={text} onChange={e => setText(e.target.value)} maxLength={120} placeholder="Type, then click the picture" className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 py-1.5" />
            </label>
          )}
          <div role="group" aria-label="Drawing area" tabIndex={0} className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-surface p-2">
            {loaded ? (
              <canvas ref={canvasRef} width={loaded.width} height={loaded.height} aria-label="Picture being marked up" role="img"
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                className="mx-auto block h-auto max-h-[62vh] w-auto max-w-full touch-none bg-white" style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }} />
            ) : <p className="p-6 text-sm text-muted">Opening the picture…</p>}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
