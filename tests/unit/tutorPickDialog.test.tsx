// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

let notesImpl: () => Promise<unknown[]>
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ listNotes: () => notesImpl() }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [{ id: 'l1', title: 'Week 3 lecture', course_id: 'bio' }] }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }] }))
import { TutorPickDialog } from '@/components/tutor/TutorPickDialog'

beforeEach(() => {
  notesImpl = async () => [{ id: 'n1', title: 'Krebs cycle', course_id: 'bio' }, { id: 'n2', title: 'Organic reactions', course_id: 'chem' }, { id: 'n3', title: 'Loose note', course_id: null }]
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)
const open = async (props: Partial<React.ComponentProps<typeof TutorPickDialog>> = {}) => {
  const onPick = vi.fn()
  await act(async () => { render(<TutorPickDialog open onClose={vi.fn()} onPick={onPick} {...props} />) })
  return onPick
}

describe('TutorPickDialog', () => {
  it('lists the notes first, with their course, and picks one', async () => {
    const onPick = await open()
    const list = screen.getByRole('list', { name: 'Notes' })
    expect(within(list).getAllByRole('button').map(b => b.textContent)).toEqual(['Krebs cycleBiology', 'Organic reactionsChemistry', 'Loose note'])
    fireEvent.click(within(list).getByRole('button', { name: /Krebs cycle/ }))
    expect(onPick).toHaveBeenCalledWith({ kind: 'note', id: 'n1', title: 'Krebs cycle', course_id: 'bio' })
  })

  it('switches to lectures and to whole courses', async () => {
    const onPick = await open()
    fireEvent.click(screen.getByRole('radio', { name: 'Lectures' }))
    fireEvent.click(within(screen.getByRole('list', { name: 'Lectures' })).getByRole('button', { name: /Week 3 lecture/ }))
    expect(onPick).toHaveBeenLastCalledWith({ kind: 'lecture', id: 'l1', title: 'Week 3 lecture', course_id: 'bio' })
    fireEvent.click(screen.getByRole('radio', { name: 'Courses' }))
    fireEvent.click(within(screen.getByRole('list', { name: 'Courses' })).getByRole('button', { name: 'Chemistry' }))
    expect(onPick).toHaveBeenLastCalledWith({ kind: 'course', id: 'chem', title: 'Chemistry', course_id: 'chem' })
  })

  it('searches the list, and says when nothing matches', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'KREBS' } })
    expect(within(screen.getByRole('list', { name: 'Notes' })).getAllByRole('button')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches.')).toBeTruthy()
  })

  it('offers only the kinds it is given: no tabs for a single one', async () => {
    await open({ kinds: ['note', 'lecture'] })
    expect(screen.queryByRole('radio', { name: 'Courses' })).toBeNull()
    cleanup()
    await open({ kinds: ['note'] })
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('says so when there are none, and when loading fails', async () => {
    notesImpl = async () => []
    await open()
    expect(screen.getByText('No notes yet.')).toBeTruthy()
    cleanup()
    notesImpl = async () => { throw new Error('offline') }
    await open()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn.t load/)
  })
})
