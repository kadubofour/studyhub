// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { ClassSlot, Course, Task } from '@/lib/types'
import type { PlanView } from '@/lib/plan/load'

let views: PlanView[] = []
vi.mock('@/components/plan/usePlans', () => ({ usePlans: () => ({ views, failed: false, reload: vi.fn(), setDone: vi.fn() }) }))
import { CalendarView } from '@/components/calendar/CalendarView'

const courses: Course[] = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
const task = (id: string, title: string, over: Partial<Task> = {}): Task =>
  ({ id, course_id: 'bio', title, type: 'assignment', due_at: '2026-10-14T23:59:59Z', priority: 'normal', done_at: null, created_at: '', ...over })
const klass: ClassSlot = { id: 'k1', course_id: 'bio', day_of_week: 2, start_time: '09:00:00', end_time: '10:00:00', location: null, kind: 'lecture' }

function setup(over: Partial<React.ComponentProps<typeof CalendarView>> = {}) {
  const h = { onSaveClass: vi.fn(), onDeleteClass: vi.fn(), onAddTask: vi.fn(), onEditTask: vi.fn(), onDoneTask: vi.fn(), onDeleteTask: vi.fn() }
  const props: React.ComponentProps<typeof CalendarView> = { classes: [klass], courses, tasks: [task('t1', 'Essay')], tz: 'Africa/Accra', empty: false, ...h, ...over }
  render(<CalendarView {...props} />)
  return h
}
beforeEach(() => {
  views = []
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T10:30:00Z')) // Monday
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('CalendarView', () => {
  it('opens on this week, with the week to come at one tap each way', () => {
    setup()
    expect(screen.getByText('Oct 12 – 18, 2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Oct 19 – 25, 2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('Oct 12 – 18, 2026')).toBeTruthy()
  })
  it('switches to the month, and a day number there opens that day', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getAllByText('October 2026').length).toBeGreaterThan(0)
    const cell = document.querySelector('[data-day="2026-10-20"]') as HTMLElement
    fireEvent.click(within(cell).getByRole('button', { name: 'Tuesday 20 October' }))
    expect(screen.getByText('Tuesday, Oct 20, 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Day' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('shows the class and the deadline in the week', () => {
    setup()
    expect(within(screen.getByRole('group', { name: 'Tuesday 13 October' })).getByRole('button', { name: /Biology/ })).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Wednesday 14 October' })).getByRole('button', { name: /Essay/ })).toBeTruthy()
  })
  it('shows study sessions in the strip of their day', () => {
    views = [{ plan: { id: 'p1' }, courseId: 'bio', today: [], schedule: [{ day: '2026-10-15', sessions: [{ topicId: 't', topicName: 'Glycolysis', kind: 'learn', minutes: 30, noteId: null }] }] } as unknown as PlanView]
    setup()
    expect(within(screen.getByRole('group', { name: 'Thursday 15 October' })).getByText('Learn: Glycolysis')).toBeTruthy()
  })
  it('the mini month moves the calendar to the day picked', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Friday 23 October 2026' }))
    expect(screen.getByText('Oct 19 – 25, 2026')).toBeTruthy()
  })

  describe('adding', () => {
    it('Add > Exam date opens an exam dialog and saves it', () => {
      const h = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Exam date' }))
      expect(screen.getByRole('heading', { name: 'Add exam' })).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Finals' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(h.onAddTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Finals', type: 'exam', due_at: '2026-10-12T23:59:59.000Z' }))
    })
    it('Add > Task opens a plain task dialog', () => {
      setup()
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Task' }))
      expect(screen.getByRole('heading', { name: 'Add task' })).toBeTruthy()
    })
    it('Add > Class opens the class dialog', () => {
      const h = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Class' }))
      expect(screen.getByRole('heading', { name: 'Add class' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(h.onSaveClass).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'bio' }), undefined)
    })
    it('with no course yet, Add > Class says to add a course first instead of opening a dialog', () => {
      setup({ courses: [] })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Class' }))
      expect(screen.queryByRole('heading', { name: 'Add class' })).toBeNull()
      expect(screen.getByRole('status').textContent).toMatch(/add a course first/i)
    })
    it('clicking an empty slot adds a class on that weekday and hour', () => {
      const h = setup()
      fireEvent.click(within(screen.getByRole('group', { name: 'Thursday 15 October' })).getByTestId('slot-10'))
      expect(screen.getByRole('heading', { name: 'Add class' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(h.onSaveClass).toHaveBeenCalledWith(expect.objectContaining({ day_of_week: 4, start_time: '10:00', end_time: '11:00' }), undefined)
    })
    it('clicking a class edits it, and Delete removes it', () => {
      const h = setup()
      fireEvent.click(within(screen.getByRole('group', { name: 'Tuesday 13 October' })).getByRole('button', { name: /Biology/ }))
      expect(screen.getByRole('heading', { name: 'Edit class' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(h.onDeleteClass).toHaveBeenCalledWith('k1')
    })
  })

  describe('editing a deadline', () => {
    const openEssay = () => fireEvent.click(within(screen.getByRole('group', { name: 'Wednesday 14 October' })).getByRole('button', { name: /Essay/ }))
    it('opens it, and saves the changes', () => {
      const h = setup()
      openEssay()
      expect(screen.getByRole('heading', { name: 'Edit task' })).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Essay v2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(h.onEditTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Essay v2' }))
    })
    it('can mark it done or delete it', () => {
      const h = setup()
      openEssay()
      fireEvent.click(screen.getByRole('button', { name: 'Mark done' }))
      expect(h.onDoneTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
      openEssay()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(h.onDeleteTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    })
  })

  describe('when there is nothing yet', () => {
    it('invites the student to add their first exam', () => {
      const h = setup({ empty: true, classes: [], tasks: [] })
      expect(screen.getByText('Add your first exam')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Add an exam' }))
      expect(screen.getByRole('heading', { name: 'Add exam' })).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Midterm' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(h.onAddTask).toHaveBeenCalledWith(expect.objectContaining({ type: 'exam' }))
    })
    it('says nothing when there is something', () => {
      setup()
      expect(screen.queryByText('Add your first exam')).toBeNull()
    })
  })
  it('keeps the time line moving: a minute later it is read again', async () => {
    vi.useFakeTimers() // all timers now, to let the minute pass
    vi.setSystemTime(new Date('2026-10-12T10:30:00Z'))
    setup()
    const before = screen.getByTestId('now-line').style.top
    await act(async () => { vi.setSystemTime(new Date('2026-10-12T11:30:00Z')); vi.advanceTimersByTime(60_000) })
    expect(screen.getByTestId('now-line').style.top).not.toBe(before)
  })
})
