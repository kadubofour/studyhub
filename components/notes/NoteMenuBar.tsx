'use client'
import { useEffect, useRef, useState } from 'react'
import {
  BookOpen, Check, ChevronRight, FilePlus2, FileText, FileType2, FileUp, MoveHorizontal, PenLine, Redo2,
  Search, Sigma, SquareCode, Table, TextSelect, Trash2, Undo2, type LucideIcon,
} from 'lucide-react'
import type { EditorMode } from '@/lib/types'
import { TableGridPicker } from './TableGridPicker'

export interface NoteMenuActions {
  newNote: () => void; importNote: () => void; exportWord: () => void; exportPdf: () => void; deleteNote: () => void
  undo: () => void; redo: () => void; selectAll: () => void; find: () => void
  insertTable: (rows: number, cols: number) => void; insertEquation: () => void
  setMode: (m: EditorMode) => void; toggleReading: () => void; toggleFullWidth: () => void
}

type Entry =
  | { kind: 'item' | 'radio' | 'check' | 'table'; label: string; icon: LucideIcon; shortcut?: string; checked?: boolean; danger?: boolean; disabled?: boolean; run: () => void }
  | { kind: 'sep' }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`)

// Word-style File / Edit / View menu bar for a note, following the ARIA menubar pattern:
// one menu title in the Tab order, arrows move between titles and items, Esc closes.
export function NoteMenuBar({ actions: a, mode, reading, fullWidth }: {
  actions: NoteMenuActions; mode: EditorMode; reading: boolean; fullWidth: boolean
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [gridOpen, setGridOpen] = useState(false) // Edit > Insert table's size grid
  const [active, setActive] = useState(0) // which title is in the Tab order
  const bar = useRef<HTMLDivElement>(null)
  const titles = useRef<(HTMLButtonElement | null)[]>([])
  const tableItem = useRef<HTMLButtonElement>(null)
  const focusItemOnOpen = useRef<'first' | 'last' | null>(null)

  const menus: { name: string; items: Entry[] }[] = [
    { name: 'File', items: [
      { kind: 'item', label: 'New note', icon: FilePlus2, run: a.newNote },
      { kind: 'item', label: 'Import…', icon: FileUp, run: a.importNote },
      { kind: 'sep' },
      { kind: 'item', label: 'Export as Word', icon: FileText, run: a.exportWord },
      { kind: 'item', label: 'Export as PDF', icon: FileType2, run: a.exportPdf },
      { kind: 'sep' },
      { kind: 'item', label: 'Delete note', icon: Trash2, danger: true, run: a.deleteNote },
    ] },
    { name: 'Edit', items: [
      { kind: 'item', label: 'Undo', icon: Undo2, shortcut: mod('Z'), disabled: reading, run: a.undo },
      { kind: 'item', label: 'Redo', icon: Redo2, shortcut: isMac ? '⇧⌘Z' : 'Ctrl+Y', disabled: reading, run: a.redo },
      { kind: 'sep' },
      { kind: 'item', label: 'Select all', icon: TextSelect, shortcut: mod('A'), run: a.selectAll },
      { kind: 'item', label: 'Find…', icon: Search, shortcut: mod('F'), run: a.find },
      { kind: 'sep' },
      { kind: 'table', label: 'Insert table', icon: Table, disabled: reading, run: () => setGridOpen(g => !g) },
      { kind: 'item', label: 'Insert equation', icon: Sigma, disabled: reading, run: a.insertEquation },
    ] },
    { name: 'View', items: [
      { kind: 'radio', label: 'Rich editor', icon: PenLine, checked: mode === 'rich', run: () => a.setMode('rich') },
      { kind: 'radio', label: 'Markdown editor', icon: SquareCode, checked: mode === 'markdown', run: () => a.setMode('markdown') },
      { kind: 'sep' },
      { kind: 'check', label: 'Reading mode', icon: BookOpen, checked: reading, run: a.toggleReading },
      { kind: 'check', label: 'Full width', icon: MoveHorizontal, checked: fullWidth, run: a.toggleFullWidth },
    ] },
  ]

  const itemsOf = (i: number) => Array.from(bar.current?.querySelectorAll<HTMLElement>(`[data-menu="${i}"] [role="menu"] [role^="menuitem"]:not([aria-disabled="true"])`) ?? [])

  useEffect(() => {
    if (open === null) return
    const where = focusItemOnOpen.current
    focusItemOnOpen.current = null
    if (where) { const items = itemsOf(open); (where === 'first' ? items[0] : items[items.length - 1])?.focus() }
    const close = (e: MouseEvent) => { if (!bar.current?.contains(e.target as Node)) { setOpen(null); setGridOpen(false) } }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function openMenu(i: number, focus: 'first' | 'last' | null) {
    focusItemOnOpen.current = focus
    setGridOpen(false); setActive(i); setOpen(i)
  }
  function closeMenu(focusTitle: boolean) {
    const i = open ?? active
    setOpen(null); setGridOpen(false)
    if (focusTitle) titles.current[i]?.focus()
  }
  const step = (i: number, d: number) => (i + d + menus.length) % menus.length

  function onTitleKey(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const to = step(i, e.key === 'ArrowRight' ? 1 : -1)
      setActive(to); titles.current[to]?.focus()
      if (open !== null) openMenu(to, null)
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); openMenu(i, 'first')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); openMenu(i, 'last')
    } else if (e.key === 'Escape' && open !== null) {
      e.preventDefault(); closeMenu(true)
    }
  }

  function onItemKey(e: React.KeyboardEvent, i: number, entry: Extract<Entry, { run: () => void }>) {
    const items = itemsOf(i)
    const at = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => { e.preventDefault(); setGridOpen(false); items[(n + items.length) % items.length]?.focus() }
    switch (e.key) {
      case 'ArrowDown': return go(at + 1)
      case 'ArrowUp': return go(at - 1)
      case 'Home': return go(0)
      case 'End': return go(items.length - 1)
      case 'ArrowRight': case 'ArrowLeft': {
        e.preventDefault()
        // Right on "Insert table" opens its size grid, like a submenu
        if (entry.kind === 'table' && e.key === 'ArrowRight' && !entry.disabled) { setGridOpen(true); return }
        const to = step(i, e.key === 'ArrowRight' ? 1 : -1)
        titles.current[to]?.focus(); openMenu(to, 'first'); return
      }
      case 'Escape': e.preventDefault(); closeMenu(true); return
      case 'Tab': setOpen(null); setGridOpen(false); return
    }
  }

  function choose(entry: Extract<Entry, { run: () => void }>) {
    if (entry.disabled) return
    if (entry.kind !== 'table') setOpen(null)
    entry.run()
  }

  return (
    <div ref={bar} role="menubar" aria-label="Note menu" className="flex items-center gap-0.5">
      {menus.map((m, i) => (
        <div key={m.name} className="relative" data-menu={i}>
          <button ref={el => { titles.current[i] = el }} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open === i}
            tabIndex={i === active ? 0 : -1}
            className={`rounded-xl px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-soft ${open === i ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}
            onClick={() => (open === i ? closeMenu(false) : openMenu(i, null))}
            onMouseEnter={() => { if (open !== null && open !== i) openMenu(i, null) }}
            onKeyDown={e => onTitleKey(e, i)}>
            {m.name}
          </button>
          {open === i && (
            <div role="menu" aria-label={m.name} className="menu-panel left-0">
              {m.items.map((entry, k) => entry.kind === 'sep' ? (
                <div key={k} role="separator" className="menu-sep" />
              ) : (
                <div key={entry.label}>
                  <button ref={entry.kind === 'table' ? tableItem : undefined} type="button" tabIndex={-1}
                    role={entry.kind === 'radio' ? 'menuitemradio' : entry.kind === 'check' ? 'menuitemcheckbox' : 'menuitem'}
                    aria-checked={entry.kind === 'radio' || entry.kind === 'check' ? !!entry.checked : undefined}
                    aria-haspopup={entry.kind === 'table' ? 'true' : undefined}
                    aria-expanded={entry.kind === 'table' ? gridOpen : undefined}
                    aria-disabled={entry.disabled || undefined}
                    className={`menu-item ${entry.danger ? 'danger' : ''} ${entry.kind === 'table' && gridOpen ? 'bg-accent-soft text-accent' : ''}`}
                    onClick={() => choose(entry)} onKeyDown={e => onItemKey(e, i, entry)}>
                    <span className="menu-icon"><entry.icon size={15} aria-hidden /></span>
                    <span className="flex-1">{entry.label}</span>
                    {entry.shortcut && <kbd className="menu-kbd">{entry.shortcut}</kbd>}
                    {(entry.kind === 'radio' || entry.kind === 'check') && entry.checked && <Check size={15} className="ml-auto mr-1 text-accent" aria-hidden />}
                    {entry.kind === 'table' && <ChevronRight size={15} className={`ml-auto mr-1 text-muted transition-transform ${gridOpen ? 'rotate-90' : ''}`} aria-hidden />}
                  </button>
                  {entry.kind === 'table' && gridOpen && (
                    <div className="mx-1 mb-1 mt-0.5 flex justify-center rounded-xl bg-surface">
                      <TableGridPicker autoFocus
                        onPick={(r, c) => { setOpen(null); setGridOpen(false); a.insertTable(r, c) }}
                        onCancel={() => { setGridOpen(false); tableItem.current?.focus() }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
