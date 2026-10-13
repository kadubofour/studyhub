// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile, Task } from '@/lib/types'

const task = (id: string, title: string, over: Partial<Task> = {}): Task =>
  ({ id, course_id: null, title, type: 'other', due_at: null, priority: 'normal', done_at: null, created_at: '', ...over })
let open: Task[] = []
let done: Task[] = []
const setTaskDone = vi.fn(async (..._a: unknown[]) => {})
const updateTask = vi.fn(async (..._a: unknown[]) => {})
const deleteTask = vi.fn(async (..._a: unknown[]) => {})
const createTask = vi.fn(async (_sb: unknown, input: object) => ({ id: 'real-1', course_id: null, type: 'other', priority: 'normal', done_at: null, created_at: '', due_at: null, title: '', ...input }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [], createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn() }))
vi.mock('@/lib/data/tasks', () => ({
  listOpenTasks: async () => open, listRecentlyDone: async () => done,
  createTask: (...a: [unknown, object]) => createTask(...a), setTaskDone: (...a: unknown[]) => setTaskDone(...a),
  updateTask: (...a: unknown[]) => updateTask(...a), deleteTask: (...a: unknown[]) => deleteTask(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import PlannerPage from '@/app/(app)/planner/page'

const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
const load = async () => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><PlannerPage /></ToastProvider></ProfileProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeEach(() => {
  open = []; done = []; setTaskDone.mockClear(); updateTask.mockClear(); deleteTask.mockClear(); createTask.mockClear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

describe('Planner tabs', () => {
  it('keeps the Tasks, Week and Timetable tabs', async () => {
    await load()
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Tasks', 'Week', 'Timetable'])
    await click(screen.getByRole('tab', { name: 'Week' }))
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('says nothing is planned yet on an empty week', async () => {
    await load()
    await click(screen.getByRole('tab', { name: 'Week' }))
    expect(screen.getByText('Nothing planned yet')).toBeTruthy()
  })
  it('does not, once there is a task', async () => {
    open = [task('t1', 'Essay')]
    await load()
    await click(screen.getByRole('tab', { name: 'Week' }))
    expect(screen.queryByText('Nothing planned yet')).toBeNull()
  })
  it('adding an exam on the week saves a task of type exam', async () => {
    await load()
    await click(screen.getByRole('tab', { name: 'Week' }))
    await click(screen.getByRole('button', { name: 'Add exam' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Finals' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(createTask).toHaveBeenCalledWith({}, expect.objectContaining({ title: 'Finals', type: 'exam' }))
  })
})

describe('Timetable tab', () => {
  it('shows the weekly classes only and adds one from a button', async () => {
    await load()
    await click(screen.getByRole('tab', { name: 'Timetable' }))
    expect(screen.getByRole('button', { name: 'Add class' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Day' })).toBeNull() // no date navigation: it repeats every week
  })
})

describe('Task list', () => {
  it('edits a task from its title', async () => {
    open = [task('t1', 'Essay')]
    await load()
    await click(screen.getByRole('button', { name: 'Edit Essay' }))
    expect(screen.getByRole('heading', { name: 'Edit task' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Essay draft' } })
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'high' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(updateTask).toHaveBeenCalledWith({}, 't1', expect.objectContaining({ title: 'Essay draft', priority: 'high' }))
    expect(screen.getByRole('button', { name: 'Edit Essay draft' })).toBeTruthy()
    expect(screen.getByText('High priority')).toBeTruthy()
  })
  it('puts a high priority task first among those due the same day', async () => {
    const due = '2026-10-20T23:59:59Z'
    open = [task('a', 'Alpha', { due_at: due }), task('b', 'Bravo', { due_at: due, priority: 'high' })]
    await load()
    const titles = screen.getAllByRole('button', { name: /^Edit / }).map(b => b.textContent)
    expect(titles).toEqual(['Bravo', 'Alpha'])
  })
  it('filters by type with counts on the chips', async () => {
    open = [task('a', 'Read ch 1', { type: 'reading' }), task('b', 'Midterm', { type: 'exam' }), task('c', 'Lab report', { type: 'assignment' }), task('d', 'Call mum')]
    await load()
    const chips = screen.getByRole('group', { name: 'Task type' })
    expect(within(chips).getByRole('button', { name: /^All 4/ })).toBeTruthy()
    expect(within(chips).getByRole('button', { name: /^Exams 1/ })).toBeTruthy()
    await click(within(chips).getByRole('button', { name: /^Exams/ }))
    expect(screen.queryByRole('button', { name: 'Edit Lab report' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit Midterm' })).toBeTruthy()
    expect(within(chips).getByRole('button', { name: /^Exams/ }).getAttribute('aria-pressed')).toBe('true')
    await click(within(chips).getByRole('button', { name: /^All/ }))
    expect(screen.getByRole('button', { name: 'Edit Lab report' })).toBeTruthy()
  })
  it('keeps finished tasks in the Done list, which can bring one back', async () => {
    open = [task('t1', 'Essay')]
    done = [task('t2', 'Old lab', { done_at: '2026-10-10T10:00:00Z' })]
    await load()
    expect(screen.queryByText('Old lab')).toBeNull() // not among the open tasks
    await click(screen.getByRole('button', { name: /^Done/ }))
    expect(screen.getByRole('heading', { name: 'Done' })).toBeTruthy()
    await click(screen.getByLabelText('Mark Old lab done'))
    expect(setTaskDone).toHaveBeenCalledWith({}, 't2', false)
    await click(screen.getByRole('button', { name: /^All tasks/ }))
    expect(screen.getByRole('button', { name: 'Edit Old lab' })).toBeTruthy() // back in the list
  })
  it('a task ticked off moves to Done at once', async () => {
    open = [task('t1', 'Essay')]
    await load()
    await click(screen.getByLabelText('Mark Essay done'))
    expect(setTaskDone).toHaveBeenCalledWith({}, 't1', true)
    expect(screen.queryByRole('button', { name: 'Edit Essay' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Done 1/ })).toBeTruthy()
  })
  it('shows a Done count of nothing when nothing is finished', async () => {
    open = [task('t1', 'Essay')]
    await load()
    expect(screen.getByRole('button', { name: /^Done 0/ })).toBeTruthy()
  })
})
