import type { SupabaseClient } from '@supabase/supabase-js'
import { check, must } from './util'
import { listNotes } from './notes'
import { listDecksWithDue } from './decks'
import { listLectures } from './lectures'
import { listChats } from './tutor'
import { isMovable, type Kind, type LibraryItem } from '@/lib/library/items'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Everything the student has made, as one list: notes, decks, lectures, quizzes and tutor chats
export async function loadLibrary(sb: SupabaseClient, now: Date): Promise<LibraryItem[]> {
  const [notes, decks, lectures, chats, quizzes] = await Promise.all([
    listNotes(sb), listDecksWithDue(sb, now), listLectures(sb), listChats(sb),
    sb.from('quizzes').select('id,note_id,title,created_at').then(r => must<{ id: string; note_id: string; title: string; created_at: string }[]>(r)),
  ])
  const noteCourse = new Map(notes.map(n => [n.id, n.course_id]))
  return [
    ...notes.map(n => ({ kind: 'note' as const, id: n.id, title: n.title, course_id: n.course_id, at: n.updated_at, meta: '', href: `/notes/${n.id}` })),
    ...decks.map(d => ({
      kind: 'deck' as const, id: d.id, title: d.name, course_id: d.course_id, at: d.created_at ?? '',
      meta: `${plural(d.total, 'card')}${d.due > 0 ? ` · ${d.due} due` : ''}`, href: `/flashcards/${d.id}`,
    })),
    ...lectures.map(l => ({ kind: 'lecture' as const, id: l.id, title: l.title, course_id: l.course_id, at: l.recorded_at, meta: `${Math.round(l.duration_seconds / 60)} min`, href: `/lectures/${l.id}` })),
    // A quiz follows its note; one whose note is gone has nowhere to belong and is left out
    ...quizzes.filter(q => noteCourse.has(q.note_id)).map(q => ({ kind: 'quiz' as const, id: q.id, title: q.title, course_id: noteCourse.get(q.note_id) ?? null, at: q.created_at, meta: '', href: `/quiz/${q.id}` })),
    ...chats.map(c => ({ kind: 'chat' as const, id: c.id, title: c.title, course_id: c.course_id, at: c.updated_at, meta: '', href: `/tutor/${c.id}` })),
  ]
}

const TABLE: Record<Exclude<Kind, 'quiz'>, 'notes' | 'decks' | 'lectures' | 'tutor_chats'> = { note: 'notes', deck: 'decks', lecture: 'lectures', chat: 'tutor_chats' }
// Topics belong to a course, so a moved item leaves the topics of the course it left
const LINK_COLUMN = { note: 'note_id', deck: 'deck_id', lecture: 'lecture_id' } as const

// Puts the chosen items in a course (null: none), one request per kind. Quizzes are skipped: they follow their note.
export async function moveItems(sb: SupabaseClient, items: { kind: Kind; id: string }[], courseId: string | null): Promise<void> {
  const movable = items.filter(isMovable) as { kind: Exclude<Kind, 'quiz'>; id: string }[]
  for (const kind of ['note', 'deck', 'lecture', 'chat'] as const) {
    const ids = movable.filter(i => i.kind === kind).map(i => i.id)
    if (!ids.length) continue
    check(await sb.from(TABLE[kind]).update({ course_id: courseId }).in('id', ids))
  }
  for (const kind of ['note', 'deck', 'lecture'] as const) {
    const ids = movable.filter(i => i.kind === kind).map(i => i.id)
    if (!ids.length) continue
    check(await sb.from('topic_links').delete().in(LINK_COLUMN[kind], ids))
  }
}
