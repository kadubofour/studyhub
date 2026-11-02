// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const push = vi.fn()
let id = 'nb1'
vi.mock('next/navigation', () => ({ useParams: () => ({ id }), useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => `/notebooks/${id}` }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let books: { id: string; name: string; course_id: string | null; is_default?: boolean }[] = []
const updateNotebook = vi.fn(async (_sb: unknown, bid: string, p: { name?: string; course_id?: string | null }) => { books = books.map(b => (b.id === bid ? { ...b, ...p } : b)) })
const deleteNotebook = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/notebooks', () => ({ listNotebooks: async () => books, updateNotebook: (sb: unknown, i: string, p: object) => updateNotebook(sb, i, p), deleteNotebook: (...a: unknown[]) => deleteNotebook(...a) }))
const item = (kind: string, id: string, title: string, notebook: string | null, at: string, course: string | null = 'bio') => ({ kind, id, title, course_id: course, notebook_id: notebook, at, meta: '', href: kind === 'note' ? `/notes/${id}` : `/${kind}/${id}` })
const items = [
  item('note', 'n1', 'Krebs cycle', 'nb1', '2026-10-20T10:00:00Z'),
  item('note', 'n2', 'Glycolysis', 'nb1', '2026-10-21T10:00:00Z'),
  item('deck', 'd1', 'Enzymes deck', 'nb1', '2026-10-19T10:00:00Z'),
  item('file', 'f1', 'Lecture slides.pdf', 'nb1', '2026-10-18T10:00:00Z'),
  item('note', 'n3', 'Elsewhere', 'other', '2026-10-22T10:00:00Z', null),
]
const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'new' }))
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('@/lib/data/library', () => ({ loadLibrary: async () => items }))
const createDeck = vi.fn(async (..._a: unknown[]) => ({ id: 'newdeck' }))
vi.mock('@/lib/data/decks', () => ({ createDeck: (...a: unknown[]) => createDeck(...a) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }] }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import NotebookPage from '@/app/(app)/notebooks/[id]/page'
import { choose } from './dropdown'

const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><NotebookPage /></ConfirmProvider></ToastProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => { id = 'nb1'; books = [{ id: 'nb1', name: 'Cell biology', course_id: null }]; push.mockClear(); createNote.mockClear(); createDeck.mockClear(); updateNotebook.mockClear(); deleteNotebook.mockClear() })
afterEach(cleanup)

describe('a notebook\'s page', () => {
  it('shows the notebook as a study set: its name, what is in it by kind, and each kind in its own section', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Cell biology' })).toBeTruthy()
    expect(screen.getByText('2 notes · 1 deck · 1 material')).toBeTruthy()
    expect((screen.getByTestId('notebook-cover').firstElementChild as HTMLElement).style.background).toBe('rgb(29, 158, 117)')
    expect(within(screen.getByRole('list', { name: 'Notes in Cell biology' })).getAllByRole('link').map(a => a.getAttribute('href')).sort()).toEqual(['/notes/n1', '/notes/n2'])
    expect(within(screen.getByRole('list', { name: 'Decks in Cell biology' })).getAllByRole('link')).toHaveLength(1)
    expect(within(screen.getByRole('list', { name: 'Materials in Cell biology' })).getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByText('Elsewhere')).toBeNull() // in another notebook
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('href')).toBe('/library')
  })
  it('starts things inside it: a note, a recording, a deck and materials', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'New note' }))
    expect(createNote).toHaveBeenCalledWith({}, { notebook_id: 'nb1', course_id: null })
    expect(push).toHaveBeenCalledWith('/notes/new')
    expect(screen.getByRole('link', { name: /Record lecture/ }).getAttribute('href')).toBe('/lectures/record?notebook=nb1')
    await click(screen.getByRole('button', { name: /New deck/ }))
    const d = within(screen.getByRole('dialog', { name: 'New deck' }))
    fireEvent.change(d.getByLabelText('Name'), { target: { value: 'Cells' } })
    await click(d.getByRole('button', { name: 'Create' }))
    expect(createDeck).toHaveBeenCalledWith({}, { name: 'Cells', notebook_id: 'nb1', course_id: null })
    expect(push).toHaveBeenCalledWith('/flashcards/newdeck')
    expect(screen.getByRole('button', { name: 'Materials' })).toBeTruthy()
  })
  it('renames it and changes its course, which changes its colour', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Rename' }))
    const d = within(screen.getByRole('dialog', { name: 'Rename notebook' }))
    fireEvent.change(d.getByLabelText('Name'), { target: { value: 'Organic' } })
    choose('Course', 'Chemistry')
    await click(d.getByRole('button', { name: 'Save' }))
    expect(updateNotebook).toHaveBeenCalledWith({}, 'nb1', { name: 'Organic', course_id: 'chem' })
    expect(screen.getByRole('heading', { level: 1, name: 'Organic' })).toBeTruthy()
    expect((screen.getByTestId('notebook-cover').firstElementChild as HTMLElement).style.background).toBe('rgb(186, 117, 23)')
  })
  it('deletes it after asking, moving everything to General, and goes back to the Library', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Delete notebook' }))
    expect(screen.getByText(/moves to General/i)).toBeTruthy()
    await click(screen.getByRole('button', { name: /^Delete$/ }))
    expect(deleteNotebook).toHaveBeenCalledWith({}, 'nb1')
    expect(push).toHaveBeenCalledWith('/library')
  })
  it('cannot delete General', async () => {
    books = [{ id: 'nb1', name: 'General', course_id: null, is_default: true }]
    await open()
    expect(screen.queryByRole('button', { name: 'Delete notebook' })).toBeNull()
  })
  it('searches what is inside it', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Search this notebook'), { target: { value: 'krebs' } })
    expect(within(screen.getByRole('list', { name: 'Notes in Cell biology' })).getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('list', { name: 'Decks in Cell biology' })).toBeNull()
  })
  it('says when it is empty, and when it does not exist', async () => {
    books = [{ id: 'nb1', name: 'Cell biology', course_id: null }, { id: 'empty', name: 'Empty', course_id: null }]
    id = 'empty'
    await open()
    expect(screen.getByText(/Nothing in this notebook yet/)).toBeTruthy()
    cleanup()
    id = 'gone'
    await open()
    expect(screen.getByRole('heading', { name: 'Notebook not found' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Library' }).getAttribute('href')).toBe('/library')
  })
})
