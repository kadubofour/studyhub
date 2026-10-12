// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QuickAdd } from '@/components/planner/QuickAdd'

const courses = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }]

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T14:00:00Z')) })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('QuickAdd', () => {
  it('shows the full parsed date so the user can tell which day', () => {
    render(<QuickAdd courses={courses} defaultCourseId={null} tz="America/New_York" onAdd={() => {}} />)
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Essay next fri' } })
    expect(screen.getByText('Due Fri, Oct 9')).toBeTruthy()
  })

  it('sends high priority when the text ends with !', () => {
    const onAdd = vi.fn()
    render(<QuickAdd courses={courses} defaultCourseId={null} tz="America/New_York" onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Essay fri !' } })
    expect(screen.getByText('High priority')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd.mock.calls[0][0]).toMatchObject({ title: 'Essay', priority: 'high' })
  })
  it('sends no priority otherwise, so the task stays normal', () => {
    const onAdd = vi.fn()
    render(<QuickAdd courses={courses} defaultCourseId={null} tz="America/New_York" onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Essay fri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd.mock.calls[0][0].priority).toBeUndefined()
  })
  it('shows the implicit default due date when no date word is typed', () => {
    render(<QuickAdd courses={courses} defaultCourseId={null} tz="America/New_York" onAdd={() => {}} compact implicitDue="Today" />)
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Read chapter 4' } })
    expect(screen.getByText('Due Today')).toBeTruthy()
  })

  it('lets the user choose "No course" even while a course filter is active', () => {
    const onAdd = vi.fn()
    render(<QuickAdd courses={courses} defaultCourseId="c1" tz="UTC" onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Loose task' } })
    fireEvent.submit(screen.getByLabelText('Add a task').closest('form')!)
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Loose task', course_id: null }))
  })

  it('uses the filter course by default', () => {
    const onAdd = vi.fn()
    render(<QuickAdd courses={courses} defaultCourseId="c1" tz="UTC" onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Bio task' } })
    fireEvent.submit(screen.getByLabelText('Add a task').closest('form')!)
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'c1' }))
  })
})
