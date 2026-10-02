'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { CourseDot } from '@/components/ui/CourseDot'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import { listCourses } from '@/lib/data/courses'
import type { Course, DeckWithDue } from '@/lib/types'

export default function FlashcardsPage() {
  const toast = useToast()
  const [decks, setDecks] = useState<DeckWithDue[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState('')

  useEffect(() => {
    const sb = supabase()
    Promise.all([listDecksWithDue(sb, new Date()), listCourses(sb)]).then(([d, c]) => { setDecks(d); setCourses(c) })
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const d = await createDeck(supabase(), { name: name.trim(), course_id: courseId || null })
      setDecks(ds => [...(ds ?? []), { ...d, due: 0, total: 0 }])
      setOpen(false); setName(''); setCourseId('')
    } catch { toast('Couldn\'t save.') }
  }

  const totalDue = decks?.reduce((n, d) => n + d.due, 0) ?? 0
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Flashcards" actions={<>
        {totalDue > 0 && <Link href="/review" className="btn-primary">Review all ({totalDue})</Link>}
        <button className="btn" onClick={() => setOpen(true)}><Plus size={14} aria-hidden />Deck</button>
      </>} />
      {decks?.length === 0 && (
        <div className="card text-center">
          <p className="mb-3 text-sm text-muted">Group cards into decks, one per topic.</p>
          <button className="btn-primary" onClick={() => setOpen(true)}>Create a deck</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decks?.map(d => (
          <Link key={d.id} href={`/flashcards/${d.id}`} className="card hover:border-accent">
            <div className="flex items-center gap-2 font-medium"><CourseDot color={courseOf(d.course_id)?.color} />{d.name}</div>
            <div className="mt-1 text-sm text-muted">{d.due > 0 ? `${d.due} due` : 'All caught up'} · {d.total} cards</div>
          </Link>
        ))}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="New deck">
        <form onSubmit={create} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Cell biology" /></label>
          <label className="field"><span>Course</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
        </form>
      </Dialog>
    </div>
  )
}
