import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll, must } from './util'
import { listNotes } from './notes'
import { listDecksWithDue } from './decks'
import { listLectures } from './lectures'
import { listChats } from './tutor'
import { fileSize, listMaterials, MATERIAL_LABEL } from './materials'
import { isMovable, type Kind, type LibraryItem } from '@/lib/library/items'

// A note's first words as one tidy line of plain text, or nothing for an empty note: the markdown marks are taken out, and so is a
// first heading that only repeats the title
export function blurbOf(preview: string | null | undefined, title = ''): string | undefined {
  const lines = (preview ?? '').split('\n')
  const first = lines[0]?.replace(/^#{1,6}\s+/, '').trim().toLowerCase()
  const body = (first && first === title.trim().toLowerCase() ? lines.slice(1) : lines).join(' ')
  const plain = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // pictures
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their words
    .replace(/(^|\s)#{1,6}\s+/g, '$1') // headings
    .replace(/(^|\s)(?:[-*+]|\d+\.)\s+/g, '$1') // list marks
    .replace(/(^|\s)>\s?/g, '$1') // quotes
    .replace(/[*_`~]+/g, '') // bold, italic, code
    .replace(/\s+/g, ' ').trim()
  return plain.slice(0, 160) || undefined
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

type QuizRow = { id: string; note_id: string | null; title: string; created_at: string }

// Everything the student has made, as one list: notes, decks, lectures, quizzes, tutor chats and uploaded files
export async function loadLibrary(sb: SupabaseClient, now: Date): Promise<LibraryItem[]> {
  const [notes, decks, lectures, chats, quizzes, files] = await Promise.all([
    listNotes(sb), listDecksWithDue(sb, now), listLectures(sb), listChats(sb),
    fetchAll<QuizRow>((from, to) => sb.from('quizzes').select('id,note_id,title,created_at').order('created_at', { ascending: false }).order('id').range(from, to)),
    listMaterials(sb),
  ])
  const noteCourse = new Map(notes.map(n => [n.id, n.course_id]))
  const noteTitle = new Map(notes.map(n => [n.id, n.title]))
  const noteBook = new Map(notes.map(n => [n.id, n.notebook_id ?? null]))
  return [
    ...notes.map(n => ({ kind: 'note' as const, id: n.id, title: n.title, course_id: n.course_id, notebook_id: n.notebook_id ?? null, at: n.updated_at, meta: '', blurb: blurbOf(n.preview, n.title), href: `/notes/${n.id}` })),
    ...decks.map(d => ({
      kind: 'deck' as const, id: d.id, title: d.name, course_id: d.course_id, notebook_id: d.notebook_id ?? null, at: d.created_at ?? '',
      due: d.due, meta: `${plural(d.total, 'card')}${d.due > 0 ? ` · ${d.due} due` : ''}`, href: `/flashcards/${d.id}`,
    })),
    ...lectures.map(l => ({ kind: 'lecture' as const, id: l.id, title: l.title, course_id: l.course_id, notebook_id: l.notebook_id ?? null, at: l.recorded_at, meta: `${Math.round(l.duration_seconds / 60)} min`, href: `/lectures/${l.id}` })),
    // A quiz from a note follows it, and one whose note is gone has nowhere to belong and is left out; a quiz on a topic stands alone
    ...quizzes.filter(q => !q.note_id || noteCourse.has(q.note_id)).map(q => {
      const n = q.note_id
      return { kind: 'quiz' as const, id: q.id, title: q.title, course_id: n ? noteCourse.get(n) ?? null : null, notebook_id: n ? noteBook.get(n) ?? null : null, at: q.created_at, meta: '', blurb: n ? `From ${noteTitle.get(n) || 'Untitled'}` : undefined, href: `/quiz/${q.id}` }
    }),
    ...chats.map(c => ({ kind: 'chat' as const, id: c.id, title: c.title, course_id: c.course_id, at: c.updated_at, meta: '', href: `/tutor/${c.id}` })),
    ...files.map(f => ({ kind: 'file' as const, id: f.id, title: f.name, course_id: f.course_id, notebook_id: f.notebook_id ?? null, at: f.created_at, meta: `${MATERIAL_LABEL[f.mime] ?? 'File'} · ${fileSize(f.bytes)}`, href: `/files/${f.id}` })),
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
