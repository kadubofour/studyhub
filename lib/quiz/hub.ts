import { percent } from './summary'

// The numbers behind the Quiz page: everything the student has made and taken, worked out from plain rows

export interface HubInput {
  quizzes: { id: string; note_id: string; title: string; created_at: string; questions: unknown[] }[]
  /** Finished attempts only */
  attempts: { id: string; quiz_id: string; correct: number; total: number; finished_at: string }[]
  notes: { id: string; title: string; course_id: string | null }[]
  courses: { id: string; name: string; color: string }[]
  now: Date
}

export interface HubRow {
  id: string; title: string; noteId: string; noteTitle: string | null; courseId: string | null; courseName: string | null; courseColor: string | null
  questions: number; attempts: number; bestPct: number | null; lastPct: number | null; lastAt: string | null; createdAt: string
}
export interface Hub {
  stats: { quizzes: number; taken: number; average: number | null; best: number | null; right: number; answered: number; lastWeek: number }
  trend: { id: string; title: string; pct: number; finished_at: string }[]
  byCourse: { courseId: string | null; name: string; color: string | null; attempts: number; avgPct: number }[]
  needsWork: HubRow[]
  rows: HubRow[]
}

const TREND_LENGTH = 12
const NEEDS_WORK_BELOW = 60
const WEEK_MS = 7 * 24 * 60 * 60_000

export function buildQuizHub({ quizzes, attempts, notes, courses, now }: HubInput): Hub {
  const quizIds = new Set(quizzes.map(q => q.id))
  const done = attempts.filter(a => quizIds.has(a.quiz_id)).sort((x, y) => x.finished_at.localeCompare(y.finished_at))
  const noteOf = new Map(notes.map(n => [n.id, n]))
  const courseOf = new Map(courses.map(c => [c.id, c]))

  const rows: HubRow[] = quizzes.map(q => {
    const note = noteOf.get(q.note_id)
    const course = note?.course_id ? courseOf.get(note.course_id) : undefined
    const mine = done.filter(a => a.quiz_id === q.id)
    const last = mine[mine.length - 1]
    return {
      id: q.id, title: q.title, noteId: q.note_id, noteTitle: note?.title ?? null, courseId: course?.id ?? null, courseName: course?.name ?? null, courseColor: course?.color ?? null,
      questions: q.questions.length, attempts: mine.length,
      bestPct: mine.length ? Math.max(...mine.map(a => percent(a.correct, a.total))) : null,
      lastPct: last ? percent(last.correct, last.total) : null, lastAt: last?.finished_at ?? null, createdAt: q.created_at,
    }
  }).sort((x, y) => y.createdAt.localeCompare(x.createdAt))

  const pcts = done.map(a => percent(a.correct, a.total))
  const titleOf = new Map(quizzes.map(q => [q.id, q.title]))

  // Weakest course first: where the student most needs to go back
  const groups = new Map<string | null, number[]>()
  for (const a of done) {
    const note = noteOf.get(quizzes.find(q => q.id === a.quiz_id)!.note_id)
    const key = note?.course_id && courseOf.has(note.course_id) ? note.course_id : null
    groups.set(key, [...(groups.get(key) ?? []), percent(a.correct, a.total)])
  }
  const byCourse = [...groups].map(([courseId, list]) => {
    const course = courseId ? courseOf.get(courseId) : undefined
    return { courseId, name: course?.name ?? 'No course', color: course?.color ?? null, attempts: list.length, avgPct: Math.round(list.reduce((s, p) => s + p, 0) / list.length) }
  }).sort((x, y) => x.avgPct - y.avgPct)

  return {
    stats: {
      quizzes: quizzes.length, taken: done.length,
      average: pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null,
      best: pcts.length ? Math.max(...pcts) : null,
      right: done.reduce((s, a) => s + a.correct, 0), answered: done.reduce((s, a) => s + a.total, 0),
      lastWeek: done.filter(a => now.getTime() - new Date(a.finished_at).getTime() < WEEK_MS).length,
    },
    trend: done.slice(-TREND_LENGTH).map(a => ({ id: a.id, title: titleOf.get(a.quiz_id) ?? 'Quiz', pct: percent(a.correct, a.total), finished_at: a.finished_at })),
    byCourse,
    needsWork: rows.filter(r => r.lastPct !== null && r.lastPct < NEEDS_WORK_BELOW).sort((x, y) => x.lastPct! - y.lastPct!).slice(0, 3),
    rows,
  }
}

export type HubSort = 'newest' | 'oldest' | 'lowest' | 'most'
export interface HubFilter { query: string; course: string; sort: HubSort }

/** The quiz list after the student's search, course and sort. `course` is a course id, 'none' for quizzes on no course, or 'all'. */
export function filterRows(rows: HubRow[], { query, course, sort }: HubFilter): HubRow[] {
  const q = query.trim().toLowerCase()
  const list = rows.filter(r =>
    (!q || r.title.toLowerCase().includes(q) || (r.noteTitle ?? '').toLowerCase().includes(q)) &&
    (course === 'all' || (course === 'none' ? r.courseId === null : r.courseId === course)))
  const by: Record<HubSort, (x: HubRow, y: HubRow) => number> = {
    newest: (x, y) => y.createdAt.localeCompare(x.createdAt),
    oldest: (x, y) => x.createdAt.localeCompare(y.createdAt),
    lowest: (x, y) => (x.lastPct ?? Infinity) - (y.lastPct ?? Infinity),
    most: (x, y) => y.attempts - x.attempts,
  }
  return [...list].sort(by[sort])
}
