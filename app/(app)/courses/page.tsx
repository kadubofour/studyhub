'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BookOpen, FolderOpen } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { SplitCard } from '@/components/ui/cards'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseMark, PhoneGroup, PhoneRow } from '@/components/ui/PhoneList'
import { useScreen } from '@/lib/ui/useScreen'
import { NewCourseButton } from '@/components/quick/NewCourseButton'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { loadLibrary } from '@/lib/data/library'
import { summaryLine } from '@/lib/course/summary'
import { NO_COURSE_LABEL, type LibraryItem } from '@/lib/library/items'
import { MaterialBrowser } from '@/components/library/MaterialBrowser'
import type { Course } from '@/lib/types'
import { Working } from '@/components/ui/Working'

// Courses and All material are the two ways to look at the same things: by course, or everything in one list across courses
function Tabs({ current }: { current: 'courses' | 'all' }) {
  return (
    <nav aria-label="Courses view" className="mb-4 inline-flex rounded-xl bg-surface p-1 text-[15px] font-medium">
      {([['courses', '/courses', 'Courses'], ['all', '/courses?view=all', 'All material']] as const).map(([id, href, label]) => (
        <Link key={id} href={href} replace aria-current={current === id ? 'page' : undefined}
          className={`rounded-lg px-4 py-1.5 transition ${current === id ? 'bg-raised shadow-sm' : 'text-muted hover:text-fg'}`}>{label}</Link>
      ))}
    </nav>
  )
}

// Every course in one place, each opening its own page, and the material that is in no course
export default function CoursesPage() {
  const all = useSearchParams().get('view') === 'all'
  const phone = useScreen() === 'phone' // a phone shows the courses as rows in a rounded group, as the Tutor and Practice lists do
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    listCourses(supabase()).then(c => { if (live) setCourses(c) }).catch(() => { if (live) setFailed(true) })
    // What is in each course is a nice-to-have: the list shows without it
    loadLibrary(supabase(), new Date()).then(l => { if (live) setItems(l) }).catch(() => { if (live) setItems([]) })
    return () => { live = false }
  }, [])

  if (all) return <div><Tabs current="all" /><MaterialBrowser title="All material" /></div>
  if (failed) return <div><PageHeader title="Courses" /><p role="alert" className="text-sm text-danger">Could not load your courses. Check your connection.</p></div>
  if (!courses) return <div><PageHeader title="Courses" /><Working kind="load" size="sm" label="Loading" className="text-sm text-muted" /></div>
  const add = (c: Course) => setCourses(cs => [...(cs ?? []), c])
  // With no course at all, material that is in none still has to show
  if (courses.length > 0 ? false : items === null) return <div><PageHeader title="Courses" /><Working kind="load" size="sm" label="Loading" className="text-sm text-muted" /></div>
  const mine = (id: string) => (items ?? []).filter(i => i.course_id === id)
  const loose = (items ?? []).filter(i => i.course_id === null)
  if (courses.length === 0 && loose.length === 0) return (
    <div>
      <PageHeader title="Courses" />
      <EmptyState icon={BookOpen} tone="b" title="No courses yet" body="A course gathers its notes, decks, lectures and topics in one place. Add your first one here, or with its timetable in the Planner.">
        <NewCourseButton count={0} onAdded={add} />
        <Link href="/planner" className="btn">Open the Planner</Link>
      </EmptyState>
    </div>
  )
  return (
    <div>
      <PageHeader title="Courses" actions={<NewCourseButton count={courses.length} onAdded={add} iconOnly={phone} />} />
      <Tabs current="courses" />
      {phone ? (
        <PhoneGroup name="Your courses">
          {courses.map(c => <PhoneRow key={c.id} href={`/courses/${c.id}`} mark={<CourseMark color={c.color} />} title={c.name} line={summaryLine(mine(c.id)) || 'Nothing here yet'} />)}
          {loose.length > 0 && <PhoneRow href="/courses/none" mark={<CourseMark color="var(--muted)" />} title={NO_COURSE_LABEL} line={summaryLine(loose)} />}
        </PhoneGroup>
      ) : (
      <ul aria-label="Your courses" className="grid gap-3 sm:grid-cols-2">
        {courses.map(c => (
          <li key={c.id}>
            <SplitCard color={c.color} icon={BookOpen} href={`/courses/${c.id}`} title={c.name} value={mine(c.id).length} sub={summaryLine(mine(c.id))} />
          </li>
        ))}
        {/* material in no course is never lost: it has a card of its own, shown whenever there is any */}
        {loose.length > 0 && (
          <li><SplitCard color="var(--muted)" icon={FolderOpen} href="/courses/none" title={NO_COURSE_LABEL} value={loose.length} sub={summaryLine(loose)} /></li>
        )}
      </ul>
      )}
    </div>
  )
}
