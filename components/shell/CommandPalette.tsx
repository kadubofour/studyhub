'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, CornerDownLeft, FileText, Layers, Mic, Search, Sparkles } from 'lucide-react'
import { filterPalette, type PaletteItem } from '@/lib/shell/palette'

const GROUP_ICON = { 'Do': Sparkles, 'Go to': ArrowRight, 'Courses': BookOpen, 'Recent': FileText }
const HINT_ICON: Record<string, typeof FileText> = { Note: FileText, Deck: Layers, Lecture: Mic }

// Search or jump: one box that goes anywhere and does anything. Typing narrows the list; the arrow keys move; Enter runs; Escape closes.
export function CommandPalette({ items, onRun, onClose }: { items: PaletteItem[]; onRun: (item: PaletteItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const shown = useMemo(() => filterPalette(items, query).slice(0, 40), [items, query])
  const list = useRef<HTMLUListElement>(null)
  const at = Math.min(index, Math.max(0, shown.length - 1))
  useEffect(() => { list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView?.({ block: 'nearest' }) }, [at])

  function key(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(Math.min(at + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(Math.max(at - 1, 0)) }
    else if (e.key === 'Enter' && shown[at]) { e.preventDefault(); onRun(shown[at]) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[3px]" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Search or jump" className="glass palette-in w-full max-w-[640px] overflow-hidden rounded-2xl" style={{ background: 'var(--glass-strong)' }}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={18} className="shrink-0 text-muted" aria-hidden />
          <input autoFocus role="combobox" aria-expanded="true" aria-controls="palette-list" aria-label="Search or jump"
            aria-activedescendant={shown[at] ? `palette-${shown[at].id}` : undefined}
            className="h-14 w-full bg-transparent text-[17px] outline-none placeholder:text-muted" placeholder="Search or jump to anything…"
            value={query} onChange={e => { setQuery(e.target.value); setIndex(0) }} onKeyDown={key} />
          <span className="kbd shrink-0 pointer-coarse:hidden">Esc</span>
        </div>
        {shown.length === 0
          ? <p className="px-5 py-10 text-center text-[15px] text-muted">Nothing matches.</p>
          : (
            <ul ref={list} id="palette-list" role="listbox" aria-label="Results" className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
              {shown.map((item, i) => {
                const Icon = (item.hint && HINT_ICON[item.hint]) || GROUP_ICON[item.group]
                const on = i === at
                const head = !query.trim() && (i === 0 || shown[i - 1].group !== item.group)
                return (
                  <li key={item.id} role="presentation">
                    {head && <p aria-hidden className="px-3 pb-1 pt-3 text-xs font-medium text-muted first:pt-1">{item.group}</p>}
                    <div id={`palette-${item.id}`} data-i={i} role="option" aria-selected={on}
                      onMouseMove={() => { if (!on) setIndex(i) }} onClick={() => onRun(item)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${on ? 'bg-accent-soft text-accent' : ''}`}>
                      <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg ${on ? 'bg-raised' : 'bg-surface text-muted'}`}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 text-xs text-muted">{item.hint}</span>}
                      {on && <CornerDownLeft size={15} aria-hidden className="shrink-0" />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        <div aria-hidden className="flex items-center gap-4 border-t border-line px-5 py-2.5 text-xs text-muted pointer-coarse:hidden">
          <span className="flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span>to move</span>
          <span className="flex items-center gap-1.5"><span className="kbd">Enter</span>to open</span>
        </div>
      </div>
    </div>
  )
}
