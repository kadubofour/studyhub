// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TaskDialog } from '@/components/planner/TaskDialog'
import type { Task } from '@/lib/types'

const courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
const TZ = 'Africa/Accra' // UTC+0, so the day of 23:59:59Z is that same day
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

const open = (initial: Partial<Task> | null, extra: Partial<React.ComponentProps<typeof TaskDialog>> = {}) => {
  const onSave = vi.fn(), onClose = vi.fn()
  render(<TaskDialog open initial={initial} courses={courses} tz={TZ} onClose={onClose} onSave={onSave} {...extra} />)
  return { onSave, onClose }
}

describe('TaskDialog', () => {
  it('adds a task with a title, type, course, due day and priority', () => {
    const { onSave } = open({})
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Midterm' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Exam' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Chemistry' }))
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-21' } })
    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ title: 'Midterm', type: 'exam', course_id: 'chem', due_at: '2026-10-21T23:59:59.000Z', priority: 'high' })
  })
  it('starts from the task being edited', () => {
    open({ id: 't1', title: 'Essay', type: 'assignment', course_id: 'bio', due_at: '2026-10-14T23:59:59Z', priority: 'low' })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Essay')
    expect(screen.getByRole('radio', { name: 'Assignment' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Biology' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Due date') as HTMLInputElement).value).toBe('2026-10-14')
    expect(screen.getByRole('radio', { name: 'Low' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Edit task' })).toBeTruthy()
  })
  it('uses the day chosen on the calendar for a new task', () => {
    open({ due_at: '2026-10-20T23:59:59Z' })
    expect((screen.getByLabelText('Due date') as HTMLInputElement).value).toBe('2026-10-20')
  })
  it('can leave the date and course empty', () => {
    const { onSave } = open({})
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Read ch 3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ title: 'Read ch 3', type: 'other', course_id: null, due_at: null, priority: 'normal' })
  })
  it('needs a title', () => {
    const { onSave } = open({})
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/title/i)
  })
  it('offers Mark done and Delete only for an existing task', () => {
    const onDone = vi.fn(), onDelete = vi.fn()
    open({ id: 't1', title: 'Essay' }, { onDone, onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
  it('has neither when adding', () => {
    open({}, { onDone: vi.fn(), onDelete: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })
  it('can start with the type fixed, as the Add menu does for an exam', () => {
    const { onSave } = open({ type: 'exam' })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Finals' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0][0].type).toBe('exam')
  })
})
