'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellPlus, FilePlus2, FileText, FileType2, FileUp, MoreHorizontal, Search, Sigma, Trash2, type LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import type { NoteMenuActions } from '@/components/notes/NoteMenuBar'
import type { EditorMode } from '@/lib/types'

type Row = { label: string; icon: LucideIcon; run: () => void; disabled?: boolean; danger?: boolean }

// Two choices side by side, the chosen one raised: how a phone switches between two ways of doing something
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => { if (value !== o.value) onChange(o.value) }}
          className={`min-h-11 rounded-xl text-[15px] font-medium transition ${value === o.value ? 'bg-raised text-fg shadow-sm' : 'text-muted'}`}>{o.label}</button>
      ))}
    </div>
  )
}

// The note's File, Edit and View menus, for a phone: a ⋯ button in the note's top bar opens a sheet from the bottom with
// two switches (write or read, rich or Markdown), automatic maths, and the note's actions as large rows. What a phone does
// itself (undo, redo, select all) and what it has no room for (full width) are left out.
export function NoteSheet({ actions: a, mode, reading, autoMath, onRemind }: {
  actions: NoteMenuActions; mode: EditorMode; reading: boolean; autoMath: boolean; onRemind: () => void
}) {
  const [open, setOpen] = useState(false)
  // where the sheet is drawn: the app's root, found when the button is tapped
  const [host, setHost] = useState<Element | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) sheet.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus() }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const pick = (run: () => void) => () => { close(); run() }

  const rows: Row[] = [
    { label: 'Find in note', icon: Search, run: a.find },
    { label: 'Insert equation', icon: Sigma, run: a.insertEquation, disabled: reading },
    { label: 'Remind me', icon: BellPlus, run: onRemind },
    { label: 'Upload', icon: FileUp, run: a.importNote },
    { label: 'Export as Word', icon: FileText, run: a.exportWord },
    { label: 'Export as PDF', icon: FileType2, run: a.exportPdf },
    { label: 'New note', icon: FilePlus2, run: a.newNote },
    { label: 'Delete note', icon: Trash2, run: a.deleteNote, danger: true },
  ]

  return (
    <>
      <button ref={trigger} type="button" aria-label="Note options" aria-haspopup="dialog" aria-expanded={open} onClick={e => { setHost(e.currentTarget.closest('.app-root') ?? document.body); setOpen(true) }}
        className="btn-ghost md:hidden"><MoreHorizontal size={18} aria-hidden /></button>
      {/* drawn at the app's root: inside the top bar, its blur would trap a fixed sheet in the bar */}
      {open && host && createPortal(
        <>
          <div data-sheet-backdrop aria-hidden className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={close} />
          <div ref={sheet} role="dialog" aria-modal="true" aria-label="Note options" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close() } }}
            className="sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.4)] md:hidden">
            <div data-sheet-handle aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="space-y-2.5">
              <Segmented label="Write or read" value={reading ? 'read' : 'write'} options={[{ value: 'write', label: 'Write' }, { value: 'read', label: 'Read' }]} onChange={a.toggleReading} />
              <Segmented label="Editor" value={mode} options={[{ value: 'rich', label: 'Rich' }, { value: 'markdown', label: 'Markdown' }]} onChange={m => a.setMode(m)} />
              <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-surface px-4">
                <span id="sheet-auto-math" className="text-[15px] font-medium">Automatic maths</span>
                <Switch checked={autoMath} onChange={a.toggleAutoMath} labelledBy="sheet-auto-math" />
              </div>
            </div>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {rows.map(r => (
                <li key={r.label}>
                  <button type="button" data-sheet-row disabled={r.disabled} onClick={pick(r.run)}
                    className={`flex min-h-14 w-full items-center gap-3.5 px-4 text-left text-[15px] font-medium transition active:bg-raised disabled:opacity-40 ${r.danger ? 'text-danger' : ''}`}>
                    <r.icon size={19} aria-hidden className={`shrink-0 ${r.danger ? '' : 'text-muted'}`} />{r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>,
        host,
      )}
    </>
  )
}
