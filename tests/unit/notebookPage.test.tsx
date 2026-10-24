// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const push = vi.fn()
let id = 'nb1'
vi.mock('next/navigation', () => ({ useParams: () => ({ id }), useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => `/notebooks/${id}` }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let books: { id: string; name: string; course_id: string | null }[] = []
const updateNotebook = vi.fn(async (_sb: unknown, bid: string, p: { name?: string; course_id?: string | null }) => { books = books.map(b => (b.id === bid ? { ...b, ...p } : b)) })
const deleteNotebook = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/notebooks', () => ({ listNotebooks: async () => books, updateNotebook: (sb: unknown, i: string, p: object) => updateNotebook(sb, i, p), deleteNotebook: (...a: unknown[]) => deleteNotebook(...a) }))
const notes = [
  { id: 'n1', title: 'Krebs cycle', course_id: 'bio', updated_at: '2026-10-20T10:00:00Z', notebook_id: 'nb1' },
  { id: 'n2', title: 'Glycolysis', course_id: 'bio', updated_at: '2026-10-21T10:00:00Z', notebook_id: 'nb1' },
  { id: 'n3', title: 'Elsewhere', course_id: null, updated_at: '2026-10-22T10:00:00Z', notebook_id: null },
]
const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'new' }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => notes, createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }] }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import NotebookPage from '@/app/(app)/notebooks/[id]/page'

const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><NotebookPage /></ConfirmProvider></ToastProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => { id = 'nb1'; books = [{ id: 'nb1', name: 'Cell biology', course_id: null }]; push.mockClear(); createNote.mockClear(); updateNotebook.mockClear(); deleteNotebook.mockClear() })
afterEach(cleanup)

describe('a notebook\'s page', () => {
  it('shows the notebook: its cover in its course\'s colour, its name, course and count, and only its notes', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Cell biology' })).toBeTruthy()
    expect(screen.getByText('2 notes · Biology')).toBeTruthy() // the course its notes share
    expect((screen.getByTestId('notebook-cover').firstElementChild as HTMLElement).style.background).toBe('rgb(29, 158, 117)')
    const list = within(screen.getByRole('list', { name: 'Notes in Cell biology' }))
    expect(list.getAllByRole('link').map(a => a.getAttribute('href')).sort()).toEqual(['/notes/n1', '/notes/n2'])
    expect(screen.getByRole('link', { name: 'Notes' }).getAttribute('href')).toBe('/notes')
  })
  it('makes a new note in this notebook and its course, and opens it', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'New note' }))
    expect(createNote).toHaveBeenCalledWith({}, { notebook_id: 'nb1', course_id: 'bio' })
    expect(push).toHaveBeenCalledWith('/notes/new')
  })
  it('renames it and changes its course, which changes its colour', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Rename' }))
    const d = within(screen.getByRole('dialog', { name: 'Rename notebook' }))
    fireEvent.change(d.getByLabelText('Name'), { target: { value: 'Organic' } })
    fireEvent.change(d.getByLabelText('Course'), { target: { value: 'chem' } })
    await click(d.getByRole('button', { name: 'Save' }))
    expect(updateNotebook).toHaveBeenCalledWith({}, 'nb1', { name: 'Organic', course_id: 'chem' })
    expect(screen.getByRole('heading', { level: 1, name: 'Organic' })).toBeTruthy()
    expect((screen.getByTestId('notebook-cover').firstElementChild as HTMLElement).style.background).toBe('rgb(186, 117, 23)')
  })
  it('deletes it after asking, keeping its notes, and goes back to Notes', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Delete notebook' }))
    expect(screen.getByText(/notes are kept/i)).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteNotebook).toHaveBeenCalledWith({}, 'nb1')
    expect(push).toHaveBeenCalledWith('/notes')
  })
  it('searches its notes', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Search this notebook'), { target: { value: 'krebs' } })
    expect(within(screen.getByRole('list', { name: 'Notes in Cell biology' })).getAllByRole('link')).toHaveLength(1)
  })
  it('says when it is empty, and when it does not exist', async () => {
    books = [{ id: 'nb1', name: 'Cell biology', course_id: null }, { id: 'empty', name: 'Empty', course_id: null }]
    id = 'empty'
    await open()
    expect(screen.getByText('No notes in this notebook yet.')).toBeTruthy()
    cleanup()
    id = 'gone'
    await open()
    expect(screen.getByRole('heading', { name: 'Notebook not found' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Notes' }).getAttribute('href')).toBe('/notes')
  })
})
