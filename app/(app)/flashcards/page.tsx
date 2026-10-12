'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Layers } from 'lucide-react'
import { IndexCard } from '@/components/ui/cards'
import { EmptyState } from '@/components/ui/EmptyState'
import { useScanSaved } from '@/lib/scan/events'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { CourseTag } from '@/components/ui/CourseTag'
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
  // Scan (in the app's sidebar) saved cards, perhaps to a new deck: show it
  useScanSaved(() => { listDecksWithDue(supabase(), new Date()).then(setDecks).catch(() => {}) })

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
        <EmptyState icon={Layers} tone="a" title="Make your first deck" body="Group cards into decks, one per topic. Reviews are scheduled so you remember for longer.">
          <button className="btn-primary" onClick={() => setOpen(true)}>Create a deck</button>
        </EmptyState>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks?.map(d => {
          const c = courseOf(d.course_id)
          const color = c?.color ?? 'var(--accent-solid)'
          return (
            <IndexCard key={d.id} href={`/flashcards/${d.id}`} color={color} title={d.name} eyebrow={<CourseTag course={c} />}
              value={d.due} valueColor={d.due > 0} sub={`${d.due > 0 ? 'due now' : 'all caught up'} · ${d.total} ${d.total === 1 ? 'card' : 'cards'}`} />
          )
        })}
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
