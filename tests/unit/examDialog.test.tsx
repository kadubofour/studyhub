// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { ExamDialog } from '@/components/planner/ExamDialog'
import type { Task } from '@/lib/types'

const courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
const TZ = 'Africa/Accra' // UTC+0
const LAGOS = 'Africa/Lagos' // UTC+1
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

const open = (initial: Partial<Task> | null, extra: Partial<React.ComponentProps<typeof ExamDialog>> = {}) => {
  const onSave = vi.fn(), onClose = vi.fn()
  render(<ExamDialog open initial={initial} courses={courses} tz={TZ} onClose={onClose} onSave={onSave} {...extra} />)
  return { onSave, onClose }
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('ExamDialog', () => {
  it('asks what an exam needs, not what a task needs', () => {
    open({ type: 'exam' })
    for (const l of ['Title', 'Day', 'Starts at', 'Where', 'What it covers', 'Counts for (% of the grade)']) expect(screen.getByLabelText(l)).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Course' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Kind of exam' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Length' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Priority' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Type' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Add exam' })).toBeTruthy()
  })

  it('saves a full exam: day and start time together, how long, where, what it covers and what it counts for', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Midterm' }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Biology midterm') // made from the course and the kind
    type('Day', '2026-11-14'); type('Starts at', '14:00')
    fireEvent.click(screen.getByRole('radio', { name: '2 h' }))
    type('Where', '  Hall B, seat 24 '); type('What it covers', 'Chapters 1 to 5'); type('Counts for (% of the grade)', '30')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({
      title: 'Biology midterm', type: 'exam', course_id: 'bio', due_at: '2026-11-14T14:00:00.000Z', priority: 'normal',
      exam_kind: 'midterm', duration_min: 120, location: 'Hall B, seat 24', covers: 'Chapters 1 to 5', weight_pct: 30,
    })
  })

  it('uses the time zone of the student for the start', () => {
    const { onSave } = open({ type: 'exam' }, { tz: LAGOS })
    fireEvent.click(screen.getByRole('radio', { name: 'Chemistry' }))
    type('Day', '2026-11-14'); type('Starts at', '14:00')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0][0].due_at).toBe('2026-11-14T13:00:00.000Z')
  })

  it('keeps a title the student typed, even when the course changes', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    type('Title', 'BIOL 201 final')
    fireEvent.click(screen.getByRole('radio', { name: 'Chemistry' }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('BIOL 201 final')
    type('Day', '2026-11-14')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0][0].title).toBe('BIOL 201 final')
  })

  it('can say the time is not announced yet, which keeps the day only', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Final' }))
    type('Day', '2026-12-10')
    fireEvent.click(screen.getByRole('checkbox', { name: /time has not been announced/ }))
    expect((screen.getByLabelText('Starts at') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ due_at: '2026-12-10T23:59:59.000Z', exam_kind: 'final', duration_min: null, location: null, covers: null, weight_pct: null })
  })

  it('starts a new exam on the day picked on the calendar, at nine in the morning', () => {
    open({ type: 'exam', due_at: '2026-10-20T23:59:59Z' })
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('2026-10-20')
    expect((screen.getByLabelText('Starts at') as HTMLInputElement).value).toBe('09:00')
    expect((screen.getByRole('checkbox', { name: /time has not been announced/ }) as HTMLInputElement).checked).toBe(false)
  })

  it('opens an existing exam as it was saved, including an old one with no time', () => {
    open({ id: 'e1', type: 'exam', title: 'Chem final', course_id: 'chem', due_at: '2026-12-01T10:30:00Z', exam_kind: 'final', duration_min: 150, location: 'Gym', covers: 'All of it', weight_pct: 50 })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Chem final')
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('2026-12-01')
    expect((screen.getByLabelText('Starts at') as HTMLInputElement).value).toBe('10:30')
    expect(screen.getByRole('radio', { name: 'Chemistry' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Final' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: '2 h 30 min' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Counts for (% of the grade)') as HTMLInputElement).value).toBe('50')
    expect(screen.getByRole('heading', { name: 'Edit exam' })).toBeTruthy()
    cleanup()
    open({ id: 'e2', type: 'exam', title: 'Old exam', due_at: '2026-12-01T23:59:59Z' })
    expect((screen.getByRole('checkbox', { name: /time has not been announced/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('offers a length it already has, even an unusual one', () => {
    open({ id: 'e1', type: 'exam', title: 'Oral', due_at: '2026-12-01T10:30:00Z', duration_min: 20 })
    expect(screen.getByRole('radio', { name: '20 min' }).getAttribute('aria-checked')).toBe('true')
  })

  it('needs the course (when there are courses), a title, a day, and a sensible percentage', () => {
    const { onSave } = open({ type: 'exam' })
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    save(); expect(screen.getByRole('alert').textContent).toMatch(/course/i)
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    type('Title', '  '); save(); expect(screen.getByRole('alert').textContent).toMatch(/title/i)
    type('Title', 'Quiz 1'); save(); expect(screen.getByRole('alert').textContent).toMatch(/day/i)
    type('Day', '2026-11-14'); type('Counts for (% of the grade)', '130'); save(); expect(screen.getByRole('alert').textContent).toMatch(/percentage/i)
    type('Counts for (% of the grade)', '10')
    type('Starts at', ''); save(); expect(screen.getByRole('alert').textContent).toMatch(/time/i)
    expect(onSave).not.toHaveBeenCalled()
    type('Starts at', '08:00'); save()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('can be saved with no course when there are no courses yet', () => {
    const { onSave } = open({ type: 'exam' }, { courses: [] })
    expect(screen.getByText(/No courses yet/)).toBeTruthy()
    type('Title', 'Practice test'); type('Day', '2026-11-14')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ course_id: null, title: 'Practice test' })
  })

  it('offers Mark done and Delete only for an exam that exists', () => {
    const onDone = vi.fn(), onDelete = vi.fn()
    open({ id: 'e1', type: 'exam', title: 'X', due_at: '2026-12-01T10:30:00Z' }, { onDone, onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' })); fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDone).toHaveBeenCalledTimes(1); expect(onDelete).toHaveBeenCalledTimes(1)
    cleanup()
    open({ type: 'exam' }, { onDone, onDelete })
    expect(within(document.body).queryByRole('button', { name: 'Mark done' })).toBeNull()
  })
})
