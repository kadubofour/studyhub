'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkupToolbar } from './MarkupToolbar'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { COLORS, newId, type Mark, type Pt, type SizeKey, type ToolKey } from '@/lib/markup/marks'
import { addMark, emptyHistory, eraseMark, redo, undo, type History } from '@/lib/markup/history'
import { hitTest } from '@/lib/markup/hit'
import { drawMarks, flatten } from '@/lib/markup/draw'

const BLANK = { width: 1200, height: 800 }
const ERASE_REACH = 10 // screen pixels

/** Where the picture comes from: a link to draw on top of, or nothing for a blank white page */
export type MarkupSource = { url: string } | { blank: true }

// Draw on a picture right where it sits in the note. The marks stay separate until Done, which hands back one flattened picture; Cancel hands back nothing.
export function MarkupPanel(props: { source: MarkupSource; onCancel: () => void; onDone: (picture: Blob) => void | Promise<void> }) {
  return <Editor {...props} />
}

function Editor({ source, onCancel, onDone }: {
  source: MarkupSource; onCancel: () => void; onDone: (picture: Blob) => void | Promise<void>
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
    <div role="group" aria-label="Marking up the picture" className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-3" onKeyDown={e => { keys(e); if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Marking up</span>
        <div className="flex gap-2">
          <button type="button" className={BTN_OUTLINE} onClick={onCancel}>Cancel</button>
          <button type="button" className={BTN_SOLID} onClick={() => void done()} disabled={!loaded || loaded.failed || saving}>{saving ? 'Saving…' : 'Done'}</button>
        </div>
      </div>

      {loaded?.failed ? (
        <p role="alert" className="rounded-lg bg-surface p-4 text-sm text-muted">That picture could not be opened for markup. Close this and try again.</p>
      ) : (
        <>
          <MarkupToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
            history={history} setHistory={setHistory} text={text} setText={setText} textHint="Type, then click the picture" />
          <div className="rounded-lg border border-line bg-surface p-2">
            {loaded ? (
              <canvas ref={canvasRef} width={loaded.width} height={loaded.height} aria-label="Picture being marked up" role="img"
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                className="mx-auto block h-auto w-auto max-w-full touch-none bg-white" style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }} />
            ) : <p className="p-6 text-sm text-muted">Opening the picture…</p>}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
