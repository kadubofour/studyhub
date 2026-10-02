'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseDot } from '@/components/ui/CourseDot'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote, listNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, NoteSummary } from '@/lib/types'

export default function NotesPage() {
  const router = useRouter()
  const toast = useToast()
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')

  useEffect(() => {
    const sb = supabase()
    Promise.all([listNotes(sb), listCourses(sb)]).then(([n, c]) => { setNotes(n); setCourses(c) })
  }, [])

  const shown = useMemo(() => (notes ?? []).filter(n =>
    (!course || n.course_id === course) && n.title.toLowerCase().includes(q.trim().toLowerCase())), [notes, q, course])

  async function create() {
    try {
      const n = await createNote(supabase(), { course_id: course || null })
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t create a note.') }
  }

  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Notes" actions={<button className="btn" onClick={create}><Plus size={14} aria-hidden />Note</button>} />
      <div className="mb-3 flex gap-2">
        <input className="input flex-1" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        <select className="input" value={course} onChange={e => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {notes?.length === 0 && (
        <div className="card text-center">
          <p className="mb-3 text-sm text-muted">Write lecture notes, summaries and formulas. Math works too.</p>
          <button className="btn-primary" onClick={create}>Write your first note</button>
        </div>
      )}
      <div className="divide-y divide-line">
        {shown.map(n => (
          <Link key={n.id} href={`/notes/${n.id}`} className="flex items-center gap-2.5 py-2.5 hover:text-accent">
            <CourseDot color={courseOf(n.course_id)?.color} />
            <span className="flex-1 truncate">{n.title || 'Untitled'}</span>
            <span className="text-xs text-muted">{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
