import type { Notebook } from '@/lib/types'

export type Kind = 'note' | 'deck' | 'lecture' | 'quiz' | 'chat'
export type LibraryItem = { kind: Kind; id: string; title: string; course_id: string | null; at: string; meta: string; href: string; due?: number; notebook_id?: string | null }
// course: 'all', 'none' (not in any course) or a course id; folder: the notebook open, if one is
export type View = { course: 'all' | 'none' | string; kind: Kind | null; q: string; sort: 'recent' | 'name'; folder?: string | null }

const KINDS: Kind[] = ['note', 'deck', 'lecture', 'quiz', 'chat']

const inCourse = (i: LibraryItem, course: View['course']) => course === 'all' || (course === 'none' ? i.course_id === null : i.course_id === course)
const matches = (i: LibraryItem, q: string) => !q.trim() || i.title.toLowerCase().includes(q.trim().toLowerCase())

// Browsing is looking around with no search and no kind chosen: then notebooks are folders, and a note in one is inside it.
// Searching or choosing a kind finds things wherever they are.
const browsing = (v: View) => v.kind === null && !v.q.trim()
const filed = (i: LibraryItem) => i.kind === 'note' && !!i.notebook_id

// What the list shows: the open folder's notes, or the chosen course, kind and search, in the chosen order
export function visible(items: LibraryItem[], v: View): LibraryItem[] {
  const out = items.filter(i => inCourse(i, v.course) && matches(i, v.q) && (v.folder
    ? i.kind === 'note' && i.notebook_id === v.folder
    : (v.kind === null || i.kind === v.kind) && !(browsing(v) && filed(i))))
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

// The folders shown while browsing, by name, with how many notes each holds in the course shown.
// An empty notebook shows under All (so a new one can be found), not under a course it has nothing in.
export function folders(items: LibraryItem[], notebooks: Notebook[], v: View): { notebook: Notebook; count: number }[] {
  if (v.folder || !browsing(v)) return []
  const count: Record<string, number> = {}
  for (const i of items) if (filed(i) && inCourse(i, v.course)) count[i.notebook_id!] = (count[i.notebook_id!] ?? 0) + 1
  return notebooks
    .map(notebook => ({ notebook, count: count[notebook.id] ?? 0 }))
    .filter(f => v.course === 'all' || f.count > 0)
    .sort((a, b) => a.notebook.name.localeCompare(b.notebook.name, undefined, { sensitivity: 'base', numeric: true }))
}

// A note is only inside a folder the Library knows: one whose notebook is gone (or not read yet) is loose, so it never disappears
export function withKnownNotebooks(items: LibraryItem[], notebooks: Notebook[]): LibraryItem[] {
  const known = new Set(notebooks.map(b => b.id))
  return items.map(i => (i.notebook_id && !known.has(i.notebook_id) ? { ...i, notebook_id: null } : i))
}
