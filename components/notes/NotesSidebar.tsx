'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { CourseDot } from '@/components/ui/CourseDot'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote, listNotes, searchNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, NoteSummary } from '@/lib/types'

// Fired by the editor after a save, so titles and order in the list stay current
export const NOTES_CHANGED = 'studyhub:notes-changed'

export function NotesSidebar() {
  const router = useRouter()
  const path = usePathname()
  const toast = useToast()
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [version, setVersion] = useState(0)

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
      setVersion(v => v + 1)
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t create a note.') }
  }

  const shown = (notes ?? []).filter(n => !course || n.course_id === course)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const empty = notes?.length === 0 && !q.trim()

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-medium">Notes</h1>
        <button className="btn" onClick={create}><Plus size={14} aria-hidden />Note</button>
      </div>
      <div className="mb-3 flex gap-2">
        <input className="input min-w-0 flex-1" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        <select className="input" value={course} onChange={e => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {empty && (
        <div className="card text-center">
          <p className="mb-3 text-sm text-muted">Write lecture notes, summaries and formulas. Math works too.</p>
          <button className="btn-primary" onClick={create}>Write your first note</button>
        </div>
      )}
      {notes && !empty && shown.length === 0 && <p className="py-2 text-sm text-muted">No notes match.</p>}
      <div className="divide-y divide-line">
        {shown.map(n => (
          <Link key={n.id} href={`/notes/${n.id}`} aria-current={path === `/notes/${n.id}` ? 'page' : undefined}
            className={`flex items-center gap-2.5 px-1 py-2.5 hover:text-accent ${path === `/notes/${n.id}` ? 'text-accent' : ''}`}>
            <CourseDot color={courseOf(n.course_id)?.color} />
            <span className="flex-1 truncate">{n.title || 'Untitled'}</span>
            <span className="text-xs text-muted">{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
