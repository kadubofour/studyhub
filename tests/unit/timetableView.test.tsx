// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TimetableView } from '@/components/calendar/TimetableView'
import type { ClassSlot, Course } from '@/lib/types'

const courses: Course[] = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
const klass: ClassSlot = { id: 'k1', course_id: 'bio', day_of_week: 2, start_time: '09:00:00', end_time: '10:00:00', location: 'B12', kind: 'lecture' }

function setup(over: Partial<React.ComponentProps<typeof TimetableView>> = {}) {
  const h = { onSaveClass: vi.fn(), onDeleteClass: vi.fn() }
  render(<TimetableView classes={[klass]} courses={courses} tz="Africa/Accra" {...h} {...over} />)
  return h
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T10:30:00Z')) // Monday
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('TimetableView', () => {
  it('shows the classes of a week, on their weekday, with no time line and no deadlines strip', () => {
    setup()
    expect(within(screen.getByRole('group', { name: 'Tuesday 13 October' })).getByRole('button', { name: /Biology/ })).toBeTruthy()
    expect(screen.queryByTestId('now-line')).toBeNull()
  })
  it('adds a class from the button, and from an empty hour', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add class' }))
    expect(screen.getByRole('heading', { name: 'Add class' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(h.onSaveClass).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'bio' }), undefined)
    fireEvent.click(within(screen.getByRole('group', { name: 'Thursday 15 October' })).getByTestId('slot-10'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(h.onSaveClass).toHaveBeenLastCalledWith(expect.objectContaining({ day_of_week: 4, start_time: '10:00', end_time: '11:00' }), undefined)
  })
  it('edits and deletes a class by clicking it', () => {
    const h = setup()
    fireEvent.click(within(screen.getByRole('group', { name: 'Tuesday 13 October' })).getByRole('button', { name: /Biology/ }))
    expect(screen.getByRole('heading', { name: 'Edit class' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(h.onDeleteClass).toHaveBeenCalledWith('k1')
  })
  it('says to add a course first when there is none', () => {
    setup({ courses: [] })
    expect(screen.getByText(/add a course first/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add class' })).toBeNull()
  })
  it('does not open a class that is still saving', () => {
    setup({ classes: [{ ...klass, id: 'temp-k' }] })
    fireEvent.click(within(screen.getByRole('group', { name: 'Tuesday 13 October' })).getByRole('button', { name: /Biology/ }))
    expect(screen.queryByRole('heading', { name: 'Edit class' })).toBeNull()
  })
})
