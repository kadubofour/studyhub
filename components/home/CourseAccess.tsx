import Link from 'next/link'
import { BookOpen, FileText, Layers, Mic, type LucideIcon } from 'lucide-react'
import { CourseTag } from '@/components/ui/CourseTag'
import { SplitCard } from '@/components/ui/cards'
import type { CourseCounts, Recent } from '@/lib/home/material'
import type { Course } from '@/lib/types'

const ICON: Record<Recent['kind'], LucideIcon> = { note: FileText, deck: Layers, lecture: Mic }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// Home: straight into course material. A card per course (its page), and the newest notes, decks and lectures to jump back into.
export function CourseAccess({ courses, counts, recent }: { courses: Course[]; counts: CourseCounts; recent: Recent[] }) {
  if (courses.length === 0) return null
  return (
    <section aria-label="Course material" className="space-y-5">
      <div>
        <h2 className="section-label">Your courses</h2>
        <ul aria-label="Your courses" className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
          {courses.map(c => {
            const n = counts[c.id] ?? { notes: 0, decks: 0, lectures: 0 }
            const total = n.notes + n.decks + n.lectures
            const parts = [n.notes && plural(n.notes, 'note'), n.decks && plural(n.decks, 'deck'), n.lectures && plural(n.lectures, 'lecture')].filter(Boolean).join(' · ')
            return <li key={c.id}><SplitCard color={c.color} icon={BookOpen} href={`/courses/${c.id}`} title={c.name} value={total} sub={parts || 'Nothing here yet'} /></li>
          })}
        </ul>
      </div>
      {recent.length > 0 && (
        <div>
          <h2 className="section-label">Jump back in</h2>
          <ul aria-label="Jump back in" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map(r => {
              const Icon = ICON[r.kind]
              return (
                <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent"><Icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <Link href={r.href} className="block truncate font-medium hover:text-accent">{r.title}</Link>
                    <CourseTag course={courses.find(c => c.id === r.course_id)} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
