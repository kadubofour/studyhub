import { localStore, useLocalStore, type LocalStore } from '@/lib/ui/localStore'

// How a list page shows its items: as a grid of tiles or as a list of rows, and in what order. Kept on this device, per page.
export type Layout = 'grid' | 'list' | 'icons'
export type ViewPage = 'notes' | 'decks' | 'lectures' | 'library'
export interface View { layout: Layout; sort: string }

export const VIEW_CHOICES: Record<ViewPage, { layout: Layout; sorts: { value: string; label: string }[] }> = {
  notes: { layout: 'grid', sorts: [{ value: 'edited', label: 'Recently edited' }, { value: 'title', label: 'Title (A to Z)' }, { value: 'course', label: 'Course' }] },
  decks: { layout: 'grid', sorts: [{ value: 'due', label: 'Most due' }, { value: 'name', label: 'Name (A to Z)' }, { value: 'newest', label: 'Newest' }] },
  lectures: { layout: 'grid', sorts: [{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'title', label: 'Title (A to Z)' }] },
  // the Library keeps its own sort chips; only its layout is kept here
  library: { layout: 'grid', sorts: [{ value: 'recent', label: 'Newest first' }] },
}

/** A stored value made safe: a known layout and one of the page's sorts, else the page's defaults */
export function parseView(page: ViewPage, v: unknown): View {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const c = VIEW_CHOICES[page]
  return {
    layout: o.layout === 'grid' || o.layout === 'list' || o.layout === 'icons' ? o.layout : c.layout,
    sort: c.sorts.some(s => s.value === o.sort) ? (o.sort as string) : c.sorts[0].value,
  }
}

const stores = new Map<ViewPage, LocalStore<View>>()
export function viewStore(page: ViewPage): LocalStore<View> {
  if (!stores.has(page)) stores.set(page, localStore<View>(`studyhub.view.${page}`, parseView(page, null), v => parseView(page, v)))
  return stores.get(page)!
}
export const useView = (page: ViewPage) => useLocalStore(viewStore(page))

// Names compared the way people read them: case ignored, numbers as numbers ("Week 2" before "Week 10")
const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare
const newestFirst = (a: string | undefined, b: string | undefined) => (b ?? '').localeCompare(a ?? '')

export function sortNotes<T extends { title: string; updated_at: string; course_id: string | null }>(notes: T[], sort: string, courseNames: Record<string, string>): T[] {
  const list = [...notes]
  const byTitle = (a: T, b: T) => (!a.title !== !b.title ? (a.title ? -1 : 1) : byName(a.title, b.title)) // untitled last
  if (sort === 'title') return list.sort(byTitle)
  if (sort === 'course') {
    // by course name (no course last), then by title within a course
    const name = (n: T) => (n.course_id && courseNames[n.course_id]) || ''
    return list.sort((a, b) => (!name(a) !== !name(b) ? (name(a) ? -1 : 1) : byName(name(a), name(b)) || byTitle(a, b)))
  }
  return list.sort((a, b) => newestFirst(a.updated_at, b.updated_at))
}

export function sortDecks<T extends { name: string; due: number; created_at?: string }>(decks: T[], sort: string): T[] {
  const list = [...decks]
  if (sort === 'name') return list.sort((a, b) => byName(a.name, b.name))
  if (sort === 'newest') return list.sort((a, b) => newestFirst(a.created_at, b.created_at))
  return list.sort((a, b) => b.due - a.due || byName(a.name, b.name))
}

export function sortLectures<T extends { title: string; recorded_at: string }>(lectures: T[], sort: string): T[] {
  const list = [...lectures]
  if (sort === 'oldest') return list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  if (sort === 'title') return list.sort((a, b) => byName(a.title, b.title))
  return list.sort((a, b) => newestFirst(a.recorded_at, b.recorded_at))
}
