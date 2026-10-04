// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const createNote = vi.fn(async (...a: unknown[]) => { void a; return { id: 'n1' } })
const createCards = vi.fn(async (...a: unknown[]) => { void a; return [] })
const createCourse = vi.fn(async (...a: unknown[]) => ({ id: 'c-new', ...(a[1] as object) }))
const createTask = vi.fn(async (...a: unknown[]) => ({ id: 't', ...(a[1] as object) }))
const createClass = vi.fn(async (...a: unknown[]) => ({ id: 'k', ...(a[1] as object) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('@/lib/data/cards', () => ({ createCards: (...a: unknown[]) => createCards(...a) }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [], createDeck: async () => ({ id: 'd-new' }) }))
vi.mock('@/lib/data/courses', () => ({ createCourse: (...a: unknown[]) => createCourse(...a) }))
vi.mock('@/lib/data/tasks', () => ({ createTask: (...a: unknown[]) => createTask(...a) }))
vi.mock('@/lib/data/classes', () => ({ createClass: (...a: unknown[]) => createClass(...a) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { NoteReview } from '@/components/scan/NoteReview'
import { CardsReview } from '@/components/scan/CardsReview'
import { PlannerReview } from '@/components/scan/PlannerReview'

const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
const courses = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }]
beforeEach(() => { createNote.mockClear(); createCards.mockClear(); createCourse.mockClear(); createTask.mockClear(); createClass.mockClear() })
afterEach(() => cleanup())

describe('NoteReview', () => {
  it('edits the title, text and course, then saves the note', async () => {
    const onSaved = vi.fn()
    render(<NoteReview result={{ title: 'Cells', content_md: '## Parts', truncated: true }} courses={courses} onSaved={onSaved} onScanAgain={vi.fn()} />)
    expect(screen.getByText(/may be incomplete/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cell parts' } })
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit text' }))
    fireEvent.change(screen.getByLabelText('Note text'), { target: { value: '## Parts\n- Nucleus' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(createNote.mock.calls[0][1]).toEqual({ title: 'Cell parts', content_md: '## Parts\n- Nucleus', course_id: 'c1' })
    expect(onSaved).toHaveBeenCalledWith('n1')
  })
})

describe('CardsReview', () => {
  it('saves the ticked cards to a new deck', async () => {
    const onSaved = vi.fn()
    await act(async () => {
      render(<CardsReview result={{ cards: [{ front: 'A?', back: 'a' }, { front: 'B?', back: 'b' }] }} deckName="Scanned cards" onSaved={onSaved} onScanAgain={vi.fn()} />)
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep card 2' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 1 card' })) })
    expect(createCards.mock.calls[0].slice(1)).toEqual(['d-new', [{ front: 'A?', back: 'a' }]])
    expect(onSaved).toHaveBeenCalledWith(1)
  })
})

describe('PlannerReview', () => {
  const result = {
    tasks: [
      { title: 'Essay', type: 'assignment' as const, due_date: '2026-10-16', unsure: false },
      { title: 'Midterm', type: 'exam' as const, due_date: null, unsure: true },
    ],
    classes: [
      { course: 'biology ', day: 1, start: '09:00', end: '10:30', room: 'LT 2', kind: 'lecture' as const, unsure: false },
      { course: 'Chemistry', day: 3, start: '14:00', end: '16:00', room: null, kind: 'lab' as const, unsure: true },
      { course: 'chemistry', day: 4, start: '14:00', end: '15:00', room: null, kind: 'tutorial' as const, unsure: false },
    ],
  }
  const renderPlanner = (onSaved = vi.fn()) =>
    render(<ProfileProvider initial={profile}><PlannerReview result={result} courses={courses} onSaved={onSaved} onScanAgain={vi.fn()} /></ProfileProvider>)

  it('flags unsure items and matches courses or offers to create them', () => {
    renderPlanner()
    expect(screen.getAllByText('check this')).toHaveLength(2)
    expect((screen.getByLabelText('Class 1 course') as HTMLSelectElement).value).toBe('c1')
    expect((screen.getByLabelText('Class 2 course') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Create course Chemistry')
    expect((screen.getByLabelText('Task 1 due date') as HTMLInputElement).value).toBe('2026-10-16')
  })
  it('saves the ticked items, creating each new course once', async () => {
    const onSaved = vi.fn()
    renderPlanner(onSaved)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep task 2' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 4 items' })) })
    expect(createCourse).toHaveBeenCalledTimes(1)
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(createClass).toHaveBeenCalledTimes(3)
    expect(onSaved).toHaveBeenCalledWith({ tasks: 1, classes: 3, courses: 1 })
  })
  it('after a save that fails partway, retrying saves only the rest', async () => {
    createTask.mockResolvedValueOnce({ id: 't1' }).mockRejectedValueOnce(new Error('offline'))
    const onSaved = vi.fn(), onPartialSave = vi.fn()
    render(<ProfileProvider initial={profile}><PlannerReview result={result} courses={courses} onSaved={onSaved} onPartialSave={onPartialSave} onScanAgain={vi.fn()} /></ProfileProvider>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 5 items' })) })
    expect(screen.getByRole('alert').textContent).toContain('Some items were saved')
    expect(onPartialSave).toHaveBeenCalledTimes(1) // the planner behind refreshes
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 4 items' })) })
    expect(createCourse).toHaveBeenCalledTimes(1) // "Chemistry" made once, not again
    expect(createTask.mock.calls.map(c => (c[1] as { title: string }).title)).toEqual(['Essay', 'Midterm', 'Midterm'])
    expect(createClass).toHaveBeenCalledTimes(3)
    expect(onSaved).toHaveBeenCalledWith({ tasks: 1, classes: 3, courses: 0 })
  })
  it('a class that ends before it starts can\'t be saved', () => {
    renderPlanner()
    fireEvent.change(screen.getByLabelText('Class 1 end'), { target: { value: '08:00' } })
    expect((screen.getByRole('button', { name: /^Save/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Each class must end after it starts.')).toBeTruthy()
  })
})
