// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import type { PlanView, SessionView } from '@/lib/plan/load'
import type { Profile } from '@/lib/types'

const session = (id: string, over: Partial<SessionView> = {}): SessionView => ({ id, topic_id: 't1', kind: 'learn', minutes: 25, done_at: null, topicName: 'Krebs', noteId: 'n1', ...over })
const view = (sessions: SessionView[]): PlanView => ({
  plan: { id: 'p1', course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 45, days_off: [], exam: { id: 'e1', title: 'Midterm', due_at: '2026-10-26T00:00:00Z', done_at: null } },
  courseId: 'c1', examDay: '2026-10-26', daysToExam: 14, status: 'ok', todayDayId: 'day1', today: sessions, upcoming: [], schedule: [], unscheduled: 0, missed: 0,
})
let views: PlanView[]
const saveDaySessions = vi.fn(async (..._a: unknown[]) => {})
let failing = false
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/plan/load', () => ({ loadPlans: async () => views }))
vi.mock('@/lib/plan/service', () => ({ saveDaySessions: (...a: unknown[]) => (failing ? Promise.reject(new Error('offline')) : saveDaySessions(...a)) }))
import { usePlans } from '@/components/plan/usePlans'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const profile = { id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
const wrapper = ({ children }: { children: React.ReactNode }) => <ToastProvider><ProfileProvider initial={profile}>{children}</ProfileProvider></ToastProvider>
const open = async () => { const h = renderHook(() => usePlans(), { wrapper }); await waitFor(() => expect(h.result.current.views).not.toBeNull()); return h }
beforeEach(() => { views = [view([session('a'), session('b', { topic_id: 't2' })])]; saveDaySessions.mockClear(); failing = false })
afterEach(cleanup)

describe('usePlans', () => {
  it('loads the plans', async () => {
    const h = await open()
    expect(h.result.current.views![0].today.map(s => s.id)).toEqual(['a', 'b'])
  })
  it('ticking marks a session done at once and saves the day\'s list without the display fields', async () => {
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true) })
    expect(h.result.current.views![0].today[0].done_at).not.toBeNull()
    const saved = saveDaySessions.mock.calls[0]
    expect(saved[1]).toBe('day1')
    expect(saved[2]).toEqual([
      { id: 'a', topic_id: 't1', kind: 'learn', minutes: 25, done_at: expect.any(String) },
      { id: 'b', topic_id: 't2', kind: 'learn', minutes: 25, done_at: null },
    ])
  })
  it('unticking clears it', async () => {
    views = [view([session('a', { done_at: '2026-10-12T10:00:00Z' })])]
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', false) })
    expect(h.result.current.views![0].today[0].done_at).toBeNull()
    expect((saveDaySessions.mock.calls[0][2] as { done_at: string | null }[])[0].done_at).toBeNull()
  })
  it('two quick ticks both stick', async () => {
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true); h.result.current.setDone('p1', 'b', true) })
    expect(h.result.current.views![0].today.every(s => s.done_at)).toBe(true)
    const last = saveDaySessions.mock.calls.at(-1)![2] as { done_at: string | null }[]
    expect(last.every(s => s.done_at)).toBe(true)
  })
  it('goes back when saving fails', async () => {
    failing = true
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true) })
    expect(h.result.current.views![0].today[0].done_at).toBeNull()
  })
  it('does nothing for a plan with no saved day', async () => {
    views = [{ ...view([]), todayDayId: null }]
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true) })
    expect(saveDaySessions).not.toHaveBeenCalled()
  })
})
