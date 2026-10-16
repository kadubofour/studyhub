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
const length = (hours: string, minutes: string) => { type('Hours', hours); type('Minutes', minutes) }
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))
const moreDetails = () => screen.getByText('More details').closest('details') as HTMLDetailsElement

describe('ExamDialog', () => {
  it('asks only what is needed up front: course, title, day, start, length and where', () => {
    open({ type: 'exam' })
    for (const l of ['Title', 'Day', 'Starts at', 'Hours', 'Minutes', 'Where']) expect(screen.getByLabelText(l)).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Course' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Length' })).toBeNull() // no list of lengths to pick from: it is typed
    expect(screen.queryByRole('radiogroup', { name: 'Priority' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Add exam' })).toBeTruthy()
  })

  it('keeps the rest (kind, what it covers, what it counts for) behind More details, closed for a new exam', () => {
    open({ type: 'exam' })
    expect(moreDetails().open).toBe(false)
    const inside = within(moreDetails())
    expect(inside.getByRole('radiogroup', { name: 'Kind of exam' })).toBeTruthy()
    expect(inside.getByLabelText('What it covers')).toBeTruthy()
    expect(inside.getByLabelText('Counts for (% of the grade)')).toBeTruthy()
    // and the main part of the form is not inside it
    expect(inside.queryByLabelText('Title')).toBeNull()
    expect(inside.queryByLabelText('Hours')).toBeNull()
  })

  it('opens More details by itself for an exam that has some', () => {
    open({ id: 'e1', type: 'exam', title: 'X', due_at: '2026-12-01T10:30:00Z', covers: 'All of it' })
    expect(moreDetails().open).toBe(true)
    cleanup()
    open({ id: 'e2', type: 'exam', title: 'Y', due_at: '2026-12-01T10:30:00Z', location: 'Gym' })
    expect(moreDetails().open).toBe(false) // a place is on the main part
  })

  it('saves a full exam: day and start together, the length typed in, where, and the details', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Midterm' }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Biology midterm') // made from the course and the kind
    type('Day', '2026-11-14'); type('Starts at', '14:00'); length('2', '15')
    type('Where', '  Hall B, seat 24 '); type('What it covers', 'Chapters 1 to 5'); type('Counts for (% of the grade)', '30')
    save()
    expect(onSave).toHaveBeenCalledWith({
      title: 'Biology midterm', type: 'exam', course_id: 'bio', due_at: '2026-11-14T14:00:00.000Z', priority: 'normal',
      exam_kind: 'midterm', duration_min: 135, location: 'Hall B, seat 24', covers: 'Chapters 1 to 5', weight_pct: 30,
    })
  })

  it('takes any length: hours alone, minutes alone, or both', () => {
    const lengthSaved = (h: string, m: string) => {
      const { onSave } = open({ type: 'exam' })
      fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
      type('Day', '2026-11-14'); length(h, m); save()
      const got = onSave.mock.calls[0][0].duration_min
      cleanup()
      return got
    }
    expect(lengthSaved('3', '')).toBe(180)
    expect(lengthSaved('', '45')).toBe(45)
    expect(lengthSaved('1', '20')).toBe(80)
    expect(lengthSaved('0', '90')).toBe(90)
    expect(lengthSaved('', '')).toBeNull() // left empty: not set
  })

  it('refuses a length that is not sensible, with a message', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    type('Day', '2026-11-14')
    length('', '2'); save()
    expect(screen.getByRole('alert').textContent).toMatch(/between 5 minutes and 12 hours/i)
    length('13', ''); save()
    expect(screen.getByRole('alert').textContent).toMatch(/between 5 minutes and 12 hours/i)
    length('1', '-5'); save()
    expect(screen.getByRole('alert').textContent).toMatch(/between 5 minutes and 12 hours/i)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('uses the time zone of the student for the start', () => {
    const { onSave } = open({ type: 'exam' }, { tz: LAGOS })
    fireEvent.click(screen.getByRole('radio', { name: 'Chemistry' }))
    type('Day', '2026-11-14'); type('Starts at', '14:00')
    save()
    expect(onSave.mock.calls[0][0].due_at).toBe('2026-11-14T13:00:00.000Z')
  })

  it('suggests a title from the course alone, and keeps a title the student typed even when the course changes', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Biology exam')
    type('Title', 'BIOL 201 final')
    fireEvent.click(screen.getByRole('radio', { name: 'Chemistry' }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('BIOL 201 final')
    type('Day', '2026-11-14'); save()
    expect(onSave.mock.calls[0][0].title).toBe('BIOL 201 final')
  })

  it('brings the suggestion back when the title is cleared', () => {
    open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    type('Title', 'Mine'); type('Title', '')
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Biology exam')
  })

  it('can say the time is not announced yet, which keeps the day only', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Final' }))
    type('Day', '2026-12-10')
    fireEvent.click(screen.getByRole('checkbox', { name: /time has not been announced/ }))
    expect((screen.getByLabelText('Starts at') as HTMLInputElement).disabled).toBe(true)
    save()
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
    expect((screen.getByLabelText('Hours') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Minutes') as HTMLInputElement).value).toBe('30')
    expect(screen.getByRole('radio', { name: 'Chemistry' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Final' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Counts for (% of the grade)') as HTMLInputElement).value).toBe('50')
    expect(screen.getByRole('heading', { name: 'Edit exam' })).toBeTruthy()
    cleanup()
    open({ id: 'e2', type: 'exam', title: 'Old exam', due_at: '2026-12-01T23:59:59Z' })
    expect((screen.getByRole('checkbox', { name: /time has not been announced/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('shows an unusual length as typed: 20 minutes is 0 hours 20', () => {
    open({ id: 'e1', type: 'exam', title: 'Oral', due_at: '2026-12-01T10:30:00Z', duration_min: 20 })
    expect((screen.getByLabelText('Hours') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Minutes') as HTMLInputElement).value).toBe('20')
  })

  it('needs the course (when there are courses), a title, a day and a start, and a sensible percentage', () => {
    const { onSave } = open({ type: 'exam' })
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

  it('opens More details when the problem is inside it, so the message is not about a hidden field', () => {
    open({ type: 'exam' })
    fireEvent.click(screen.getByRole('radio', { name: 'Biology' }))
    type('Day', '2026-11-14'); type('Counts for (% of the grade)', '130'); save()
    expect(moreDetails().open).toBe(true)
  })

  it('can be saved with no course when there are no courses yet', () => {
    const { onSave } = open({ type: 'exam' }, { courses: [] })
    expect(screen.getByText(/No courses yet/)).toBeTruthy()
    type('Title', 'Practice test'); type('Day', '2026-11-14')
    save()
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
