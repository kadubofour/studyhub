'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ListChecks, Plus, Layers } from 'lucide-react'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { StackTile } from '@/components/ui/StackTile'
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
      <ItemList label="Decks" layout={view.layout}>
        {shown.map(d => {
          const c = courseOf(d.course_id)
          const color = c?.color ?? 'var(--accent-solid)'
          // In the grid a deck keeps its tile: the stacked cards and the big number due
          if (view.layout === 'grid') return (
            <StackTile key={d.id} motif="cards" color={color} title={d.name} href={`/flashcards/${d.id}`} tag={<CourseTag course={c} />}
              big={d.due} bigColor={d.due > 0 ? color : undefined} bigLabel={d.due > 0 ? 'due now' : 'all caught up'} side={`${d.total} cards`} />
          )
          return (
            <ItemTile key={d.id} layout={view.layout} icon={Layers} color={c?.color} title={d.name} href={`/flashcards/${d.id}`} badge={d.due || undefined}
              subtitle={`${d.total} ${d.total === 1 ? 'card' : 'cards'}`} meta={c && <CourseTag course={c} />}
              aside={d.due > 0 ? <span className="font-medium text-accent">{d.due} due</span> : 'all caught up'} />
          )
        })}
      </ItemList>
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
