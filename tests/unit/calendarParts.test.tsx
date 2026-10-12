// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { TimeGrid } from '@/components/calendar/TimeGrid'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import type { DayItem } from '@/lib/calendar/events'
import type { ClassSlot, Course } from '@/lib/types'

afterEach(cleanup)
const courses: Course[] = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
const cls = (id: string, course_id: string, day_of_week: number, start: string, end: string): ClassSlot =>
  ({ id, course_id, day_of_week, start_time: start, end_time: end, location: null, kind: 'lecture' })
const WEEK = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'] // Mon 12 .. Sun 18

describe('CalendarToolbar', () => {
  const setup = () => {
    const h = { onView: vi.fn(), onToday: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onAdd: vi.fn() }
    render(<CalendarToolbar title="Oct 12 – 18, 2026" view="week" {...h} />)
    return h
  }
  it('shows the range and which view is on', () => {
    setup()
    expect(screen.getByText('Oct 12 – 18, 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Day' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('switches view, goes to today and moves back and forward', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(h.onView).toHaveBeenCalledWith('month')
    expect(h.onToday).toHaveBeenCalledTimes(1)
    expect(h.onPrev).toHaveBeenCalledTimes(1)
    expect(h.onNext).toHaveBeenCalledTimes(1)
  })
  it('has plain Add class, Add exam and Add task buttons', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add class' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add exam' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(h.onAdd.mock.calls.map(c => c[0])).toEqual(['class', 'exam', 'task'])
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('TimeGrid', () => {
  const NOW = new Date('2026-10-12T10:30:00Z') // Monday 10:30
  const base = (over: Partial<React.ComponentProps<typeof TimeGrid>> = {}): React.ComponentProps<typeof TimeGrid> => ({
    keys: WEEK, todayKey: '2026-10-12', now: NOW, tz: 'Africa/Accra', classes: [], courses, itemsByDay: {},
    onClassClick: vi.fn(), onSlotClick: vi.fn(), onItemClick: vi.fn(), ...over,
  })
  it('has a column for each day, today marked', () => {
    render(<TimeGrid {...base()} />)
    for (const name of ['Monday 12 October', 'Tuesday 13 October', 'Sunday 18 October']) expect(screen.getByRole('group', { name })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Monday 12 October' }).getAttribute('data-today')).toBe('true')
    expect(screen.getByRole('group', { name: 'Tuesday 13 October' }).getAttribute('data-today')).toBeNull()
  })
  it('a Day view has the one column', () => {
    render(<TimeGrid {...base({ keys: ['2026-10-12'] })} />)
    expect(screen.getAllByRole('group').filter(g => g.getAttribute('data-day'))).toHaveLength(1)
  })
  it('draws a line at the current time in today only', () => {
    render(<TimeGrid {...base()} />)
    const line = screen.getByTestId('now-line')
    expect(line.style.top).toBe(`${3.5 * 56}px`) // 10:30 is 3.5 hours after 07:00
    expect(within(screen.getByRole('group', { name: 'Monday 12 October' })).getByTestId('now-line')).toBe(line)
  })
  it('has no line when the time is outside the hours shown, or today is not in view', () => {
    const { unmount } = render(<TimeGrid {...base({ now: new Date('2026-10-12T05:00:00Z') })} />)
    expect(screen.queryByTestId('now-line')).toBeNull()
    unmount()
    render(<TimeGrid {...base({ todayKey: '2026-10-20' })} />)
    expect(screen.queryByTestId('now-line')).toBeNull()
  })
  it('shows classes in their course colour, and calls back when clicked', () => {
    const props = base({ classes: [cls('a', 'bio', 1, '09:00:00', '10:00:00')] })
    render(<TimeGrid {...props} />)
    const block = screen.getByRole('button', { name: /Biology/ })
    expect(block.style.top).toBe(`${2 * 56}px`)
    expect(block.style.height).toBe(`${56 - 2}px`)
    expect(block.style.background).toContain('rgb(29, 158, 117)')
    fireEvent.click(block)
    expect(props.onClassClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })
  it('puts classes that overlap side by side', () => {
    render(<TimeGrid {...base({ classes: [cls('a', 'bio', 1, '09:00:00', '10:30:00'), cls('b', 'chem', 1, '10:00:00', '11:00:00')] })} />)
    expect(screen.getByRole('button', { name: /Biology/ }).style.width).toContain('50%')
    expect(screen.getByRole('button', { name: /Chemistry/ }).style.left).toContain('50%')
  })
  it('puts classes on the right weekday', () => {
    render(<TimeGrid {...base({ classes: [cls('a', 'bio', 3, '09:00:00', '10:00:00')] })} />) // Wednesday
    expect(within(screen.getByRole('group', { name: 'Wednesday 14 October' })).getByRole('button', { name: /Biology/ })).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Monday 12 October' })).queryByRole('button', { name: /Biology/ })).toBeNull()
  })
  it('lists the all-day items of a day, exams marked, and calls back when one is clicked', () => {
    const items: Record<string, DayItem[]> = { '2026-10-13': [
      { kind: 'task', id: 't1', title: 'Midterm', type: 'exam', priority: 'normal', courseId: 'bio' },
      { kind: 'session', id: 's1', title: 'Learn: Glycolysis', courseId: 'bio' },
    ] }
    const props = base({ itemsByDay: items })
    render(<TimeGrid {...props} />)
    const strip = within(screen.getByRole('group', { name: 'Tuesday 13 October' }))
    fireEvent.click(strip.getByRole('button', { name: /Midterm/ }))
    expect(props.onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    expect(strip.getByRole('button', { name: /Midterm/ }).getAttribute('data-exam')).toBe('true')
    expect(strip.getByText('Learn: Glycolysis')).toBeTruthy()
  })
  it('clicking an empty slot says which day and hour', () => {
    const props = base()
    render(<TimeGrid {...props} />)
    const slot = within(screen.getByRole('group', { name: 'Thursday 15 October' })).getByTestId('slot-10')
    fireEvent.click(slot)
    expect(props.onSlotClick).toHaveBeenCalledWith('2026-10-15', 10)
  })
  it('can leave out the all-day strip and the time line, for the weekly timetable', () => {
    const items: Record<string, DayItem[]> = { '2026-10-13': [{ kind: 'task', id: 't1', title: 'Midterm', type: 'exam', priority: 'normal', courseId: 'bio' }] }
    render(<TimeGrid {...base({ itemsByDay: items, showStrip: false, showNow: false })} />)
    expect(screen.queryByText('Midterm')).toBeNull()
    expect(screen.queryByTestId('now-line')).toBeNull()
  })
  it('names each day like the old week grid did, Mon 12, with today in the accent', () => {
    render(<TimeGrid {...base()} />)
    const head = within(screen.getByRole('group', { name: 'Monday 12 October' })).getByText('Mon 12')
    expect(head.className).toContain('text-accent')
    expect(within(screen.getByRole('group', { name: 'Tuesday 13 October' })).getByText('Tue 13').className).not.toContain('text-accent')
  })
  it('widens the hours for an early or late class', () => {
    const { unmount } = render(<TimeGrid {...base()} />)
    expect(screen.queryByText('6 AM')).toBeNull() // the grid opens at 07:00
    unmount()
    render(<TimeGrid {...base({ classes: [cls('a', 'bio', 1, '05:00:00', '06:30:00')] })} />)
    expect(screen.getByText('6 AM')).toBeTruthy()
  })
})

describe('MonthGrid', () => {
  const keys = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
  const item = (id: string, title: string): DayItem => ({ kind: 'task', id, title, type: 'other', priority: 'normal', courseId: null })
  const setup = (over: Partial<React.ComponentProps<typeof MonthGrid>> = {}) => {
    const props: React.ComponentProps<typeof MonthGrid> = { keys, anchor: '2026-10-14', todayKey: '2026-10-08', classes: [], courses, itemsByDay: {}, onDayClick: vi.fn(), onItemClick: vi.fn(), onClassClick: vi.fn(), ...over }
    render(<MonthGrid {...props} />)
    return props
  }
  it('has a cell for every day, today marked and other months dimmed', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Thursday 8 October' }).getAttribute('aria-current')).toBe('date')
    expect(screen.getByRole('button', { name: 'Tuesday 29 September' }).getAttribute('data-outside')).toBe('true')
    expect(screen.getByRole('button', { name: 'Friday 2 October' }).getAttribute('data-outside')).toBeNull()
  })
  it('opens the day when its number is clicked', () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Friday 2 October' }))
    expect(p.onDayClick).toHaveBeenCalledWith('2026-10-02')
  })
  it('shows three things a day and counts the rest', () => {
    const p = setup({ itemsByDay: { '2026-10-02': [item('1', 'One'), item('2', 'Two'), item('3', 'Three'), item('4', 'Four'), item('5', 'Five')] } })
    expect(screen.getByRole('button', { name: /One/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Four/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '2 more on Friday 2 October' }))
    expect(p.onDayClick).toHaveBeenCalledWith('2026-10-02')
  })
  it('shows classes on their weekday, before the tasks', () => {
    setup({ classes: [cls('a', 'bio', 5, '09:00:00', '10:00:00')], itemsByDay: { '2026-10-02': [item('1', 'Essay')] } }) // Friday
    const friday = screen.getAllByRole('button', { name: /Biology/ })
    expect(friday).toHaveLength(2) // Fri 2 and Fri 9
    const cell = friday[0].closest('[data-day="2026-10-02"]')!
    expect(cell.textContent!.indexOf('Biology')).toBeLessThan(cell.textContent!.indexOf('Essay'))
  })
  it('calls back for a clicked task', () => {
    const p = setup({ itemsByDay: { '2026-10-02': [item('1', 'Essay')] } })
    fireEvent.click(screen.getByRole('button', { name: /Essay/ }))
    expect(p.onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })
})
