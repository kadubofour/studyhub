import type { SupabaseClient } from '@supabase/supabase-js'
import type { LibraryItem } from '@/lib/library/items'
import type { TopicStat } from '@/lib/topics/types'
import type { Course } from '@/lib/types'
import { loadLibrary } from './library'
import { listTopicStats } from './topics'
import { must } from './util'

export type CourseExam = { id: string; title: string; due_at: string }
// A part that could not be read is null, so the page can say so without losing the rest
export type CoursePage = { course: Course; items: LibraryItem[] | null; topics: TopicStat[] | null; exam: CourseExam | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Everything the course page shows, or null when there is no such course. Only the course itself must load.
export async function loadCoursePage(sb: SupabaseClient, courseId: string, now: Date): Promise<CoursePage | null> {
  if (!UUID.test(courseId)) return null
  const [course, items, topics, exam] = await Promise.all([
    sb.from('courses').select('id,name,color').eq('id', courseId).maybeSingle().then(r => must(r) as Course | null),
    loadLibrary(sb, now).then(l => l.filter(i => i.course_id === courseId)).catch(() => null),
    listTopicStats(sb, courseId).catch(() => null),
    // The next unfinished exam that is still ahead
    Promise.resolve(sb.from('tasks').select('id,title,due_at').eq('course_id', courseId).eq('type', 'exam').is('done_at', null).gt('due_at', now.toISOString()).order('due_at').limit(1))
      .then(r => (must(r) as CourseExam[])[0] ?? null).catch(() => null),
  ])
  return course ? { course, items, topics, exam } : null
}
