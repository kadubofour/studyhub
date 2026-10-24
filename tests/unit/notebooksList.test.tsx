// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const note = (id: string, title: string, notebook_id: string | null = null, course_id: string | null = null) => ({ id, title, course_id, updated_at: new Date().toISOString(), notebook_id })
let notes = [note('a', 'Krebs cycle', 'b1'), note('b', 'Mitosis', 'b1'), note('c', 'Newton', 'b2'), note('d', 'Loose note')]
let books: { id: string; name: string; course_id?: string | null }[] = [{ id: 'b1', name: 'Biology' }, { id: 'b2', name: 'Physics' }]
let courses: { id: string; name: string; color: string }[] = []
const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'n' }))
const createNotebook = vi.fn(async (_sb: unknown, name: string, course_id: string | null = null) => { const b = { id: 'b3', name, course_id }; books = [...books, b]; return b })
const renameNotebook = vi.fn(async (..._a: unknown[]) => {})
const deleteNotebook = vi.fn(async (..._a: unknown[]) => {})
const moveNotes = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => courses }))
vi.mock('@/lib/data/notes', () => ({
  listNotes: async () => notes, createNote: (...a: unknown[]) => createNote(...a), searchNotes: async () => [], getNotesForExport: async () => [], deleteNote: vi.fn(),
}))
vi.mock('@/lib/data/notebooks', () => ({
  listNotebooks: async () => books,
  createNotebook: (sb: unknown, name: string, c?: string | null) => createNotebook(sb, name, c),
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
  courses = []
  for (const f of [createNote, createNotebook, renameNotebook, deleteNotebook, moveNotes]) f.mockClear()
})
afterEach(cleanup)

const open = async () => {
  await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><NotesSidebar /></ConfirmProvider></ToastProvider></ProfileProvider>) })
  await screen.findByText('Krebs cycle')
}
const shelf = () => within(screen.getByRole('list', { name: 'Notebooks' }))

