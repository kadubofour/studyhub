// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const note = (id: string, title: string, notebook_id: string | null = null) => ({ id, title, course_id: null, updated_at: new Date().toISOString(), notebook_id })
let notes = [note('a', 'Krebs cycle', 'b1'), note('b', 'Mitosis', 'b1'), note('c', 'Newton', 'b2'), note('d', 'Loose note')]
let books = [{ id: 'b1', name: 'Biology' }, { id: 'b2', name: 'Physics' }]
const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'n' }))
const createNotebook = vi.fn(async (_sb: unknown, name: string) => { const b = { id: 'b3', name }; books = [...books, b]; return b })
const renameNotebook = vi.fn(async (..._a: unknown[]) => {})
const deleteNotebook = vi.fn(async (..._a: unknown[]) => {})
const moveNotes = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({
  listNotes: async () => notes, createNote: (...a: unknown[]) => createNote(...a), searchNotes: async () => [], getNotesForExport: async () => [], deleteNote: vi.fn(),
}))
vi.mock('@/lib/data/notebooks', () => ({
  listNotebooks: async () => books,
  createNotebook: (sb: unknown, name: string) => createNotebook(sb, name),
  renameNotebook: (...a: unknown[]) => renameNotebook(...a),
  deleteNotebook: (...a: unknown[]) => deleteNotebook(...a),
  moveNotes: (...a: unknown[]) => moveNotes(...a),
}))
vi.mock('@/lib/export/exportNotes', () => ({ exportNotesToWord: vi.fn(async () => true), openPdfExport: vi.fn() }))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/notes' }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { NotesSidebar } from '@/components/notes/NotesSidebar'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import type { Profile } from '@/lib/types'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => {
  notes = [note('a', 'Krebs cycle', 'b1'), note('b', 'Mitosis', 'b1'), note('c', 'Newton', 'b2'), note('d', 'Loose note')]
  books = [{ id: 'b1', name: 'Biology' }, { id: 'b2', name: 'Physics' }]
  for (const f of [createNote, createNotebook, renameNotebook, deleteNotebook, moveNotes]) f.mockClear()
})
afterEach(cleanup)

const open = async () => {
  await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><NotesSidebar /></ConfirmProvider></ToastProvider></ProfileProvider>) })
  await screen.findByText('Krebs cycle')
}
const bar = () => within(screen.getByRole('radiogroup', { name: 'Notebook' }))

