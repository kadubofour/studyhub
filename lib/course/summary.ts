import { localDayKey } from '@/lib/dates'
import type { Kind, LibraryItem } from '@/lib/library/items'

export const SHOWN_PER_KIND = 5
const ORDER: Kind[] = ['note', 'deck', 'lecture', 'quiz', 'chat']
const WORD: Record<Kind, [string, string]> = { note: ['note', 'notes'], deck: ['deck', 'decks'], lecture: ['lecture', 'lectures'], quiz: ['quiz', 'quizzes'], chat: ['tutor chat', 'tutor chats'] }

const mine = (items: LibraryItem[], courseId: string) => items.filter(i => i.course_id === courseId)

// One section per kind that has items in the course: how many, and the newest few
export function courseSections(items: LibraryItem[], courseId: string): { kind: Kind; total: number; shown: LibraryItem[] }[] {
  const own = mine(items, courseId)
  return ORDER.flatMap(kind => {
    const of = own.filter(i => i.kind === kind).sort((a, b) => b.at.localeCompare(a.at))
    return of.length ? [{ kind, total: of.length, shown: of.slice(0, SHOWN_PER_KIND) }] : []
  })
}

// "4 notes · 2 decks" for items already limited to one course
export function summaryLine(items: LibraryItem[]): string {
  const parts = ORDER.flatMap(kind => {
    const n = items.filter(i => i.kind === kind).length
    return n ? [`${n} ${WORD[kind][n === 1 ? 0 : 1]}`] : []
  })
  return parts.length ? parts.join(' · ') : 'Nothing here yet'
}

export const cardsDue = (items: LibraryItem[]) => items.reduce((n, i) => n + (i.kind === 'deck' ? i.due ?? 0 : 0), 0)

// "Midterm · in 9 days", counting calendar days in the student's time zone
export function examLine(exam: { title: string; due_at: string }, now: Date, tz: string): string {
  const days = Math.round((Date.parse(localDayKey(exam.due_at, tz)) - Date.parse(localDayKey(now, tz))) / 86_400_000)
  return `${exam.title} · ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`
}
