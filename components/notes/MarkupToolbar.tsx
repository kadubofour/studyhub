'use client'
import { CircleX, Eraser, Highlighter, MoreHorizontal, Paintbrush, Pencil, PenLine, PenTool, Redo2, Trash2, Undo2 } from 'lucide-react'
import { BRUSHES, COLORS, MAX_WIDTH, MIN_WIDTH, type BrushKind, type ToolKey } from '@/lib/markup/marks'
import { canRedo, canUndo, clearMarks, redo, undo, type History } from '@/lib/markup/history'

const ICONS: Record<BrushKind, typeof PenLine> = { pen: PenLine, pencil: Pencil, marker: Paintbrush, highlighter: Highlighter, calligraphy: PenTool, dotted: MoreHorizontal }
const ERASERS: { key: ToolKey; label: string; icon: typeof Eraser }[] = [
  { key: 'rubber', label: 'Rub out', icon: Eraser },
  { key: 'eraser', label: 'Erase whole stroke', icon: CircleX },
]
const toolButton = (on: boolean) => `inline-flex size-9 items-center justify-center rounded-lg transition ${on ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`
const iconButton = 'inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-40'

// The drawing tools: brushes, two erasers, a colour, a thickness anywhere from fine to broad, and undo, redo and clear
export function MarkupToolbar({ tool, setTool, color, setColor, width, setWidth, history, setHistory, children }: {
  tool: ToolKey; setTool: (t: ToolKey) => void; color: string; setColor: (c: string) => void; width: number; setWidth: (w: number) => void
  history: History; setHistory: (f: (h: History) => History) => void; children?: React.ReactNode
}) {
  const erasing = tool === 'rubber' || tool === 'eraser'
  return (
    <div role="toolbar" aria-label="Drawing tools" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Brushes" className="flex gap-1">
        {BRUSHES.map(b => {
          const Icon = ICONS[b.key]
          return <button key={b.key} type="button" aria-label={b.label} title={b.label} aria-pressed={tool === b.key} onClick={() => setTool(b.key)} className={toolButton(tool === b.key)}><Icon size={17} aria-hidden /></button>
        })}
      </div>
      <div role="group" aria-label="Erasers" className="flex gap-1">
        {ERASERS.map(t => <button key={t.key} type="button" aria-label={t.label} title={t.label} aria-pressed={tool === t.key} onClick={() => setTool(t.key)} className={toolButton(tool === t.key)}><t.icon size={17} aria-hidden /></button>)}
      </div>
      {!erasing && (
        <div role="radiogroup" aria-label="Colour" className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button key={c.value} type="button" role="radio" aria-checked={color === c.value} aria-label={c.name} title={c.name} onClick={() => setColor(c.value)}
              className={`size-7 rounded-full border-2 transition pointer-coarse:size-9 ${color === c.value ? 'border-fg ring-2 ring-[var(--accent-solid)] ring-offset-1 ring-offset-raised' : 'border-transparent hover:scale-110'}`} style={{ background: c.value }} />
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">{tool === 'rubber' ? 'Rubber size' : 'Thickness'}</span>
        <input type="range" min={MIN_WIDTH} max={MAX_WIDTH} step={0.5} value={width} onChange={e => setWidth(Number(e.target.value))} className="w-28 accent-[var(--accent-solid)]" />
        <output className="w-7 text-xs tabular-nums text-muted">{width}</output>
      </label>
      <div className="flex gap-1">
        <button type="button" aria-label="Undo" title="Undo" disabled={!canUndo(history)} onClick={() => setHistory(undo)} className={iconButton}><Undo2 size={17} aria-hidden /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!canRedo(history)} onClick={() => setHistory(redo)} className={iconButton}><Redo2 size={17} aria-hidden /></button>
        <button type="button" aria-label="Clear all" title="Clear all" disabled={!history.marks.length} onClick={() => setHistory(clearMarks)} className={`${iconButton} hover:text-danger`}><Trash2 size={17} aria-hidden /></button>
      </div>
      {children}
    </div>
  )
}
