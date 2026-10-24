'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { SplitCard } from '@/components/ui/cards'
import { PageHeader } from '@/components/ui/PageHeader'
import { NewCourseButton } from '@/components/quick/NewCourseButton'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { loadLibrary } from '@/lib/data/library'
import { summaryLine } from '@/lib/course/summary'
import type { LibraryItem } from '@/lib/library/items'
import type { Course } from '@/lib/types'

// Every course in one place, each opening its own page
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    listCourses(supabase()).then(c => { if (live) setCourses(c) }).catch(() => { if (live) setFailed(true) })
    // What is in each course is a nice-to-have: the list shows without it
    loadLibrary(supabase(), new Date()).then(l => { if (live) setItems(l) }).catch(() => {})
    return () => { live = false }
  }, [])

  if (failed) return <div><PageHeader title="Courses" /><p role="alert" className="text-sm text-danger">Could not load your courses. Check your connection.</p></div>
  if (!courses) return <div><PageHeader title="Courses" /><p className="text-sm text-muted">Loading…</p></div>
  const add = (c: Course) => setCourses(cs => [...(cs ?? []), c])
  if (courses.length === 0) return (
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
      <PageHeader title="Courses" actions={<NewCourseButton count={courses.length} onAdded={add} />} />
      <ul aria-label="Your courses" className="grid gap-3 sm:grid-cols-2">
        {courses.map(c => (
          <li key={c.id}>
            <SplitCard color={c.color} icon={BookOpen} href={`/courses/${c.id}`} title={c.name}
              value={items.filter(i => i.course_id === c.id).length} sub={summaryLine(items.filter(i => i.course_id === c.id))} />
          </li>
        ))}
      </ul>
    </div>
  )
}
