export type Recent = { kind: 'note' | 'deck' | 'lecture'; id: string; title: string; course_id: string | null; at: string; href: string }
export type CourseCounts = Record<string, { notes: number; decks: number; lectures: number }>

type Note = { id: string; course_id: string | null; title: string; updated_at: string }
type Deck = { id: string; course_id: string | null; name: string; created_at?: string }
type Lecture = { id: string; course_id: string | null; title: string; recorded_at: string }

// What Home needs to get back into course material: how much each course holds, and the newest notes, decks and lectures
export function homeMaterial(notes: Note[], decks: Deck[], lectures: Lecture[], limit = 6): { counts: CourseCounts; recent: Recent[] } {
  const counts: CourseCounts = {}
  const bump = (course: string | null, kind: 'notes' | 'decks' | 'lectures') => {
    if (!course) return
    counts[course] ??= { notes: 0, decks: 0, lectures: 0 }
    counts[course][kind]++
  }
  notes.forEach(n => bump(n.course_id, 'notes'))
  decks.forEach(d => bump(d.course_id, 'decks'))
  lectures.forEach(l => bump(l.course_id, 'lectures'))
  const all: Recent[] = [
    ...notes.map(n => ({ kind: 'note' as const, id: n.id, title: n.title, course_id: n.course_id, at: n.updated_at, href: `/notes/${n.id}` })),
    ...decks.map(d => ({ kind: 'deck' as const, id: d.id, title: d.name, course_id: d.course_id, at: d.created_at ?? '', href: `/flashcards/${d.id}` })),
    ...lectures.map(l => ({ kind: 'lecture' as const, id: l.id, title: l.title, course_id: l.course_id, at: l.recorded_at, href: `/lectures/${l.id}` })),
  ]
  return { counts, recent: all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit) }
}
