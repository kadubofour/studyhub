// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile, Task } from '@/lib/types'

let open: Task[] = []
let done: Task[] = []
const updateTask = vi.fn(async (..._a: unknown[]) => {})
const deleteTask = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [], createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn() }))
vi.mock('@/lib/data/tasks', () => ({
  listOpenTasks: async () => open, listRecentlyDone: async () => done,
  createTask: vi.fn(), setTaskDone: vi.fn(), updateTask: (...a: unknown[]) => updateTask(...a), deleteTask: (...a: unknown[]) => deleteTask(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import PlannerPage from '@/app/(app)/planner/page'

const task = (id: string, title: string, over: Partial<Task> = {}): Task =>
  ({ id, course_id: null, title, type: 'other', due_at: null, priority: 'normal', done_at: null, created_at: '', ...over })
const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
const load = async () => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><PlannerPage /></ToastProvider></ProfileProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T10:00:00Z')) // Wednesday
  updateTask.mockClear(); deleteTask.mockClear()
  open = [
    task('a', 'Late lab', { due_at: '2026-10-12T23:59:59Z' }), task('b', 'Essay', { due_at: '2026-10-14T23:59:59Z' }),
    task('c', 'Read ch 3', { due_at: '2026-10-16T23:59:59Z' }), task('d', 'Thesis', { due_at: '2026-12-01T23:59:59Z' }), task('e', 'Call mum'),
  ]
  done = [task('x', 'Old lab', { done_at: '2026-10-10T10:00:00Z' })]
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Tasks: the lists rail and day groups', () => {
  it('opens on All tasks, grouped by day, with late ones first', async () => {
    await load()
    expect(screen.getByRole('heading', { name: 'All tasks' })).toBeTruthy()
    const names = screen.getAllByRole('region').map(r => r.getAttribute('aria-label')).filter(n => ['Overdue', 'Today', 'Fri, Oct 16', 'Tue, Dec 1', 'No date'].includes(n!))
    expect(names).toEqual(['Overdue', 'Today', 'Fri, Oct 16', 'Tue, Dec 1', 'No date'])
    expect(within(screen.getByRole('region', { name: 'Overdue' })).getByRole('button', { name: 'Edit Late lab' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Today' })).getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
  })
  it('says what needs attention under the title', async () => {
    await load()
    expect(screen.getByText('1 overdue · 1 due today · 1 more this week')).toBeTruthy()
  })
  it('shows the counts in the rail and filters when a list is chosen', async () => {
    await load()
    const rail = within(screen.getByRole('navigation', { name: 'Task lists' }))
    expect(rail.getByRole('button', { name: /^All tasks 5/ })).toBeTruthy()
    await click(rail.getByRole('button', { name: /^Today 2/ }))
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit Thesis' })).toBeNull()
    await click(rail.getByRole('button', { name: /^Someday/ }))
    expect(screen.getByRole('button', { name: 'Edit Call mum' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit Essay' })).toBeNull()
  })
  it('tells an empty list what it is for', async () => {
    open = []
    await load()
    await click(within(screen.getByRole('navigation', { name: 'Task lists' })).getByRole('button', { name: /^Today/ }))
    expect(screen.getByText('Nothing due today')).toBeTruthy()
  })
  it('moves a task to tomorrow from its menu, and it lands in Tomorrow', async () => {
    await load()
    await click(screen.getByRole('button', { name: 'Move Essay' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Tomorrow' }))
    expect(updateTask).toHaveBeenCalledWith({}, 'b', expect.objectContaining({ title: 'Essay', due_at: '2026-10-15T23:59:59.000Z' }))
    expect(within(screen.getByRole('region', { name: 'Tomorrow' })).getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
  })
  it('takes the date away with No date, and the task goes to No date', async () => {
    await load()
    await click(screen.getByRole('button', { name: 'Move Thesis' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'No date' }))
    expect(updateTask).toHaveBeenCalledWith({}, 'd', expect.objectContaining({ due_at: null }))
    expect(within(screen.getByRole('region', { name: 'No date' })).getByRole('button', { name: 'Edit Thesis' })).toBeTruthy()
  })
  it('deletes from the row', async () => {
    await load()
    await click(screen.getByRole('button', { name: 'Delete Call mum' }))
    expect(deleteTask).toHaveBeenCalledWith({}, 'e')
    expect(screen.queryByRole('button', { name: 'Edit Call mum' })).toBeNull()
  })
  it('keeps the study plan under the list', async () => {
    await load()
    expect(screen.getByRole('region', { name: 'Study plan' })).toBeTruthy()
  })
})
