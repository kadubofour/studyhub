// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ToastProvider } from '@/components/providers/ToastProvider'

const push = vi.fn()
let createFails = false
const createNote = vi.fn(async (..._a: unknown[]) => { if (createFails) throw new Error('offline'); return { id: 'n9' } })
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { QuickActions } from '@/components/quick/QuickActions'

beforeEach(() => { push.mockClear(); createNote.mockClear(); createFails = false })
afterEach(cleanup)

describe('NewNoteButton', () => {
  const open = () => render(<ToastProvider><NewNoteButton courseId="bio" className="x" /></ToastProvider>)
  it('makes a note in the course and opens it', async () => {
    open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New note' })) })
    expect(createNote).toHaveBeenCalledWith({}, { course_id: 'bio' })
    expect(push).toHaveBeenCalledWith('/notes/n9')
  })
  it('makes no course note when no course is given', async () => {
    render(<ToastProvider><NewNoteButton className="x" /></ToastProvider>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New note' })) })
    expect(createNote).toHaveBeenCalledWith({}, { course_id: null })
  })
  it('makes one note, however many times it is tapped', async () => {
    open()
    const b = screen.getByRole('button', { name: 'New note' })
    await act(async () => { fireEvent.click(b); fireEvent.click(b) })
    expect(createNote).toHaveBeenCalledTimes(1)
  })
  it('says so and stays put when it cannot', async () => {
    createFails = true
    open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New note' })) })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByText(/couldn.t create a note/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'New note' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('QuickActions', () => {
  it('is a named row of links and buttons', () => {
    const onClick = vi.fn()
    render(<QuickActions label="Quick actions" actions={[{ label: 'New deck', href: '/flashcards?new=1' }, { label: 'Scan', onClick }]} />)
    const group = screen.getByRole('group', { name: 'Quick actions' })
    expect(group).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New deck' }).getAttribute('href')).toBe('/flashcards?new=1')
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
  it('can hold any element, such as the New note button', () => {
    render(<ToastProvider><QuickActions label="Quick actions" actions={[{ node: <NewNoteButton className="x" key="n" /> }]} /></ToastProvider>)
    expect(screen.getByRole('button', { name: 'New note' })).toBeTruthy()
  })
})
