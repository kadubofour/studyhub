'use client'
import { ArrowUpRight, Circle, Eraser, Highlighter, Minus, PenLine, Redo2, Square, Trash2, Type, Undo2, type LucideIcon } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { COLORS, type SizeKey, type ToolKey } from '@/lib/markup/marks'
import { canRedo, canUndo, clearMarks, redo, undo, type History } from '@/lib/markup/history'

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
// The tools, colours and sizes of the markup tool, shared by drawing on a picture and drawing on a note
export function MarkupToolbar({ tool, setTool, color, setColor, size, setSize, history, setHistory, text, setText, textHint }: {
  tool: ToolKey; setTool: (t: ToolKey) => void; color: string; setColor: (c: string) => void; size: SizeKey; setSize: (s: SizeKey) => void
  history: History; setHistory: (f: (h: History) => History) => void; text: string; setText: (t: string) => void; textHint: string
}) {
  return (
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
        <input value={text} onChange={e => setText(e.target.value)} maxLength={120} placeholder={textHint} className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 py-1.5" />
      </label>
    )}
    </>
  )
}
