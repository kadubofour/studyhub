'use client'
import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { EditorMode } from '@/lib/types'

export interface NoteMenuActions {
  newNote: () => void; importNote: () => void; exportWord: () => void; exportPdf: () => void; deleteNote: () => void
  undo: () => void; redo: () => void; selectAll: () => void; find: () => void; insertTable: () => void; insertEquation: () => void
  setMode: (m: EditorMode) => void; toggleReading: () => void; toggleFullWidth: () => void
}

type Entry =
  | { kind: 'item' | 'radio' | 'check'; label: string; shortcut?: string; checked?: boolean; danger?: boolean; disabled?: boolean; run: () => void }
  | { kind: 'sep' }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`)

// Word-style File / Edit / View menu bar for a note, following the ARIA menubar pattern:
// one menu title in the Tab order, arrows move between titles and items, Esc closes.
export function NoteMenuBar({ actions: a, mode, reading, fullWidth }: {
  actions: NoteMenuActions; mode: EditorMode; reading: boolean; fullWidth: boolean
}) {
  const menus: { name: string; items: Entry[] }[] = [
    { name: 'File', items: [
      { kind: 'item', label: 'New note', run: a.newNote },
      { kind: 'item', label: 'Import…', run: a.importNote },
      { kind: 'sep' },
      { kind: 'item', label: 'Export as Word', run: a.exportWord },
      { kind: 'item', label: 'Export as PDF', run: a.exportPdf },
      { kind: 'sep' },
      { kind: 'item', label: 'Delete note', danger: true, run: a.deleteNote },
    ] },
    { name: 'Edit', items: [
      { kind: 'item', label: 'Undo', shortcut: mod('Z'), disabled: reading, run: a.undo },
      { kind: 'item', label: 'Redo', shortcut: isMac ? '⇧⌘Z' : 'Ctrl+Y', disabled: reading, run: a.redo },
      { kind: 'sep' },
      { kind: 'item', label: 'Select all', shortcut: mod('A'), run: a.selectAll },
      { kind: 'item', label: 'Find…', shortcut: mod('F'), run: a.find },
      { kind: 'sep' },
      { kind: 'item', label: 'Insert table', disabled: reading, run: a.insertTable },
      { kind: 'item', label: 'Insert equation', disabled: reading, run: a.insertEquation },
    ] },
    { name: 'View', items: [
      { kind: 'radio', label: 'Rich editor', checked: mode === 'rich', run: () => a.setMode('rich') },
      { kind: 'radio', label: 'Markdown editor', checked: mode === 'markdown', run: () => a.setMode('markdown') },
      { kind: 'sep' },
      { kind: 'check', label: 'Reading mode', checked: reading, run: a.toggleReading },
      { kind: 'check', label: 'Full width', checked: fullWidth, run: a.toggleFullWidth },
    ] },
  ]

  const [open, setOpen] = useState<number | null>(null)
  const [active, setActive] = useState(0) // which title is in the Tab order
  const bar = useRef<HTMLDivElement>(null)
  const titles = useRef<(HTMLButtonElement | null)[]>([])
  const focusItemOnOpen = useRef<'first' | 'last' | null>(null)

  const itemsOf = (i: number) => Array.from(bar.current?.querySelectorAll<HTMLElement>(`[data-menu="${i}"] [role="menu"] [role^="menuitem"]:not([aria-disabled="true"])`) ?? [])

  useEffect(() => {
    if (open === null) return
    const where = focusItemOnOpen.current
    focusItemOnOpen.current = null
    if (where) { const items = itemsOf(open); (where === 'first' ? items[0] : items[items.length - 1])?.focus() }
    const close = (e: MouseEvent) => { if (!bar.current?.contains(e.target as Node)) setOpen(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function openMenu(i: number, focus: 'first' | 'last' | null) {
    focusItemOnOpen.current = focus
    setActive(i); setOpen(i)
  }
  function closeMenu(focusTitle: boolean) {
    const i = open ?? active
    setOpen(null)
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

  function onItemKey(e: React.KeyboardEvent, i: number) {
    const items = itemsOf(i)
    const at = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus() }
    switch (e.key) {
      case 'ArrowDown': return go(at + 1)
      case 'ArrowUp': return go(at - 1)
      case 'Home': return go(0)
      case 'End': return go(items.length - 1)
      case 'ArrowRight': case 'ArrowLeft': {
        e.preventDefault()
        const to = step(i, e.key === 'ArrowRight' ? 1 : -1)
        titles.current[to]?.focus(); openMenu(to, 'first'); return
      }
      case 'Escape': e.preventDefault(); closeMenu(true); return
      case 'Tab': setOpen(null); return
    }
  }

  function choose(entry: Extract<Entry, { run: () => void }>) {
    if (entry.disabled) return
    setOpen(null)
    entry.run()
  }

  return (
    <div ref={bar} role="menubar" aria-label="Note menu" className="flex items-center gap-0.5">
      {menus.map((m, i) => (
        <div key={m.name} className="relative" data-menu={i}>
          <button ref={el => { titles.current[i] = el }} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open === i}
            tabIndex={i === active ? 0 : -1}
            className={`rounded-lg px-2.5 py-1 text-sm transition ${open === i ? 'bg-surface text-fg' : 'text-muted hover:bg-surface hover:text-fg'}`}
            onClick={() => (open === i ? setOpen(null) : openMenu(i, null))}
            onMouseEnter={() => { if (open !== null && open !== i) openMenu(i, null) }}
            onKeyDown={e => onTitleKey(e, i)}>
            {m.name}
          </button>
          {open === i && (
            <div role="menu" aria-label={m.name} className="absolute left-0 z-50 mt-1 min-w-56 rounded-xl border border-line bg-raised p-1 shadow-lg">
              {m.items.map((entry, k) => entry.kind === 'sep' ? (
                <div key={k} role="separator" className="my-1 h-px bg-line" />
              ) : (
                <button key={entry.label} type="button" tabIndex={-1}
                  role={entry.kind === 'radio' ? 'menuitemradio' : entry.kind === 'check' ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={entry.kind === 'item' ? undefined : !!entry.checked}
                  aria-disabled={entry.disabled || undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${entry.disabled ? 'cursor-default opacity-45' : 'hover:bg-surface focus:bg-surface'} ${entry.danger ? 'text-danger' : ''} outline-none`}
                  onClick={() => choose(entry)} onKeyDown={e => onItemKey(e, i)}>
                  <span className="w-4">{entry.kind !== 'item' && entry.checked && <Check size={14} aria-hidden />}</span>
                  <span className="flex-1">{entry.label}</span>
                  {entry.shortcut && <span className="text-xs text-muted">{entry.shortcut}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
