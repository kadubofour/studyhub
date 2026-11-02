import type { Course, Notebook } from '@/lib/types'
import { notebookColor } from '@/lib/notes/notebooks'
import type { Kind, LibraryItem } from './items'

// What each notebook card on the Library shows: what is in it, by kind, and when anything in it last changed.

export type CardKind = Extract<Kind, 'note' | 'deck' | 'lecture' | 'file' | 'quiz'>
export const CARD_KINDS: { kind: CardKind; one: string }[] = [
  { kind: 'note', one: 'note' }, { kind: 'deck', one: 'deck' }, { kind: 'lecture', one: 'lecture' }, { kind: 'file', one: 'material' }, { kind: 'quiz', one: 'quiz' },
]
export type NotebookSort = 'recent' | 'name' | 'size'
export type NotebookCard = { notebook: Notebook; counts: Record<CardKind, number>; total: number; lastAt: string | null; color: string }

const isCardKind = (k: Kind): k is CardKind => CARD_KINDS.some(c => c.kind === k)

export function notebookCards(input: { notebooks: Notebook[]; items: LibraryItem[]; courses: Course[]; q: string; sort: NotebookSort }): NotebookCard[] {
  const q = input.q.trim().toLowerCase()
  const notes = input.items.filter(i => i.kind === 'note').map(i => ({ notebook_id: i.notebook_id ?? null, course_id: i.course_id }))
  const cards = input.notebooks
    .filter(b => !q || b.name.toLowerCase().includes(q))
    .map<NotebookCard>(notebook => {
      const own = input.items.filter(i => i.notebook_id === notebook.id && isCardKind(i.kind))
      const counts = { note: 0, deck: 0, lecture: 0, file: 0, quiz: 0 } as Record<CardKind, number>
      for (const i of own) counts[i.kind as CardKind]++
      const lastAt = own.reduce<string | null>((latest, i) => (i.at && (!latest || i.at > latest) ? i.at : latest), null)
      return { notebook, counts, total: own.length, lastAt, color: notebookColor(notebook, notes, input.courses) }
    })
  const byName = (a: NotebookCard, b: NotebookCard) => a.notebook.name.localeCompare(b.notebook.name, undefined, { sensitivity: 'base' })
  return cards.sort(input.sort === 'name' ? byName
    : input.sort === 'size' ? (a, b) => b.total - a.total || byName(a, b)
      : (a, b) => (b.lastAt ?? b.notebook.created_at ?? '').localeCompare(a.lastAt ?? a.notebook.created_at ?? '') || byName(a, b))
}

/** "3 notes · 2 decks", or "Empty" */
export function contents(card: Pick<NotebookCard, 'counts'>): string {
  const parts = CARD_KINDS.filter(c => card.counts[c.kind] > 0).map(c => `${card.counts[c.kind]} ${c.one}${card.counts[c.kind] === 1 ? '' : 's'}`)
  return parts.join(' · ') || 'Empty'
}
