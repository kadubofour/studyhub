// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { TopicStat } from '@/lib/topics/types'
import type { Course } from '@/lib/types'

const stat = (over: Partial<TopicStat>): TopicStat => ({
  topic_id: 't1', name: 'Krebs cycle', position: 1, answers_30d: 12, correct_30d: 8, answers_all: 12, last_practised: new Date().toISOString(),
  notes: 1, lectures: 0, decks: 0, status: 'weak', ...over,
})
const courses: Course[] = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }, { id: 'c2', name: 'Chemistry', color: '#BA7517' }]
let byCourse: Record<string, TopicStat[]>
let loadFails = false
const push = vi.fn()
const startRevision = vi.fn(async (..._a: unknown[]) => '/tutor/chat9?ask=Quiz%20me%20on%20Krebs%20cycle')
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/topics', () => ({ listTopicStats: async (_sb: unknown, id: string) => { if (loadFails) throw new Error('offline'); return byCourse[id] ?? [] } }))
vi.mock('@/lib/tutor/revise', () => ({ startRevision: (...a: unknown[]) => startRevision(...a) }))
const router = { push }
vi.mock('next/navigation', () => ({ useRouter: () => router }))
import { WeakSpotsCard } from '@/components/topics/WeakSpotsCard'
import { ToastProvider } from '@/components/providers/ToastProvider'

const open = async (cs: Course[] = courses) => { await act(async () => { render(<ToastProvider><WeakSpotsCard courses={cs} /></ToastProvider>) }) }
beforeEach(() => { byCourse = {}; loadFails = false; push.mockClear(); startRevision.mockClear() })
afterEach(cleanup)

describe('WeakSpotsCard', () => {
  it('shows nothing when no topic is weak or stale, when there are no topics or courses, or when loading fails', async () => {
    byCourse = { c1: [stat({ status: 'mastered', answers_30d: 10, correct_30d: 10 }), stat({ topic_id: 't2', status: 'not_started', answers_30d: 0, answers_all: 0, last_practised: null })] }
    await open()
    expect(screen.queryByRole('region', { name: 'Weak spots' })).toBeNull()
    cleanup()
    await open([])
    expect(screen.queryByRole('region', { name: 'Weak spots' })).toBeNull()
    cleanup()
    byCourse = { c1: [stat({})] }; loadFails = true
    await open()
    expect(screen.queryByRole('region', { name: 'Weak spots' })).toBeNull()
  })
  it('ranks the weakest across courses and shows at most three, with the numbers and the course', async () => {
    byCourse = {
      c1: [stat({ topic_id: 'a', name: 'Alpha', answers_30d: 10, correct_30d: 5 }), stat({ topic_id: 'b', name: 'Beta', answers_30d: 10, correct_30d: 1 })],
      c2: [stat({ topic_id: 'c', name: 'Gamma', answers_30d: 10, correct_30d: 3 }), stat({ topic_id: 'd', name: 'Delta', answers_30d: 10, correct_30d: 4 })],
    }
    await open()
    const card = screen.getByRole('region', { name: 'Weak spots' })
    expect(within(card).getAllByRole('listitem').map(li => li.getAttribute('aria-label'))).toEqual(['Beta', 'Gamma', 'Delta'])
    expect(within(card).getByRole('listitem', { name: 'Beta' }).textContent).toContain('10 answers, 10% right in the last 30 days')
    expect(within(card).getByRole('listitem', { name: 'Gamma' }).textContent).toContain('Chemistry')
  })
  it('includes a covered topic that has not been practised for a while', async () => {
    byCourse = { c1: [stat({ name: 'Dusty', status: 'covered', answers_30d: 0, correct_30d: 0, answers_all: 5, last_practised: '2026-01-01T00:00:00Z' })] }
    await open()
    expect(screen.getByRole('listitem', { name: 'Dusty' }).textContent).toContain('Not practised in the last 30 days')
  })
  it('Revise makes the chat and opens it', async () => {
    byCourse = { c1: [stat({})] }
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Revise Krebs cycle' })) })
    expect(startRevision).toHaveBeenCalledWith(expect.anything(), { id: 't1', name: 'Krebs cycle' }, 'c1')
    expect(push).toHaveBeenCalledWith('/tutor/chat9?ask=Quiz%20me%20on%20Krebs%20cycle')
  })
  it('says so and stays put when the chat cannot be made', async () => {
    byCourse = { c1: [stat({})] }
    startRevision.mockRejectedValueOnce(new Error('rls'))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Revise Krebs cycle' })) })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByText('Couldn\'t open the tutor. Try again.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Revise Krebs cycle' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
