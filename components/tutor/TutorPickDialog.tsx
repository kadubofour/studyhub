'use client'
import { useEffect, useMemo, useState } from 'react'
import { MessagesSquare, Search, Upload } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { Dialog } from '@/components/ui/Dialog'
import { supabase } from '@/lib/supabase/client'
import { listNotes } from '@/lib/data/notes'
import { listLectures } from '@/lib/data/lectures'
import { listCourses } from '@/lib/data/courses'
import type { Course } from '@/lib/types'

export type TutorTarget =
  | { kind: 'note'; id: string; title: string; course_id: string | null }
  | { kind: 'lecture'; id: string; title: string; course_id: string | null }
  | { kind: 'course'; id: string; title: string; course_id: string }

type Kind = TutorTarget['kind']
const LABEL: Record<Kind, string> = { note: 'Notes', lecture: 'Lectures', course: 'Courses' }
const ALL_KINDS: Kind[] = ['note', 'lecture', 'course']

// Choose what a chat is about: one of the student's notes, lectures or courses. Used to start a chat with material attached, and to change it later.
export function TutorPickDialog({ open, onClose, onPick, onSkip, onUpload, skipLabel = 'Without a note or lecture', kinds = ALL_KINDS, title = 'Chat about…' }: {
  open: boolean; onClose: () => void; onPick: (t: TutorTarget) => void; kinds?: Kind[]; title?: string
  /** Offered when it is fine to go on without choosing anything */
  onSkip?: () => void; skipLabel?: string
  /** Offered beside the search, to bring in material that is not here yet */
  onUpload?: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} icon={MessagesSquare} size="md" subtitle="The tutor starts from what you pick.">
      {open && <Picker onPick={onPick} kinds={kinds} onSkip={onSkip} onUpload={onUpload} skipLabel={skipLabel} />}
    </Dialog>
  )
}

function Picker({ onPick, kinds, onSkip, onUpload, skipLabel }: { onPick: (t: TutorTarget) => void; kinds: Kind[]; onSkip?: () => void; onUpload?: () => void; skipLabel: string }) {
  const [kind, setKind] = useState<Kind>(kinds[0])
  const [query, setQuery] = useState('')
  const [data, setData] = useState<{ notes: { id: string; title: string; course_id: string | null }[]; lectures: { id: string; title: string; course_id: string | null }[]; courses: Course[] } | null>(null)
  const [failed, setFailed] = useState(false)

  const wanted = kinds.join(',') // what is wanted, not which array it came in: the lists are loaded once
  useEffect(() => {
    let live = true
    const sb = supabase()
    Promise.all([wanted.includes('note') ? listNotes(sb) : [], wanted.includes('lecture') ? listLectures(sb) : [], listCourses(sb)])
      .then(([notes, lectures, courses]) => { if (live) setData({ notes, lectures, courses }) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [wanted])

  const courseName = (id: string | null) => data?.courses.find(c => c.id === id)?.name
  const rows = useMemo<TutorTarget[]>(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const all: TutorTarget[] = kind === 'note' ? data.notes.map(n => ({ kind: 'note' as const, id: n.id, title: n.title, course_id: n.course_id }))
      : kind === 'lecture' ? data.lectures.map(l => ({ kind: 'lecture' as const, id: l.id, title: l.title, course_id: l.course_id }))
      : data.courses.map(c => ({ kind: 'course' as const, id: c.id, title: c.name, course_id: c.id }))
    return all.filter(r => !q || r.title.toLowerCase().includes(q))
  }, [data, kind, query])

  return (
    <div className="space-y-3">
      {kinds.length > 1 && <ChoiceChips label="What to chat about" value={kind} options={kinds.map(k => ({ value: k, label: LABEL[k] }))} onChange={v => { setKind(v as Kind); setQuery('') }} />}
      <div className="flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" aria-label={`Search ${LABEL[kind].toLowerCase()}`} placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} className="!pl-8" />
        </label>
        {onUpload && <button type="button" className="btn shrink-0" onClick={onUpload}><Upload size={14} aria-hidden />Upload</button>}
      </div>
      {failed && <p role="alert" className="text-sm text-danger">Couldn&apos;t load your {LABEL[kind].toLowerCase()}. Check your connection.</p>}
      {!data && !failed && <p role="status" className="text-sm text-muted">Loading…</p>}
      {data && rows.length === 0 && <p className="text-sm text-muted">{query.trim() ? 'Nothing matches.' : kind === 'course' ? 'No courses yet.' : `No ${LABEL[kind].toLowerCase()} yet.`}</p>}
      {onSkip && <button type="button" onClick={onSkip} className="btn w-full justify-center">{skipLabel}</button>}
      {rows.length > 0 && (
        <ul aria-label={LABEL[kind]} className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-raised text-sm">
          {rows.map(r => (
            <li key={`${r.kind}-${r.id}`}>
              <button type="button" onClick={() => onPick(r)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-surface">
                <span className="min-w-0 truncate font-medium">{r.title || 'Untitled'}</span>
                {r.kind !== 'course' && courseName(r.course_id) && <span className="shrink-0 text-xs text-muted">{courseName(r.course_id)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
