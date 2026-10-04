import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClassKind, Course, TaskType } from '@/lib/types'
import type { ScanPlannerResult } from '@/lib/ai/scan'
import { createCourse } from '@/lib/data/courses'
import { createTask } from '@/lib/data/tasks'
import { createClass } from '@/lib/data/classes'
import { endOfLocalDay } from '@/lib/dates'
import { COURSE_COLORS } from '@/lib/colors'

export type CourseChoice = { kind: 'existing'; id: string } | { kind: 'new'; name: string }
/** `due` is 'YYYY-MM-DD' or '' (no date), as a date input holds it */
export type TaskDraft = { keep: boolean; title: string; type: TaskType; due: string; unsure: boolean }
export type ClassDraft = { keep: boolean; course: CourseChoice; day: number; start: string; end: string; room: string; kind: ClassKind; unsure: boolean }
export type PlannerDrafts = { tasks: TaskDraft[]; classes: ClassDraft[] }

const key = (name: string) => name.trim().toLowerCase()

// A scanned course name → the student's course with that name (ignoring case and spaces), or a new one
export function matchCourse(name: string, courses: Course[]): CourseChoice {
  const hit = courses.find(c => key(c.name) === key(name))
  return hit ? { kind: 'existing', id: hit.id } : { kind: 'new', name: name.trim() }
}

// The scan result as editable rows, all ticked. New courses keep the first spelling seen, so
// "Chemistry" and "chemistry" become one course.
export function toDrafts(r: ScanPlannerResult, courses: Course[]): PlannerDrafts {
  const spelling = new Map<string, string>()
  const choose = (name: string): CourseChoice => {
    const m = matchCourse(name, courses)
    if (m.kind === 'existing') return m
    if (!spelling.has(key(name))) spelling.set(key(name), m.name)
    return { kind: 'new', name: spelling.get(key(name))! }
  }
  return {
    tasks: r.tasks.map(t => ({ keep: true, title: t.title, type: t.type, due: t.due_date ?? '', unsure: t.unsure })),
    classes: r.classes.map(c => ({ keep: true, course: choose(c.course), day: c.day, start: c.start, end: c.end, room: c.room ?? '', kind: c.kind, unsure: c.unsure })),
  }
}

// What stops saving, in words; null when the ticked items can be saved
export function plannerProblem(d: PlannerDrafts): string | null {
  const tasks = d.tasks.filter(t => t.keep)
  const classes = d.classes.filter(c => c.keep)
  if (!tasks.length && !classes.length) return 'Tick at least one item to save.'
  if (tasks.some(t => !t.title.trim())) return 'Every task needs a title.'
  if (classes.some(c => !c.start || !c.end || c.end <= c.start)) return 'Each class must end after it starts.'
  if (classes.some(c => (c.course.kind === 'new' ? !c.course.name.trim() : !c.course.id))) return 'Each class needs a course.'
  return null
}

// Saves the ticked items: new courses first (one per name), then tasks (due at the end of that
// day in the student's time zone), then classes
export async function savePlanner(sb: SupabaseClient, d: PlannerDrafts, tz: string, existing: Course[]): Promise<{ tasks: number; classes: number; courses: number }> {
  const tasks = d.tasks.filter(t => t.keep)
  const classes = d.classes.filter(c => c.keep)
  const made = new Map<string, string>()
  for (const c of classes) {
    if (c.course.kind !== 'new' || made.has(key(c.course.name))) continue
    const color = COURSE_COLORS[(existing.length + made.size) % COURSE_COLORS.length]
    const course = await createCourse(sb, { name: c.course.name.trim().slice(0, 80), color })
    made.set(key(c.course.name), course.id)
  }
  for (const t of tasks) {
    await createTask(sb, { title: t.title.trim().slice(0, 300), type: t.type, due_at: t.due ? endOfLocalDay(t.due, tz).toISOString() : null })
  }
  for (const c of classes) {
    const course_id = c.course.kind === 'existing' ? c.course.id : made.get(key(c.course.name))!
    await createClass(sb, { course_id, day_of_week: c.day, start_time: c.start, end_time: c.end, location: c.room.trim() || null, kind: c.kind })
  }
  return { tasks: tasks.length, classes: classes.length, courses: made.size }
}

export function savedText(r: { tasks: number; classes: number }): string {
  const parts = [
    r.tasks ? `${r.tasks} task${r.tasks === 1 ? '' : 's'}` : '',
    r.classes ? `${r.classes} class${r.classes === 1 ? '' : 'es'}` : '',
  ].filter(Boolean)
  return `Added ${parts.join(' and ')}.`
}
