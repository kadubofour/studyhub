// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile, Task } from '@/lib/types'

let open: Task[] = []
let done: Task[] = []
const updateTask = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [], createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn() }))
vi.mock('@/lib/data/tasks', () => ({
  listOpenTasks: async () => open, listRecentlyDone: async () => done,
  createTask: vi.fn(), setTaskDone: vi.fn(), updateTask: (...a: unknown[]) => updateTask(...a), deleteTask: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import PlannerPage from '@/app/(app)/planner/page'

const task = (id: string, title: string, over: Partial<Task> = {}): Task =>
  ({ id, course_id: null, title, type: 'other', due_at: null, priority: 'normal', done_at: null, created_at: '', ...over })
const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
const load = async () => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><PlannerPage /></ToastProvider></ProfileProvider>) }) }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T10:00:00Z')) // Wednesday
  updateTask.mockClear()
  open = [
    task('a', 'Late lab', { due_at: '2026-10-12T23:59:59Z' }), task('b', 'Essay', { due_at: '2026-10-14T23:59:59Z' }),
    task('c', 'Read ch 3', { due_at: '2026-10-16T23:59:59Z' }), task('d', 'Thesis', { due_at: '2026-12-01T23:59:59Z' }), task('e', 'Call mum'),
  ]
  done = [task('x', 'Old lab', { done_at: '2026-10-10T10:00:00Z' })]
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Tasks board', () => {
  it('lays tasks out in columns by when they are due, with late ones on top of Today', async () => {
    await load()
    const today = within(screen.getByRole('region', { name: 'Today' }))
    const overdue = within(today.getByRole('group', { name: 'Overdue' }))
    expect(overdue.getByRole('button', { name: 'Edit Late lab' })).toBeTruthy()
    expect(today.getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'This week' })).getByRole('button', { name: 'Edit Read ch 3' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Later' })).getByRole('button', { name: 'Edit Thesis' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Someday' })).getByRole('button', { name: 'Edit Call mum' })).toBeTruthy()
  })
  it('says what needs attention above the board', async () => {
    await load()
    expect(screen.getByText('1 overdue · 1 due today · 1 more this week')).toBeTruthy()
  })
  it('moves a task to tomorrow from its menu, and it lands in This week', async () => {
    await load()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move Essay' })) })
    await act(async () => { fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Tomorrow' })) })
    expect(updateTask).toHaveBeenCalledWith({}, 'b', expect.objectContaining({ title: 'Essay', due_at: '2026-10-15T23:59:59.000Z' }))
    expect(within(screen.getByRole('region', { name: 'This week' })).getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Today' })).queryByRole('button', { name: 'Edit Essay' })).toBeNull()
  })
  it('takes the date away with No date, and the task goes to Someday', async () => {
    await load()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move Thesis' })) })
    await act(async () => { fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'No date' })) })
    expect(updateTask).toHaveBeenCalledWith({}, 'd', expect.objectContaining({ due_at: null }))
    expect(within(screen.getByRole('region', { name: 'Someday' })).getByRole('button', { name: 'Edit Thesis' })).toBeTruthy()
  })
  it('keeps the study plan and the finished tasks below the board, using the width', async () => {
    await load()
    expect(screen.getByRole('region', { name: 'Study plan' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Done' })).toBeTruthy()
    expect(screen.queryByRole('complementary')).toBeNull()
  })
  it('tells an empty column what it is for', async () => {
    open = []
    await load()
    expect(within(screen.getByRole('region', { name: 'Today' })).getByText('Nothing due today')).toBeTruthy()
  })
})
