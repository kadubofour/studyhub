// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, within } from '@testing-library/react'
import type { Profile, Task } from '@/lib/types'

let open: Task[] = []
let done: Task[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [], createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn() }))
vi.mock('@/lib/data/tasks', () => ({
  listOpenTasks: async () => open, listRecentlyDone: async () => done,
  createTask: vi.fn(), setTaskDone: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import PlannerPage from '@/app/(app)/planner/page'

const task = (id: string, title: string, over: Partial<Task> = {}): Task =>
  ({ id, course_id: null, title, type: 'other', due_at: null, priority: 'normal', done_at: null, created_at: '', ...over })
const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
beforeEach(() => { open = [task('t1', 'Essay')]; done = [task('t2', 'Old lab', { done_at: '2026-10-10T10:00:00Z' })] })
afterEach(cleanup)

describe('Tasks tab layout', () => {
  it('uses both sides: the list on one, the study plan and finished tasks on the other', async () => {
    await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><PlannerPage /></ToastProvider></ProfileProvider>) })
    const side = screen.getByRole('complementary', { name: 'Study plan and finished tasks' })
    expect(within(side).getByRole('region', { name: 'Study plan' })).toBeTruthy()
    expect(within(side).getByRole('region', { name: 'Done' })).toBeTruthy()
    expect(within(side).queryByRole('button', { name: 'Edit Essay' })).toBeNull() // the list itself is the other side
    expect(screen.getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
  })
})
