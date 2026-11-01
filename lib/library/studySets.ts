import type { PlanRow } from '@/lib/plan/service'
import type { LibraryItem } from './items'
import type { TopicStat } from '@/lib/topics/types'
import type { Course } from '@/lib/types'

// What each course card on the Library shows: how many materials it holds, when it was last worked on, how far the student is through
// its topics, and where its study plan stands.

export type SetSort = 'recent' | 'name' | 'materials'
export type StudySetCard = {
  course: Course
  materials: number
  lastAt: string | null
  /** 0–100: the share of its topics that are covered or mastered (0 when it has none) */
  progress: number
  topics: number
  /** The line at the bottom of the card */
  planLine: string
}

const DAY = 86_400_000

/** "just now", "10m ago", "10h ago", "3d ago", "2w ago", then the date */
export function ago(iso: string, now: Date): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const ms = Math.max(0, now.getTime() - t)
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < DAY) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 14 * DAY) return `${Math.floor(ms / DAY)}d ago`
  if (ms < 60 * DAY) return `${Math.floor(ms / (7 * DAY))}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function progressOf(topics: TopicStat[] | undefined): number {
  if (!topics || topics.length === 0) return 0
  const done = topics.filter(t => t.status === 'covered' || t.status === 'mastered').length
  return Math.round((done / topics.length) * 100)
}

function planLineOf(plan: PlanRow | undefined, now: Date): string {
  if (!plan) return 'You haven\'t started a study plan yet'
  const due = plan.exam?.due_at ? new Date(plan.exam.due_at).getTime() : null
  if (plan.exam && due !== null && due > now.getTime()) {
    const days = Math.ceil((due - now.getTime()) / DAY)
    return `${plan.exam.title} ${days <= 1 ? 'is tomorrow' : `in ${days} days`}`
  }
  return 'Study plan running'
}

export function studySets(input: {
  courses: Course[]; items: LibraryItem[]; plans: PlanRow[]; topics: Record<string, TopicStat[]>; now: Date; q: string; sort: SetSort
}): StudySetCard[] {
  const q = input.q.trim().toLowerCase()
  const cards = input.courses
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .map<StudySetCard>(course => {
      const own = input.items.filter(i => i.course_id === course.id)
      const lastAt = own.reduce<string | null>((latest, i) => (i.at && (!latest || i.at > latest) ? i.at : latest), null)
      const topics = input.topics[course.id]
      return {
        course, materials: own.length, lastAt, progress: progressOf(topics), topics: topics?.length ?? 0,
        planLine: planLineOf(input.plans.find(p => p.course_id === course.id), input.now),
      }
    })
  const byName = (a: StudySetCard, b: StudySetCard) => a.course.name.localeCompare(b.course.name, undefined, { sensitivity: 'base' })
  return cards.sort(input.sort === 'name' ? byName
    : input.sort === 'materials' ? (a, b) => b.materials - a.materials || byName(a, b)
      : (a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || byName(a, b))
}
