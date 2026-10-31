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
import { VIEW_CHOICES, sortDecks, useView, viewStore } from '@/lib/ui/listView'
import { CardsMark, ComposeButton, PhoneCount, PhoneEmpty, PhoneGroup, PhoneRow, PhoneSearch, PhoneTitle, tick } from '@/components/ui/PhoneList'
import type { MenuEntry } from '@/components/ui/ContextMenu'
import { showsComputer, showsPhone, useScreen } from '@/lib/ui/useScreen'
import { useScanSaved } from '@/lib/scan/events'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { CourseTag } from '@/components/ui/CourseTag'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import { listCourses } from '@/lib/data/courses'
import { Dropdown, courseOptions } from '@/components/ui/Dropdown'
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
  const screen = useScreen()
  const shown = sortDecks(decks ?? [], view.sort)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  const phone = showsPhone(screen) && (
    <PhoneDecks decks={decks} courses={courses} sort={view.sort} onSort={s => viewStore('decks').set({ ...view, sort: s })} onNew={() => setOpen(true)} />
  )

  return (
    <div>
      {phone && <div className="md:hidden">{phone}</div>}
      {showsComputer(screen) && <div className="max-md:hidden">
      <PageHeader title="Flashcards" actions={<>
        {totalDue > 0 && <Link href="/review" className="btn-primary">Review all ({totalDue})</Link>}
        <button className="btn" onClick={requestQuiz}><ListChecks size={14} aria-hidden />Quiz</button>
        {/* one ink button per header, as on every page: Review all when cards are due, otherwise making a deck */}
        <button className={totalDue > 0 ? 'btn' : 'btn-primary'} onClick={() => setOpen(true)}><Plus size={14} aria-hidden />Deck</button>
      </>} />
      {decks?.length === 0 && (
        <EmptyState icon={Layers} tone="a" title="Make your first deck" body="Group cards into decks, one per topic. Reviews are scheduled so you remember for longer.">
          <button className="btn-primary" onClick={() => setOpen(true)}>Create a deck</button>
        </EmptyState>
      )}
      {decks && decks.length > 0 && <ViewOptions page="decks" className="mb-3" />}
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
      </div>}
      <Dialog open={open} onClose={() => setOpen(false)} title="New deck">
        <form onSubmit={create} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Cell biology" /></label>
          <div className="field"><span>Course</span>
            <Dropdown label="Course" value={courseId} onChange={setCourseId} options={courseOptions(courses)} />
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
        </form>
      </Dialog>
    </div>
  )
}

// The decks on a phone, as the notes list is: due decks first, each with its fanned cards, how many are due and how many it holds
function PhoneDecks({ decks, courses, sort, onSort, onNew }: { decks: DeckWithDue[] | null; courses: Course[]; sort: string; onSort: (s: string) => void; onNew: () => void }) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const shown = sortDecks((decks ?? []).filter(d => !term || d.name.toLowerCase().includes(term)), sort)
  const totalDue = decks?.reduce((n, d) => n + d.due, 0) ?? 0
  const groups = sort === 'due' && !term
    ? [{ label: 'Due now', decks: shown.filter(d => d.due > 0) }, { label: 'All caught up', decks: shown.filter(d => d.due === 0) }]
    : [{ label: '', decks: shown }]
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const menu: MenuEntry[] = [
    { label: 'Quiz', icon: ListChecks, onSelect: requestQuiz },
    'sep',
    ...VIEW_CHOICES.decks.sorts.map(s => tick(s.label, sort === s.value, () => onSort(s.value))),
  ]
  return (
    <div className="pb-24">
      <PhoneTitle title="Flashcards" menuLabel="Flashcards options" menu={menu} />
      <PhoneSearch label="Search decks" value={q} onChange={setQ} />
      {totalDue > 0 && !term && (
        <Link href="/review" className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 active:opacity-80">
          <span><span className="block text-[16px] font-semibold text-accent">{totalDue} {totalDue === 1 ? 'card' : 'cards'} due</span><span className="block text-[14px] text-muted">Review them all now</span></span>
          <span className="btn-primary pointer-events-none">Review</span>
        </Link>
      )}
      {decks?.length === 0 && <PhoneEmpty>No decks yet. Tap + to make one.</PhoneEmpty>}
      {decks && decks.length > 0 && shown.length === 0 && <PhoneEmpty>No decks match.</PhoneEmpty>}
      {groups.map(g => g.decks.length > 0 && (
        <PhoneGroup key={g.label || 'all'} label={g.label} name="Decks">
          {g.decks.map(d => {
            const c = courseOf(d.course_id)
            return (
              <PhoneRow key={d.id} href={`/flashcards/${d.id}`} title={d.name} mark={<CardsMark color={c?.color} />}
                date={d.due > 0 ? `${d.due} due` : undefined}
                line={[c?.name, `${d.total} ${d.total === 1 ? 'card' : 'cards'}`].filter(Boolean).join(' · ')} />
            )
          })}
        </PhoneGroup>
      ))}
      <PhoneCount n={shown.length} one="deck" many="decks" />
      <ComposeButton label="New deck" icon={Plus} onClick={onNew} />
    </div>
  )
}