describe('the notebooks on the Notes page', () => {
  it('are covers that open each notebook\'s page, with how many notes it holds, and New notebook beside them', async () => {
    await open()
    expect(shelf().getAllByRole('link').map(a => [a.getAttribute('aria-label'), a.getAttribute('href')])).toEqual([
      ['Open Biology, 2 notes', '/notebooks/b1'], ['Open Physics, 1 note', '/notebooks/b2'],
    ])
    expect(shelf().getAllByRole('link')[0].querySelector('[data-notebook-cover]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeTruthy()
  })
  it('take the colour of their course, or the accent with none', async () => {
    courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
    books = [{ id: 'b1', name: 'Biology', course_id: 'bio' }, { id: 'b2', name: 'Physics' }]
    await open()
    const [bio, physics] = shelf().getAllByRole('link').map(a => (a.querySelector('[data-notebook-cover]') as HTMLElement).style.background)
    expect(bio).toBe('rgb(29, 158, 117)')
    expect(physics).toBe('var(--accent-solid)')
  })
  it('the list below shows every note, each saying which notebook it is in', async () => {
    await open()
    for (const t of ['Krebs cycle', 'Mitosis', 'Newton', 'Loose note']) expect(screen.getByText(t)).toBeTruthy()
    expect(within(screen.getByRole('link', { name: /Krebs cycle/ })).getByText('Biology')).toBeTruthy()
  })
  it('with no notebooks yet it only offers to make one', async () => {
    books = []; notes = notes.map(n => ({ ...n, notebook_id: null }))
    await open()
    expect(screen.queryByRole('list', { name: 'Notebooks' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeTruthy()
  })
  it('makes a notebook, in the course the list is filtered to, and shows it', async () => {
    courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
    await open()
    fireEvent.change(screen.getByLabelText('Filter by course'), { target: { value: 'bio' } })
    fireEvent.click(screen.getByRole('button', { name: 'New notebook' }))
    const d = within(screen.getByRole('dialog', { name: 'New notebook' }))
    expect((d.getByLabelText('Course') as HTMLSelectElement).value).toBe('bio')
    fireEvent.change(d.getByLabelText('Name'), { target: { value: 'Chemistry' } })
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Create' })) })
    expect(createNotebook).toHaveBeenCalledWith(expect.anything(), 'Chemistry', 'bio')
    expect(shelf().getByRole('link', { name: 'Open Chemistry, 0 notes' })).toBeTruthy()
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
    expect(shelf().getByRole('link', { name: 'Open Physics, 2 notes' })).toBeTruthy()
  })
  it('moves several selected notes at once, and can take them out of a notebook', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Krebs cycle' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Mitosis' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move to notebook' }))
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: 'Move to notebook' })).getByRole('button', { name: 'No notebook' })) })
    expect(moveNotes).toHaveBeenCalledWith(expect.anything(), ['a', 'b'], null)
    expect(shelf().getByRole('link', { name: 'Open Biology, 0 notes' })).toBeTruthy()
  })
  it('can make a new notebook right there and put the note in it', async () => {
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Loose note/ }), { clientX: 10, clientY: 10 }) })
    fireEvent.click(within(screen.getByRole('menu', { name: 'Loose note' })).getByRole('menuitem', { name: /Move to notebook/ }))
    const dialog = screen.getByRole('dialog', { name: 'Move to notebook' })
    fireEvent.change(within(dialog).getByLabelText('New notebook'), { target: { value: 'History' } })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Create and move' })) })
    expect(createNotebook).toHaveBeenCalledWith(expect.anything(), 'History', null)
    expect(moveNotes).toHaveBeenCalledWith(expect.anything(), ['d'], 'b3')
  })
  it('makes the notebook once even if Create and move is pressed twice, and keeps it in the list if the move fails', async () => {
    moveNotes.mockRejectedValueOnce(new Error('offline'))
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Loose note/ }), { clientX: 10, clientY: 10 }) })
    fireEvent.click(within(screen.getByRole('menu', { name: 'Loose note' })).getByRole('menuitem', { name: /Move to notebook/ }))
    const dialog = screen.getByRole('dialog', { name: 'Move to notebook' })
    fireEvent.change(within(dialog).getByLabelText('New notebook'), { target: { value: 'History' } })
    await act(async () => {
      fireEvent.submit(within(dialog).getByLabelText('New notebook').closest('form')!)
      fireEvent.submit(within(dialog).getByLabelText('New notebook').closest('form')!)
    })
    expect(createNotebook).toHaveBeenCalledTimes(1)
    expect(shelf().getByRole('link', { name: /^Open History/ })).toBeTruthy() // the notebook exists, so it is shown
  })
  it('says so and changes nothing when the move fails', async () => {
    moveNotes.mockRejectedValueOnce(new Error('offline'))
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Loose note/ }), { clientX: 10, clientY: 10 }) })
    fireEvent.click(within(screen.getByRole('menu', { name: 'Loose note' })).getByRole('menuitem', { name: /Move to notebook/ }))
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: 'Move to notebook' })).getByRole('button', { name: 'Physics' })) })
    expect(screen.getByText(/Couldn.t move/)).toBeTruthy()
    expect(shelf().getByRole('link', { name: 'Open Physics, 1 note' })).toBeTruthy()
  })
})

async function heard(act: () => void | Promise<void>) {
  const { OPEN_REMINDER } = await import('@/lib/reminders/events')
  const got: unknown[] = []
  const on = (e: Event) => got.push((e as CustomEvent).detail)
  window.addEventListener(OPEN_REMINDER, on)
  await act()
  window.removeEventListener(OPEN_REMINDER, on)
  return got
}

describe('Remind me on a note', () => {
  it('asks for a reminder to review the note, which opens the note', async () => {
    await open()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Krebs cycle/ }), { clientX: 10, clientY: 10 }) })
    const got = await heard(() => { fireEvent.click(within(screen.getByRole('menu', { name: 'Krebs cycle' })).getByRole('menuitem', { name: /Remind me/ })) })
    expect(got).toEqual([{ title: 'Review Krebs cycle', href: '/notes/a', link_label: 'Krebs cycle' }])
  })
})

describe('the Notes page on a phone', () => {
  it('leaves Upload to the Create button there, so the actions fit on one row', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Upload' }).className).toContain('max-sm:hidden')
  })
})
