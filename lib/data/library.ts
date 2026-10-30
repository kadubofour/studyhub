import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll, must } from './util'
import { listNotes } from './notes'
import { listDecksWithDue } from './decks'
import { listLectures } from './lectures'
import { listChats } from './tutor'
import { fileSize, listMaterials, MATERIAL_LABEL } from './materials'
import { isMovable, type Kind, type LibraryItem } from '@/lib/library/items'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

type QuizRow = { id: string; note_id: string; title: string; created_at: string }

// Everything the student has made, as one list: notes, decks, lectures, quizzes, tutor chats and uploaded files
export async function loadLibrary(sb: SupabaseClient, now: Date): Promise<LibraryItem[]> {
  const [notes, decks, lectures, chats, quizzes, files] = await Promise.all([
    listNotes(sb), listDecksWithDue(sb, now), listLectures(sb), listChats(sb),
    fetchAll<QuizRow>((from, to) => sb.from('quizzes').select('id,note_id,title,created_at').order('created_at', { ascending: false }).order('id').range(from, to)),
    listMaterials(sb),
  ])
  const noteCourse = new Map(notes.map(n => [n.id, n.course_id]))
  return [
    ...notes.map(n => ({ kind: 'note' as const, id: n.id, title: n.title, course_id: n.course_id, notebook_id: n.notebook_id ?? null, at: n.updated_at, meta: '', href: `/notes/${n.id}` })),
    ...decks.map(d => ({
      kind: 'deck' as const, id: d.id, title: d.name, course_id: d.course_id, at: d.created_at ?? '',
      due: d.due, meta: `${plural(d.total, 'card')}${d.due > 0 ? ` · ${d.due} due` : ''}`, href: `/flashcards/${d.id}`,
    })),
    ...lectures.map(l => ({ kind: 'lecture' as const, id: l.id, title: l.title, course_id: l.course_id, at: l.recorded_at, meta: `${Math.round(l.duration_seconds / 60)} min`, href: `/lectures/${l.id}` })),
    // A quiz follows its note; one whose note is gone has nowhere to belong and is left out
    ...quizzes.filter(q => noteCourse.has(q.note_id)).map(q => ({ kind: 'quiz' as const, id: q.id, title: q.title, course_id: noteCourse.get(q.note_id) ?? null, at: q.created_at, meta: '', href: `/quiz/${q.id}` })),
    ...chats.map(c => ({ kind: 'chat' as const, id: c.id, title: c.title, course_id: c.course_id, at: c.updated_at, meta: '', href: `/tutor/${c.id}` })),
    ...files.map(f => ({ kind: 'file' as const, id: f.id, title: f.name, course_id: f.course_id, at: f.created_at, meta: `${MATERIAL_LABEL[f.mime] ?? 'File'} · ${fileSize(f.bytes)}`, href: `/files/${f.id}` })),
  ]
}

const TABLE: Record<Exclude<Kind, 'quiz'>, 'notes' | 'decks' | 'lectures' | 'tutor_chats' | 'materials'> = { note: 'notes', deck: 'decks', lecture: 'lectures', chat: 'tutor_chats', file: 'materials' }
// Ids go in the request address, so long selections are sent in batches
const BATCH = 100

// Puts the chosen items in a course (null: none), one request per batch per kind, and says how many really changed.
// Quizzes are skipped: they follow their note. Topic links are dropped by the database, and only when the course really changes.
export async function moveItems(sb: SupabaseClient, items: { kind: Kind; id: string }[], courseId: string | null): Promise<number> {
  const movable = items.filter(isMovable) as { kind: Exclude<Kind, 'quiz'>; id: string }[]
  let moved = 0
  for (const kind of ['note', 'deck', 'lecture', 'chat', 'file'] as const) {
    const ids = movable.filter(i => i.kind === kind).map(i => i.id)
    for (let i = 0; i < ids.length; i += BATCH) {
      const rows = must(await sb.from(TABLE[kind]).update({ course_id: courseId }).in('id', ids.slice(i, i + BATCH)).select('id')) as { id: string }[]
      moved += rows.length
    }
  }
  return moved
}
