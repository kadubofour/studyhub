'use client'
import Link from 'next/link'
import { BookOpen, FileText, Layers, Mic, type LucideIcon } from 'lucide-react'
import { CourseTag } from '@/components/ui/CourseTag'
import { CardsMark, CourseMark, PhoneGroup, PhoneRow, SheetMark, StripMark } from '@/components/ui/PhoneList'
import { useScreen } from '@/lib/ui/useScreen'
import { SplitCard } from '@/components/ui/cards'
import type { CourseCounts, Recent } from '@/lib/home/material'
import type { Course } from '@/lib/types'

const ICON: Record<Recent['kind'], LucideIcon> = { note: FileText, deck: Layers, lecture: Mic }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// Straight into course material: a card per course (its page), and the newest notes, decks and lectures to jump back into.
// Home shows the courses on phones only: a wider screen has them in the sidebar.
export function CourseAccess({ courses, counts, recent, coursesClassName = '' }: { courses: Course[]; counts: CourseCounts; recent: Recent[]; coursesClassName?: string }) {
  const phone = useScreen() === 'phone'
  if (courses.length === 0 && recent.length === 0) return null
  // a phone shows them as rows in rounded groups, as the Tutor, Practice and Library lists do
  if (phone) {
    const MARK = { note: SheetMark, deck: CardsMark, lecture: StripMark }
    return (
      <section aria-label="Course material">
        {courses.length > 0 && (
          <PhoneGroup label="Your courses">
            {courses.map(c => {
              const n = counts[c.id] ?? { notes: 0, decks: 0, lectures: 0 }
              const parts = [n.notes && plural(n.notes, 'note'), n.decks && plural(n.decks, 'deck'), n.lectures && plural(n.lectures, 'lecture')].filter(Boolean).join(' · ')
              return <PhoneRow key={c.id} href={`/courses/${c.id}`} mark={<CourseMark color={c.color} />} title={c.name} line={parts || 'Nothing here yet'} />
            })}
          </PhoneGroup>
        )}
        {recent.length > 0 && (
          <PhoneGroup label="Jump back in">
            {recent.map(r => {
              const Mark = MARK[r.kind]
              const course = courses.find(c => c.id === r.course_id)
              return <PhoneRow key={`${r.kind}-${r.id}`} href={r.href} mark={<Mark color={course?.color} />} title={r.title} line={course?.name} />
            })}
          </PhoneGroup>
        )}
      </section>
    )
  }
  return (
    <section aria-label="Course material" className="space-y-5">
      {courses.length > 0 && <div className={coursesClassName}>
        <h2 className="section-label">Your courses</h2>
        <ul aria-label="Your courses" className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
          {courses.map(c => {
            const n = counts[c.id] ?? { notes: 0, decks: 0, lectures: 0 }
            const total = n.notes + n.decks + n.lectures
            const parts = [n.notes && plural(n.notes, 'note'), n.decks && plural(n.decks, 'deck'), n.lectures && plural(n.lectures, 'lecture')].filter(Boolean).join(' · ')
            return <li key={c.id}><SplitCard color={c.color} icon={BookOpen} href={`/courses/${c.id}`} title={c.name} value={total} sub={parts || 'Nothing here yet'} /></li>
          })}
        </ul>
      </div>}
      {recent.length > 0 && (
        <div>
          <h2 className="section-label">Jump back in</h2>
          <ul aria-label="Jump back in" className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
            {recent.map(r => {
              const Icon = ICON[r.kind]
              return (
                <li key={`${r.kind}-${r.id}`} className="tile relative flex items-center gap-3.5 !px-4 !py-3.5 transition">
                  <Icon size={18} aria-hidden className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <Link href={r.href} className="block truncate font-medium after:absolute after:inset-0 hover:text-accent">{r.title}</Link>
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
