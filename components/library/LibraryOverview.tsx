'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, FileText, FolderPlus, MoreVertical, Plus, Search, FolderOpen } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { Dropdown } from '@/components/ui/Dropdown'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { COURSE_COLORS } from '@/lib/colors'
import { createCourse } from '@/lib/data/courses'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/providers/ToastProvider'
import { ago, type SetSort, type StudySetCard } from '@/lib/library/studySets'
import type { Course } from '@/lib/types'

const SORTS = [
  { value: 'recent', label: 'Last accessed' },
  { value: 'name', label: 'Name' },
  { value: 'materials', label: 'Most materials' },
] as const

const BAR = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-medium transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// The Library's landing: one card for each course (its study set), with how far through it the student is. Materials opens everything in one list.
export function LibraryOverview({ cards, now, q, onQ, sort, onSort, onMaterials, onNewNotebook, create, courses, onCourses, onOpenMaterials }: {
  cards: StudySetCard[]; now: Date; q: string; onQ: (q: string) => void; sort: SetSort; onSort: (s: SetSort) => void
  onMaterials: () => void; onNewNotebook: () => void
  /** What the Create button offers (a new note, an upload…) */
  create: MenuEntry[]
  courses: Course[]; onCourses: (c: Course[]) => void
  /** A course's materials, in the list of everything */
  onOpenMaterials: (courseId: string) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [naming, setNaming] = useState(false)
  const items: MenuEntry[] = [{ label: 'New course', icon: FolderOpen, onSelect: () => setNaming(true) }, ...create]
  return (
    <div>
      <div role="search" className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[1_1_16rem]">
          <span className="sr-only">Search courses</span>
          <Search size={17} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={e => onQ(e.target.value)} placeholder="Search courses…" aria-label="Search courses"
            className="h-11 w-full rounded-xl border border-line bg-raised pl-10 pr-3 text-[15px] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        <Dropdown label="Sort courses" value={sort} onChange={s => onSort(s as SetSort)} options={SORTS.map(s => ({ value: s.value, label: s.label }))} className="w-44" />
        <button type="button" className={BAR} onClick={onMaterials}><FileText size={16} aria-hidden />Materials</button>
        <button type="button" className={BAR} onClick={onNewNotebook}><FolderPlus size={16} aria-hidden />New notebook</button>
        <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-fg px-4 text-sm font-semibold text-bg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-haspopup="menu" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 200, y: r.bottom + 6 }) }}>
          <Plus size={16} aria-hidden />Create
        </button>
        {menu && <ContextMenu x={Math.max(8, menu.x)} y={menu.y} label="Create" items={items} onClose={() => setMenu(null)} />}
      </div>

      <ul aria-label="Courses" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li>
          <button type="button" onClick={() => setNaming(true)}
            className="flex min-h-[5.5rem] w-full flex-row items-center justify-start gap-4 rounded-2xl border-2 border-dashed border-line bg-surface/60 px-5 text-left transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-[11.5rem] sm:flex-col sm:justify-center sm:gap-2 sm:px-6 sm:text-center">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-raised text-muted"><Plus size={22} /></span>
            <span className="flex flex-col gap-0.5 sm:gap-2">
              <span className="text-[17px] font-semibold">New course</span>
              <span className="text-sm text-muted">Add a course to keep its notes, decks and quizzes together</span>
            </span>
          </button>
        </li>
        {cards.map(c => <CourseCard key={c.course.id} card={c} now={now} onOpenMaterials={onOpenMaterials} />)}
      </ul>
      {cards.length === 0 && q.trim() && <p className="mt-6 text-center text-sm text-muted">No course matches “{q.trim()}”.</p>}
      <NewCourseDialog open={naming} onClose={() => setNaming(false)} courses={courses} onCreated={c => { onCourses([...courses, c]); setNaming(false) }} />
    </div>
  )
}

function CourseCard({ card, now, onOpenMaterials }: { card: StudySetCard; now: Date; onOpenMaterials: (courseId: string) => void }) {
  const { course, materials, lastAt, progress, planLine } = card
  const router = useRouter()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const href = `/courses/${course.id}`
  return (
    <li className="group relative rounded-2xl border border-line bg-raised p-5 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: course.color }}>{course.name.trim().charAt(0).toUpperCase() || '?'}</span>
        <div className="min-w-0 flex-1">
          {/* the whole card is the link; the ⋯ button sits above it */}
          <h3 className="truncate text-[17px] font-semibold"><Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">{course.name}</Link></h3>
          <div className="mt-2 flex items-center gap-3">
            <div role="progressbar" aria-label={`Progress in ${course.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: course.color }} />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-muted">{progress}%</span>
          </div>
        </div>
        <button type="button" aria-label={`Options for ${course.name}`} aria-haspopup="menu" className="relative z-10 -mr-2 -mt-1 grid size-9 place-items-center rounded-full text-muted hover:bg-surface"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right, y: r.bottom + 4 }) }}><MoreVertical size={18} aria-hidden /></button>
        {menu && <ContextMenu x={menu.x} y={menu.y} label={`${course.name} options`} onClose={() => setMenu(null)} items={[
          { label: 'Open course page', icon: ArrowUpRight, onSelect: () => router.push(href) },
          { label: 'See its materials', icon: FileText, onSelect: () => onOpenMaterials(course.id) },
        ]} />}
      </div>
      <p className="mt-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted"><FileText size={12} aria-hidden />{materials} {materials === 1 ? 'material' : 'materials'}</span></p>
      <p className="mt-4 flex items-center justify-between text-sm text-muted"><span>Last studied</span><span className="text-fg/80">{lastAt ? ago(lastAt, now) : 'Not yet'}</span></p>
      <p className="mt-3 rounded-lg bg-surface px-3 py-2.5 text-sm">{planLine}</p>
    </li>
  )
}

function NewCourseDialog({ open, onClose, courses, onCreated }: { open: boolean; onClose: () => void; courses: Course[]; onCreated: (c: Course) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = color || COURSE_COLORS[courses.length % COURSE_COLORS.length]
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try { onCreated(await createCourse(supabase(), { name: name.trim(), color: chosen })); setName(''); setColor('') } catch { toast('Couldn\'t make that course.') }
    setBusy(false)
  }
  return (
    <Dialog open={open} onClose={onClose} title="New course" icon={FolderOpen}>
      {open && (
        <form className="space-y-4" onSubmit={save}>
          <label className="field"><span>Name</span><input autoFocus value={name} maxLength={80} placeholder="Biology" onChange={e => setName(e.target.value)} /></label>
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
            {COURSE_COLORS.map(c => (
              <button key={c} type="button" role="radio" aria-checked={chosen === c} aria-label={c} onClick={() => setColor(c)}
                className={`size-8 rounded-full ring-offset-2 ring-offset-bg transition ${chosen === c ? 'ring-2 ring-fg' : ''}`} style={{ background: c }} />
            ))}
          </div>
          <DialogFooter>
            <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
            <button className={BTN_SOLID} disabled={!name.trim() || busy}>Create</button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
