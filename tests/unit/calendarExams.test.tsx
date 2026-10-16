// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import type { Course, Task } from '@/lib/types'

vi.mock('@/components/plan/usePlans', () => ({ usePlans: () => ({ views: [], failed: false, reload: vi.fn(), setDone: vi.fn() }) }))
import { CalendarView } from '@/components/calendar/CalendarView'

const courses: Course[] = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
const exam = (over: Partial<Task> = {}): Task => ({
  id: 'e1', course_id: 'bio', title: 'Biology midterm', type: 'exam', due_at: '2026-10-14T14:00:00Z', priority: 'normal', done_at: null, created_at: '',
  duration_min: 120, location: 'Hall B', exam_kind: 'midterm', ...over,
})
function setup(tasks: Task[]) {
  const h = { onSaveClass: vi.fn(), onDeleteClass: vi.fn(), onAddTask: vi.fn(), onEditTask: vi.fn(), onDoneTask: vi.fn(), onDeleteTask: vi.fn() }
  render(<CalendarView classes={[]} courses={courses} tasks={tasks} tz="Africa/Accra" empty={false} {...h} />)
  return h
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T10:30:00Z')) // Monday
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.useRealTimers() })
const wednesday = () => screen.getByRole('group', { name: 'Wednesday 14 October' })

describe('an exam with a start time, on the week', () => {
  it('is a block in the hours from its start to its end, with the room, not a flag in the all-day row', () => {
    setup([exam()])
    const block = within(wednesday()).getByRole('button', { name: /Biology midterm/ })
    expect(block.getAttribute('data-exam')).toBe('true')
    expect(block.textContent).toContain('14:00–16:00')
    expect(block.textContent).toContain('Hall B')
    // only the block is on the day: one button called that
    expect(within(wednesday()).getAllByRole('button', { name: /Biology midterm/ })).toHaveLength(1)
  })

  it('opens the exam dialog, as it was saved', () => {
    setup([exam()])
    fireEvent.click(within(wednesday()).getByRole('button', { name: /Biology midterm/ }))
    expect(screen.getByRole('heading', { name: 'Edit exam' })).toBeTruthy()
    expect((screen.getByLabelText('Starts at') as HTMLInputElement).value).toBe('14:00')
    expect((screen.getByLabelText('Where') as HTMLInputElement).value).toBe('Hall B')
  })

  it('still sits in the all-day row when its time is not known yet', () => {
    setup([exam({ due_at: '2026-10-14T23:59:59Z', duration_min: null })])
    const chip = within(wednesday()).getByRole('button', { name: /Biology midterm/ })
    expect(chip.getAttribute('data-exam')).toBe('true')
    expect(chip.textContent).not.toContain('–')
  })

  it('makes room for an early or late exam in the hours shown', () => {
    setup([exam({ due_at: '2026-10-14T05:00:00Z', duration_min: 60 })])
    expect(screen.getAllByTestId('slot-5').length).toBeGreaterThan(0) // the hours start at 5 instead of 7
  })

  it('in the month, a chip says when it starts', () => {
    setup([exam()])
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    const cell = document.querySelector('[data-day="2026-10-14"]') as HTMLElement
    expect(within(cell).getByRole('button', { name: /Biology midterm/ }).textContent).toContain('14:00')
  })
})
