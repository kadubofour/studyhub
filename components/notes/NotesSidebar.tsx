'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Upload, CheckSquare, X, NotebookPen, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { CourseTag } from '@/components/ui/CourseTag'
import { ExportMenu } from '@/components/notes/ExportMenu'
import { ImportDialog } from '@/components/notes/ImportDialog'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote, listNotes, searchNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, NoteSummary } from '@/lib/types'

// Fired by the editor after a save, so titles and order in the list stay current
export const NOTES_CHANGED = 'studyhub:notes-changed'

// The notes home: search, course filter, import, and selecting notes to export
export function NotesSidebar() {
  const router = useRouter()
  const toast = useToast()
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [version, setVersion] = useState(0)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => { listCourses(supabase()).then(setCourses).catch(() => {}) }, [])

  useEffect(() => {
    const bump = () => setVersion(v => v + 1)
    window.addEventListener(NOTES_CHANGED, bump)
    return () => window.removeEventListener(NOTES_CHANGED, bump)
  }, [])

  // Search titles and note text on the server; debounce typing
  useEffect(() => {
    const term = q.trim()
    const t = setTimeout(() => {
      const load = term ? searchNotes(supabase(), term) : listNotes(supabase())
      load.then(setNotes).catch(() => toast('Couldn\'t load notes.'))
    }, term ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, version, toast])

  async function create() {
    try {
      const n = await createNote(supabase(), { course_id: course || null })
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t create a note.') }
  }

  const shown = (notes ?? []).filter(n => !course || n.course_id === course)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const empty = notes?.length === 0 && !q.trim()
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm text-muted">{selected.length} selected</span>
              <ExportMenu ids={selected} label="Export selected" disabled={!selected.length} />
              <button className="btn-ghost" onClick={() => { setSelecting(false); setSelected([]) }} aria-label="Stop selecting"><X size={15} aria-hidden />Done</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setImporting(true)}><Upload size={14} aria-hidden />Import</button>
              {!empty && <button className="btn" onClick={() => setSelecting(true)}><CheckSquare size={14} aria-hidden />Select</button>}
              {!empty && <ExportMenu label="Export all" fileName="Studyhub notes" />}
              <button className="btn-primary" onClick={create}><Plus size={14} aria-hidden />Note</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input w-full pl-9" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        </div>
        <select className="input" value={course} onChange={e => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {empty && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><NotebookPen size={22} aria-hidden /></span>
          <p className="max-w-sm text-sm text-muted">Write lecture notes, summaries and formulas, or import a Word document or PDF.</p>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setImporting(true)}><Upload size={14} aria-hidden />Import</button>
            <button className="btn-primary" onClick={create}>Write your first note</button>
          </div>
        </div>
      )}
      {notes && !empty && shown.length === 0 && <p className="py-2 text-sm text-muted">No notes match.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(n => {
          const c = courseOf(n.course_id)
          const on = selected.includes(n.id)
          const body = (
            <>
              <div className="flex items-start gap-2">
                {selecting && <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-hidden className="mt-1 size-4 accent-[var(--accent-solid)]" />}
                <span className="line-clamp-2 flex-1 font-medium">{n.title || 'Untitled'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <CourseTag course={c} />
                <span className="ml-auto text-xs text-muted">{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</span>
              </div>
            </>
          )
          const cls = `tile block border-t-4 text-left transition hover:-translate-y-0.5 ${on ? 'ring-2 ring-accent' : ''}`
          const style = { borderTopColor: c?.color ?? 'var(--line)' }
          return selecting ? (
            <button key={n.id} type="button" role="checkbox" aria-checked={on} aria-label={`Select ${n.title || 'Untitled'}`}
              className={cls} style={style} onClick={() => toggle(n.id)}>{body}</button>
          ) : (
            <Link key={n.id} href={`/notes/${n.id}`} className={cls} style={style}>{body}</Link>
          )
        })}
      </div>

      <ImportDialog open={importing} onClose={() => setImporting(false)} courses={courses} onImported={() => setVersion(v => v + 1)} />
    </div>
  )
}
