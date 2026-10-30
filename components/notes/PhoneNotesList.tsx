'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Circle, CircleCheck, Folder, FolderPlus, MoreHorizontal, Search, SquarePen, Upload, CheckSquare, type LucideIcon } from 'lucide-react'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { groupByDate, previewLine, rowDate } from '@/lib/notes/noteRows'
import { VIEW_CHOICES } from '@/lib/ui/listView'
import type { Course, NoteSummary } from '@/lib/types'

// An empty space the size of an icon, so a menu's unchosen options line up with the chosen one's tick
const NoIcon = (({ size = 15 }: { size?: number | string }) => <span aria-hidden className="inline-block" style={{ width: size, height: size }} />) as unknown as LucideIcon

// The notes list on a phone, as notes apps have it: a big title with a ⋯ menu, a search field, the notebooks as folder rows,
// then the notes as compact rows grouped by when they were edited, each with its date and first line, and a button to
// write a new one at the bottom right, where the thumb is. A computer keeps the tiles.
export function PhoneNotesList({ notes, loaded, searching, q, onSearch, books, courses, course, onCourse, sort, onSort, selecting, selected, onToggle,
  onStopSelecting, selectionActions, onSelect, onNewNotebook, onUpload, onCreate, onMenu }: {
  notes: NoteSummary[]; loaded: boolean; searching: boolean; q: string; onSearch: (q: string) => void
  books: { id: string; name: string; count: number; color: string }[]
  courses: Course[]; course: string; onCourse: (id: string) => void; sort: string; onSort: (s: string) => void
  selecting: boolean; selected: string[]; onToggle: (id: string) => void; onStopSelecting: () => void; selectionActions: React.ReactNode
  onSelect: () => void; onNewNotebook: () => void; onUpload: () => void; onCreate: () => void
  onMenu: (e: React.MouseEvent, n: NoteSummary) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [now] = useState(() => new Date())
  // by date only while newest first: in another order the dates would jump about
  const groups = sort === 'edited' && !searching ? groupByDate(notes, now) : [{ label: '', notes }]
  const courseName = courses.find(c => c.id === course)?.name

  const options: MenuEntry[] = [
    { label: 'Select notes', icon: CheckSquare, onSelect: onSelect, disabled: notes.length === 0 },
    { label: 'New notebook', icon: FolderPlus, onSelect: onNewNotebook },
    { label: 'Upload', icon: Upload, onSelect: onUpload },
    'sep',
    ...VIEW_CHOICES.notes.sorts.map(s => ({ label: s.label, icon: sort === s.value ? Check : NoIcon, onSelect: () => onSort(s.value) })),
    'sep',
    { label: 'All courses', icon: course ? NoIcon : Check, onSelect: () => onCourse('') },
    ...courses.map(c => ({ label: c.name, icon: course === c.id ? Check : NoIcon, onSelect: () => onCourse(c.id) })),
  ]

  return (
    <div className="pb-24">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight">Notes</h1>
        {selecting
          ? <button type="button" className="text-[15px] font-semibold text-accent" onClick={onStopSelecting}>Done</button>
          : <button type="button" aria-label="Notes options" aria-haspopup="menu" className="grid size-10 place-items-center rounded-full text-accent active:bg-surface"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right, y: r.bottom + 4 }) }}><MoreHorizontal size={22} aria-hidden /></button>}
      </div>
      {selecting && <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">{selected.length} selected</span>{selectionActions}</div>}

      <div className="relative mb-5">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" className="h-10 w-full rounded-xl bg-surface pl-10 pr-3 text-[16px] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          placeholder="Search" aria-label="Search notes" value={q} onChange={e => onSearch(e.target.value)} />
      </div>
      {courseName && (
        <p className="-mt-3 mb-4 text-sm text-muted">In {courseName} · <button type="button" className="font-medium text-accent" onClick={() => onCourse('')}>Show all</button></p>
      )}

      {books.length > 0 && !searching && (
        <section aria-labelledby="phone-notebooks" className="mb-6">
          <h2 id="phone-notebooks" className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Notebooks</h2>
          <ul aria-label="Notebooks" className="divide-y divide-line overflow-hidden rounded-2xl bg-raised">
            {books.map(b => (
              <li key={b.id}>
                <Link href={`/notebooks/${b.id}`} className="flex min-h-12 items-center gap-3 px-4 active:bg-surface">
                  <Folder size={20} aria-hidden style={{ color: b.color }} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[16px]">{b.name}</span>
                  <span className="text-[15px] text-muted">{b.count}</span>
                  <ChevronRight size={17} aria-hidden className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loaded && notes.length === 0 && (
        <p className="py-10 text-center text-[15px] text-muted">{searching ? 'No notes match.' : courseName ? 'No notes in this course yet.' : 'No notes yet. Tap the pencil to write one.'}</p>
      )}

      {groups.map(g => g.notes.length > 0 && (
        <section key={g.label || 'all'} aria-label={g.label || 'Notes'} className="mb-6">
          {g.label && <h2 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{g.label}</h2>}
          <ul aria-label={g.label || 'Notes'} className="divide-y divide-line overflow-hidden rounded-2xl bg-raised">
            {g.notes.map(n => {
              const on = selected.includes(n.id)
              const preview = previewLine(n.preview)
              const body = (
                <>
                  {selecting && (on ? <CircleCheck size={22} aria-hidden className="shrink-0 text-accent" /> : <Circle size={22} aria-hidden className="shrink-0 text-muted" />)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{n.title || 'Untitled'}</span>
                    <span className="block truncate text-[14px] text-muted">
                      <span className="text-fg/70">{rowDate(n.updated_at, now)}</span>{'  '}{preview || (n.preview === undefined ? '' : 'No additional text')}
                    </span>
                  </span>
                </>
              )
              const row = 'flex min-h-[3.75rem] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface'
              return (
                <li key={n.id}>
                  {selecting
                    ? <button type="button" role="checkbox" aria-checked={on} aria-label={n.title || 'Untitled'} className={row} onClick={() => onToggle(n.id)}>{body}</button>
                    : <Link href={`/notes/${n.id}`} className={row} onContextMenu={e => onMenu(e, n)}>{body}</Link>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {notes.length > 0 && <p className="text-center text-[13px] text-muted">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</p>}

      {!selecting && (
        <button type="button" aria-label="New note" onClick={onCreate}
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-5 z-30 grid size-14 place-items-center rounded-full bg-accent-solid text-white shadow-[0_10px_24px_-8px_rgb(0_0_0/0.45)] transition active:scale-95">
          <SquarePen size={24} aria-hidden />
        </button>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} label="Notes options" items={options} onClose={() => setMenu(null)} />}
    </div>
  )
}
