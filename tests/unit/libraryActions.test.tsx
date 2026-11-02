// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { LibraryItem } from '@/lib/library/items'

const push = vi.fn()
const item = (kind: LibraryItem['kind'], id: string, title: string, over: Partial<LibraryItem> = {}): LibraryItem =>
  ({ kind, id, title, course_id: 'bio', at: '2026-10-10T10:00:00Z', meta: '', href: `/${kind}/${id}`, ...over })
let items: LibraryItem[]
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('view=all'), useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }], createCourse: vi.fn(), updateCourse: vi.fn(), deleteCourse: vi.fn() }))
vi.mock('@/lib/data/library', () => ({ loadLibrary: async () => items, moveItems: vi.fn() }))
vi.mock('@/lib/data/notebooks', () => ({ listNotebooks: async () => [], createNotebook: vi.fn(), renameNotebook: vi.fn(), deleteNotebook: vi.fn(), moveNotes: vi.fn() }))
vi.mock('@/lib/scan/events', () => ({ requestUpload: vi.fn() }))
const findChat = vi.fn(), createChat = vi.fn()
vi.mock('@/lib/data/tutor', () => ({ findChat: (...a: unknown[]) => findChat(...a), createChat: (...a: unknown[]) => createChat(...a) }))
import LibraryPage from '@/app/(app)/library/page'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><LibraryPage /></ConfirmProvider></ToastProvider>) }) }
const menuOf = (title: string) => { fireEvent.click(screen.getByRole('button', { name: `More actions for ${title}` })); return within(screen.getByRole('menu')) }
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => {
  push.mockClear(); findChat.mockReset(); createChat.mockReset()
  items = [
    item('note', 'n1', 'Krebs cycle', { blurb: 'The cycle runs in the matrix.' }),
    item('deck', 'd1', 'Cells', { meta: '12 cards' }),
    item('lecture', 'l1', 'Week 3', { meta: '45 min' }),
    item('quiz', 'q1', 'Krebs quiz', { blurb: 'From Krebs cycle' }),
  ]
})
afterEach(cleanup)

describe('Library: finding things', () => {
  it('keeps the search, the kinds with their counts, and the order in a column of their own, with Everything first', async () => {
    await open()
    const side = within(screen.getByRole('complementary', { name: 'Find and filter' }))
    expect(side.getByLabelText('Search the library')).toBeTruthy()
    const kinds = within(side.getByRole('group', { name: 'Kinds' }))
    expect(kinds.getAllByRole('button').map(b => b.textContent)).toEqual(['Everything 4', 'Notes 1', 'Decks 1', 'Lectures 1', 'Quizzes 1', 'Tutor chats 0', 'Files 0'])
    expect(kinds.getByRole('button', { name: /Everything/ }).getAttribute('aria-pressed')).toBe('true')
  })
  it('narrows to a kind, and Everything brings the rest back', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /^Decks/ }))
    expect(screen.queryByRole('link', { name: /^Krebs cycle/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Cells/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Everything/ }))
    expect(screen.getByRole('link', { name: /^Krebs cycle/ })).toBeTruthy()
  })
})

describe('Library: seeing what is inside', () => {
  it('shows what a note and a quiz are about under their names', async () => {
    await open()
    expect(screen.getByText('The cycle runs in the matrix.')).toBeTruthy()
    expect(screen.getByText('From Krebs cycle')).toBeTruthy()
  })
})

describe('Library: acting on an item', () => {
  it('offers a note its study actions, which open it with that tab ready', async () => {
    await open()
    const menu = menuOf('Krebs cycle')
    expect(menu.getAllByRole('menuitem').map(m => m.textContent)).toEqual(['Open', 'Ask the tutor', 'Make flashcards', 'Quiz me', 'Summarise'])
    fireEvent.click(menu.getByRole('menuitem', { name: 'Make flashcards' }))
    expect(push).toHaveBeenCalledWith('/note/n1?study=cards')
  })
  it('opens the chat about a note, or starts it', async () => {
    findChat.mockResolvedValue(null); createChat.mockResolvedValue({ id: 'chat9' })
    await open()
    const first = menuOf('Krebs cycle')
    await act(async () => { fireEvent.click(first.getByRole('menuitem', { name: 'Ask the tutor' })) })
    expect(createChat).toHaveBeenCalledWith({}, { title: 'Krebs cycle', note_id: 'n1', course_id: 'bio' })
    expect(push).toHaveBeenCalledWith('/tutor/chat9')
    cleanup(); push.mockClear(); await open()
    findChat.mockResolvedValue({ id: 'old' })
    const second = menuOf('Krebs cycle')
    await act(async () => { fireEvent.click(second.getByRole('menuitem', { name: 'Ask the tutor' })) })
    expect(push).toHaveBeenCalledWith('/tutor/old')
  })
  it('offers a lecture the tutor, and everything else only Open (Take for a quiz)', async () => {
    await open()
    expect(menuOf('Week 3').getAllByRole('menuitem').map(m => m.textContent)).toEqual(['Open', 'Ask the tutor'])
    cleanup(); await open()
    expect(menuOf('Cells').getAllByRole('menuitem').map(m => m.textContent)).toEqual(['Open'])
    cleanup(); await open()
    expect(menuOf('Krebs quiz').getAllByRole('menuitem').map(m => m.textContent)).toEqual(['Take'])
  })
})
