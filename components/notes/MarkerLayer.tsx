'use client'
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Eraser, Highlighter, Strikethrough, Underline } from 'lucide-react'
import { BTN_SOLID } from '@/components/ui/buttonStyles'
import { HIGHLIGHTS, type HighlightName } from '@/lib/notes/markup'
import { applyMarker, wordRange, type MarkerTool } from './textMarker'

const TOOLS: { key: MarkerTool; label: string; icon: typeof Highlighter }[] = [
  { key: 'highlight', label: 'Highlighter', icon: Highlighter },
  { key: 'underline', label: 'Underline', icon: Underline },
  { key: 'strike', label: 'Strikethrough', icon: Strikethrough },
  { key: 'erase', label: 'Remove markup', icon: Eraser },
]

/**
 * A marker for the words of a note. While it is on, dragging across the text highlights, underlines or strikes it (or takes
 * the markup off), and a click marks the word under it. The marks belong to the words, so they move with them as the note is edited.
 */
export function MarkerLayer({ editor, active, onDone, children }: {
  editor: Editor | null; active: boolean; onDone: () => void; children: React.ReactNode
}) {
  const [tool, setTool] = useState<MarkerTool>('highlight')
  const [color, setColor] = useState<HighlightName>('yellow')
  const anchor = useRef<number | null>(null)
  const head = useRef<number | null>(null)

  // Nothing is typed while marking: the marker only marks
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!active, false)
    return () => { if (!editor.isDestroyed) editor.setEditable(true, false) }
  }, [editor, active])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onDone])

  const at = (e: React.PointerEvent) => editor?.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos ?? null

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || !editor || e.button > 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input')) return
    e.preventDefault() // no native selection, no caret: the marker has the pointer
    const p = at(e)
    anchor.current = head.current = p
    if (p !== null) e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || !editor || anchor.current === null) return
    const p = at(e)
    if (p === null) return
    head.current = p
    editor.commands.setTextSelection({ from: Math.min(anchor.current, p), to: Math.max(anchor.current, p) }) // shows what the drag covers
  }
  const up = () => {
    if (!active || !editor || anchor.current === null) return
    let from = Math.min(anchor.current, head.current ?? anchor.current), to = Math.max(anchor.current, head.current ?? anchor.current)
    if (from === to) {
      const w = wordRange(editor.state.doc, anchor.current)
      if (w) { from = w.from; to = w.to }
    }
    anchor.current = head.current = null
    if (to > from) applyMarker(editor, tool, color, from, to)
    else editor.commands.setTextSelection(to)
  }

  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={active ? 'cursor-crosshair select-none' : undefined} style={active ? { touchAction: 'none' } : undefined} data-marker={active ? 'on' : 'off'}>
      {children}
      {active && (
        <div role="group" aria-label="Mark up the text" className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-fit flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-raised p-2.5 shadow-xl">
          <div className="flex gap-1">
            {TOOLS.map(t => (
              <button key={t.key} type="button" aria-label={t.label} title={t.label} aria-pressed={tool === t.key} onClick={() => setTool(t.key)}
                className={`inline-flex size-9 items-center justify-center rounded-lg transition ${tool === t.key ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                <t.icon size={17} aria-hidden />
              </button>
            ))}
          </div>
          {tool === 'highlight' && (
            <div role="radiogroup" aria-label="Highlight colour" className="flex items-center gap-1.5">
              {HIGHLIGHTS.map(h => (
                <button key={h.name} type="button" role="radio" aria-checked={color === h.name} aria-label={`${h.label} marker`} title={h.label} onClick={() => setColor(h.name)}
                  className={`size-6 rounded-md border transition ${color === h.name ? 'border-fg ring-2 ring-[var(--accent-solid)]' : 'border-black/10 hover:scale-110'}`} style={{ background: h.swatch }} />
              ))}
            </div>
          )}
          <span className="text-xs text-muted">Drag across the words, or click one</span>
          <button type="button" className={BTN_SOLID} onClick={onDone}>Done</button>
        </div>
      )}
    </div>
  )
}
