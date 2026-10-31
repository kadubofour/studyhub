'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckSquare, FolderPlus, SquarePen, Upload } from 'lucide-react'
import { NotebookCover } from '@/components/notes/NotebookCover'
import type { MenuEntry } from '@/components/ui/ContextMenu'
import { ComposeButton, PhoneCount, PhoneEmpty, PhoneGroup, PhoneHeading, PhoneRow, PhoneSearch, PhoneTitle, SheetMark, tick } from '@/components/ui/PhoneList'
import { groupByDate, previewLine, rowDate } from '@/lib/notes/noteRows'
import { VIEW_CHOICES } from '@/lib/ui/listView'
import type { Course, NoteSummary } from '@/lib/types'

// The notes list on a phone, as notes apps have it: a big title with a ⋯ menu, a search field, the notebooks as covers in a row,
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
  const [now] = useState(() => new Date())
  // by date only while newest first: in another order the dates would jump about
  const groups = sort === 'edited' && !searching ? groupByDate(notes, now) : [{ label: '', notes }]
  const courseName = courses.find(c => c.id === course)?.name

  const options: MenuEntry[] = [
    { label: 'Select notes', icon: CheckSquare, onSelect: onSelect, disabled: notes.length === 0 },
    { label: 'New notebook', icon: FolderPlus, onSelect: onNewNotebook },
    { label: 'Upload', icon: Upload, onSelect: onUpload },
    'sep',
    ...VIEW_CHOICES.notes.sorts.map(s => tick(s.label, sort === s.value, () => onSort(s.value))),
    'sep',
    tick('All courses', !course, () => onCourse('')),
    ...courses.map(c => tick(c.name, course === c.id, () => onCourse(c.id))),
  ]

  return (
    <div className="pb-24">
      <PhoneTitle title="Notes" menuLabel="Notes options" menu={options} selecting={selecting} onDone={onStopSelecting} />
      {selecting && <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">{selected.length} selected</span>{selectionActions}</div>}
      <PhoneSearch label="Search notes" value={q} onChange={onSearch} />
      {courseName && (
        <p className="-mt-3 mb-4 text-sm text-muted">In {courseName} · <button type="button" className="font-medium text-accent" onClick={() => onCourse('')}>Show all</button></p>
      )}

      {books.length > 0 && !searching && (
        <section aria-labelledby="phone-notebooks" className="mb-6">
          <PhoneHeading id="phone-notebooks">Notebooks</PhoneHeading>
          {/* the notebooks drawn as notebooks, as on a computer, in a row that scrolls sideways */}
          <ul aria-label="Notebooks" className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {books.map(b => (
              <li key={b.id} className="w-24 shrink-0">
                <Link href={`/notebooks/${b.id}`} aria-label={`Open ${b.name}, ${b.count} note${b.count === 1 ? '' : 's'}`} className="block rounded-xl active:scale-95 transition">
                  <NotebookCover name={b.name} count={b.count} color={b.color} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loaded && notes.length === 0 && (
        <PhoneEmpty>{searching ? 'No notes match.' : courseName ? 'No notes in this course yet.' : 'No notes yet. Tap the pencil to write one.'}</PhoneEmpty>
      )}

      {groups.map(g => g.notes.length > 0 && (
        <PhoneGroup key={g.label || 'all'} label={g.label} name="Notes">
          {g.notes.map(n => {
            const preview = previewLine(n.preview)
            return (
              <PhoneRow key={n.id} href={`/notes/${n.id}`} title={n.title} mark={<SheetMark color={courses.find(c => c.id === n.course_id)?.color} />}
                date={rowDate(n.updated_at, now)} line={preview || (n.preview === undefined ? '' : 'No additional text')}
                select={selecting ? { on: selected.includes(n.id), onToggle: () => onToggle(n.id) } : undefined} onContextMenu={e => onMenu(e, n)} />
            )
          })}
        </PhoneGroup>
      ))}

      <PhoneCount n={notes.length} one="note" many="notes" />
      {!selecting && <ComposeButton label="New note" icon={SquarePen} onClick={onCreate} />}
    </div>
  )
}
