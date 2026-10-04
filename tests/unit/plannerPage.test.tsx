// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Profile, Task } from '@/lib/types'

let finishLoad: (tasks: Task[]) => void = () => {}
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [], createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn() }))
vi.mock('@/lib/data/tasks', () => ({
  listOpenTasks: () => new Promise<Task[]>(r => { finishLoad = r }),
  createTask: async (...a: unknown[]) => ({ id: 'real-1', course_id: null, type: 'other', priority: 'normal', done_at: null, created_at: '', due_at: null, ...(a[1] as object) }),
  setTaskDone: vi.fn(), deleteTask: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import PlannerPage from '@/app/(app)/planner/page'
import { SCAN_SAVED } from '@/lib/scan/events'

const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
afterEach(() => cleanup())

describe('Planner page', () => {
  it('a task added while the planner is still loading is kept when the load finishes', async () => {
    await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><PlannerPage /></ToastProvider></ProfileProvider>) })
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Calc problem set' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Add$/ })) })
    expect(screen.getByText('Calc problem set', { exact: true })).toBeTruthy()
    await act(async () => { finishLoad([]) }) // the first load answers late, from before the task existed
    expect(screen.getByText('Calc problem set', { exact: true })).toBeTruthy()
  })

  it('reloads when a scan saves planner items', async () => {
    await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><PlannerPage /></ToastProvider></ProfileProvider>) })
    await act(async () => { finishLoad([]) })
    await act(async () => { window.dispatchEvent(new Event(SCAN_SAVED)) })
    await act(async () => { finishLoad([{ id: 't9', course_id: null, title: 'Cell biology essay', type: 'assignment', due_at: null, priority: 'normal', done_at: null, created_at: '' }]) })
    expect(screen.getByText('Cell biology essay')).toBeTruthy()
  })
})
