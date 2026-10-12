export type Kind = 'note' | 'deck' | 'lecture' | 'quiz' | 'chat'
export type LibraryItem = { kind: Kind; id: string; title: string; course_id: string | null; at: string; meta: string; href: string }
// course: 'all', 'none' (not in any course) or a course id
export type View = { course: 'all' | 'none' | string; kind: Kind | null; q: string; sort: 'recent' | 'name' }

const KINDS: Kind[] = ['note', 'deck', 'lecture', 'quiz', 'chat']

const inCourse = (i: LibraryItem, course: View['course']) => course === 'all' || (course === 'none' ? i.course_id === null : i.course_id === course)
const matches = (i: LibraryItem, q: string) => !q.trim() || i.title.toLowerCase().includes(q.trim().toLowerCase())

// What the list shows: the chosen course, kind and search, in the chosen order
export function visible(items: LibraryItem[], v: View): LibraryItem[] {
  const out = items.filter(i => inCourse(i, v.course) && (v.kind === null || i.kind === v.kind) && matches(i, v.q))
  return v.sort === 'name'
    ? out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    : out.sort((a, b) => b.at.localeCompare(a.at))
}

// Per kind, for the chosen course and search (not the chosen kind), so a type chip says what clicking it would show
export function countsByKind(items: LibraryItem[], v: View): Record<Kind, number> {
  const out = Object.fromEntries(KINDS.map(k => [k, 0])) as Record<Kind, number>
  for (const i of items) if (inCourse(i, v.course) && matches(i, v.q)) out[i.kind]++
  return out
}

export function countsByCourse(items: LibraryItem[]) {
  const byId: Record<string, number> = {}
  let none = 0
  for (const i of items) { if (i.course_id === null) none++; else byId[i.course_id] = (byId[i.course_id] ?? 0) + 1 }
  return { all: items.length, none, byId }
}

// A quiz belongs to its note, so it moves with it
export const isMovable = (i: Pick<LibraryItem, 'kind'>) => i.kind !== 'quiz'
