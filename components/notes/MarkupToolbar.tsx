'use client'
import { Eraser, PenLine, Redo2, Trash2, Undo2 } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { COLORS, type SizeKey, type ToolKey } from '@/lib/markup/marks'
import { canRedo, canUndo, clearMarks, redo, undo, type History } from '@/lib/markup/history'

const TOOLS: { key: ToolKey; label: string; icon: typeof PenLine }[] = [
  { key: 'pen', label: 'Pen', icon: PenLine },
  { key: 'eraser', label: 'Eraser', icon: Eraser },
]
const iconButton = 'inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-40'

// The freehand pen's controls: pen or eraser, a colour, a thickness, and undo, redo and clear
export function MarkupToolbar({ tool, setTool, color, setColor, size, setSize, history, setHistory }: {
  tool: ToolKey; setTool: (t: ToolKey) => void; color: string; setColor: (c: string) => void; size: SizeKey; setSize: (s: SizeKey) => void
  history: History; setHistory: (f: (h: History) => History) => void
}) {
  return (
    <div role="toolbar" aria-label="Drawing tools" className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
        <button type="button" aria-label="Undo" title="Undo" disabled={!canUndo(history)} onClick={() => setHistory(undo)} className={iconButton}><Undo2 size={17} aria-hidden /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!canRedo(history)} onClick={() => setHistory(redo)} className={iconButton}><Redo2 size={17} aria-hidden /></button>
        <button type="button" aria-label="Clear all" title="Clear all" disabled={!history.marks.length} onClick={() => setHistory(clearMarks)} className={`${iconButton} hover:text-danger`}><Trash2 size={17} aria-hidden /></button>
      </div>
    </div>
  )
}
