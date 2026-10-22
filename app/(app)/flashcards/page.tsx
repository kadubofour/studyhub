'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ListChecks, Plus, Layers } from 'lucide-react'
import { requestQuiz } from '@/lib/quiz/events'
import { EmptyState } from '@/components/ui/EmptyState'
import { ViewOptions } from '@/components/ui/ViewOptions'
import { sortDecks, useView } from '@/lib/ui/listView'
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
  // A quick action can open this page with the new deck form ready, and a course chosen
  const params = useSearchParams()
  const [open, setOpen] = useState(() => params.get('new') === '1')
  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState(() => params.get('course') ?? '')

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
  const view = useView('decks')
  const list = view.layout === 'list'
  const shown = sortDecks(decks ?? [], view.sort)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Flashcards" actions={<>
        {totalDue > 0 && <Link href="/review" className="btn-primary">Review all ({totalDue})</Link>}
        <button className="btn" onClick={requestQuiz}><ListChecks size={14} aria-hidden />Quiz</button>
        <button className="btn" onClick={() => setOpen(true)}><Plus size={14} aria-hidden />Deck</button>
      </>} />
      {decks?.length === 0 && (
        <EmptyState icon={Layers} tone="a" title="Make your first deck" body="Group cards into decks, one per topic. Reviews are scheduled so you remember for longer.">
          <button className="btn-primary" onClick={() => setOpen(true)}>Create a deck</button>
        </EmptyState>
      )}
      {decks && decks.length > 0 && <ViewOptions page="decks" className="mb-3 justify-end" />}
      <div role="list" aria-label="Decks" data-layout={view.layout} className={list ? 'flex flex-col gap-2' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
        {shown.map(d => {
          const c = courseOf(d.course_id)
          const color = c?.color ?? 'var(--accent-solid)'
          if (list) return (
            <div key={d.id} role="listitem">
              <Link href={`/flashcards/${d.id}`} className="tile flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 !py-2.5 transition hover:border-accent" style={{ borderLeftColor: color }}>
                <span className="min-w-0 flex-1 truncate font-semibold">{d.name}</span>
                <CourseTag course={c} />
                <span className="text-xs" style={{ color: d.due > 0 ? color : undefined }}>{d.due > 0 ? `${d.due} due` : 'all caught up'}</span>
                <span className="text-xs text-muted">{d.total} cards</span>
              </Link>
            </div>
          )
          return (
            <div key={d.id} role="listitem">
            <Link href={`/flashcards/${d.id}`} className="tile group relative block h-full overflow-hidden transition hover:-translate-y-0.5">
              {/* stacked-cards motif in the course colour */}
              <span aria-hidden className="absolute -right-3 -top-3 size-16 rotate-12 rounded-xl opacity-15" style={{ background: color }} />
              <span aria-hidden className="absolute -right-1 top-1 size-12 rotate-6 rounded-xl opacity-25" style={{ background: color }} />
              <div className="relative">
                <div className="font-semibold">{d.name}</div>
                <CourseTag course={c} className="mt-0.5" />
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold" style={{ color: d.due > 0 ? color : undefined }}>{d.due}</div>
                    <div className="text-xs text-muted">{d.due > 0 ? 'due now' : 'all caught up'}</div>
                  </div>
                  <div className="text-xs text-muted">{d.total} cards</div>
                </div>
              </div>
            </Link>
            </div>
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