describe('the notebook bar', () => {
  it('shows All, each notebook and the unfiled notes, with how many are in each', async () => {
    await open()
    expect(bar().getAllByRole('radio').map(r => r.textContent)).toEqual(['All (4)', 'Biology (2)', 'Physics (1)', 'Unfiled (1)'])
  })
  it('choosing a notebook shows only its notes, and Unfiled shows the rest', async () => {
    await open()
    fireEvent.click(bar().getByRole('radio', { name: /^Biology/ }))
    expect(screen.getByText('Mitosis')).toBeTruthy()
    expect(screen.queryByText('Newton')).toBeNull()
    fireEvent.click(bar().getByRole('radio', { name: /^Unfiled/ }))
    expect(screen.getByText('Loose note')).toBeTruthy()
    expect(screen.queryByText('Krebs cycle')).toBeNull()
  })
  it('with no notebooks yet it only offers to make one', async () => {
    books = []; notes = notes.map(n => ({ ...n, notebook_id: null }))
    await open()
    expect(screen.queryByRole('radiogroup', { name: 'Notebook' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeTruthy()
  })
  it('a note says which notebook it is in when looking at All', async () => {
    await open()
    expect(within(screen.getByRole('link', { name: /Newton/ })).getByText('Physics')).toBeTruthy()
    expect(within(screen.getByRole('link', { name: /Loose note/ })).queryByText('Physics')).toBeNull()
  })
})

describe('making, renaming and deleting a notebook', () => {
  it('makes one, and shows it chosen', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'New notebook' }))
    const dialog = screen.getByRole('dialog', { name: 'New notebook' })
    expect((within(dialog).getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: '  Chemistry ' } })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })) })
    expect(createNotebook).toHaveBeenCalledWith(expect.anything(), 'Chemistry')
    expect(bar().getByRole('radio', { name: /^Chemistry \(0\)/ }).getAttribute('aria-checked')).toBe('true')
  })
  it('a note made while a notebook is chosen goes into it', async () => {
    await open()
    fireEvent.click(bar().getByRole('radio', { name: /^Physics/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Note' })) })
    expect(createNote).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ notebook_id: 'b2' }))
  })
  it('renames the chosen notebook', async () => {
    await open()
    fireEvent.click(bar().getByRole('radio', { name: /^Physics/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename notebook' }))
    const dialog = screen.getByRole('dialog', { name: 'Rename notebook' })
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Physics 101' } })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })) })
    expect(renameNotebook).toHaveBeenCalledWith(expect.anything(), 'b2', 'Physics 101')
    expect(bar().getByRole('radio', { name: /^Physics 101/ })).toBeTruthy()
  })
  it('deletes the chosen notebook after asking, keeps its notes as unfiled, and goes back to All', async () => {
    await open()
    fireEvent.click(bar().getByRole('radio', { name: /^Physics/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete notebook' })) })
    expect(screen.getByText(/notes are kept/i)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
    expect(deleteNotebook).toHaveBeenCalledWith(expect.anything(), 'b2')
    expect(bar().queryByRole('radio', { name: /^Physics/ })).toBeNull()
    expect(bar().getByRole('radio', { name: /^All/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Newton')).toBeTruthy() // still there
    expect(bar().getByRole('radio', { name: /^Unfiled \(2\)/ })).toBeTruthy()
  })
  it('does not delete when the student says no', async () => {
    await open()
    fireEvent.click(bar().getByRole('radio', { name: /^Physics/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete notebook' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(deleteNotebook).not.toHaveBeenCalled()
  })
})

describe('moving notes into a notebook', () => {
  it('moves one note from its menu, and its tile shows the notebook', async () => {
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Loose note/ }), { clientX: 10, clientY: 10 }) })
    fireEvent.click(within(screen.getByRole('menu', { name: 'Loose note' })).getByRole('menuitem', { name: /Move to notebook/ }))
    const dialog = screen.getByRole('dialog', { name: 'Move to notebook' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Physics' })) })
    expect(moveNotes).toHaveBeenCalledWith(expect.anything(), ['d'], 'b2')
    expect(within(screen.getByRole('link', { name: /Loose note/ })).getByText('Physics')).toBeTruthy()
    expect(bar().getByRole('radio', { name: /^Physics \(2\)/ })).toBeTruthy()
  })
  it('moves several selected notes at once, and can take them out of a notebook', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Krebs cycle' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Mitosis' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move to notebook' }))
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: 'Move to notebook' })).getByRole('button', { name: 'No notebook' })) })
    expect(moveNotes).toHaveBeenCalledWith(expect.anything(), ['a', 'b'], null)
    expect(bar().getByRole('radio', { name: /^Unfiled \(3\)/ })).toBeTruthy()
  })
  it('can make a new notebook right there and put the note in it', async () => {
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Loose note/ }), { clientX: 10, clientY: 10 }) })
    fireEvent.click(within(screen.getByRole('menu', { name: 'Loose note' })).getByRole('menuitem', { name: /Move to notebook/ }))
    const dialog = screen.getByRole('dialog', { name: 'Move to notebook' })
    fireEvent.change(within(dialog).getByLabelText('New notebook'), { target: { value: 'History' } })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Create and move' })) })
    expect(createNotebook).toHaveBeenCalledWith(expect.anything(), 'History')
    expect(moveNotes).toHaveBeenCalledWith(expect.anything(), ['d'], 'b3')
  })
  it('says so and changes nothing when the move fails', async () => {
    moveNotes.mockRejectedValueOnce(new Error('offline'))
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Loose note/ }), { clientX: 10, clientY: 10 }) })
    fireEvent.click(within(screen.getByRole('menu', { name: 'Loose note' })).getByRole('menuitem', { name: /Move to notebook/ }))
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: 'Move to notebook' })).getByRole('button', { name: 'Physics' })) })
    expect(screen.getByText(/Couldn.t move/)).toBeTruthy()
    expect(bar().getByRole('radio', { name: /^Unfiled \(1\)/ })).toBeTruthy()
  })
})
