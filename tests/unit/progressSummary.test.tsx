// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ProgressSummary } from '@/components/progress/ProgressSummary'
import { summarize, type ActivityDay } from '@/lib/xp/rules'

const day = (d: string, over: Partial<ActivityDay> = {}): ActivityDay =>
  ({ day: d, reviews: 0, quizzes: 0, focus_minutes: 0, tasks_done: 0, plan_sessions: 0, tutor_messages: 0, lectures: 0, games: 0, ...over })
afterEach(cleanup)
const STATS = [{ label: 'Current streak', value: '3 days' }, { label: 'Best streak', value: '8 days' }, { label: 'Focus this week', value: '5h 30m' }, { label: 'Retention (30 days)', value: '82%' }]
const xp = () => summarize([day('2026-03-08', { reviews: 50 }), day('2026-03-09', { reviews: 50 }), day('2026-03-10', { reviews: 20 })], '2026-03-10') // 120 XP

describe('ProgressSummary', () => {
  it('shows the level in a ring, the total XP and the way to the next level', () => {
    render(<ProgressSummary xp={xp()} stats={STATS} />)
    expect(screen.getByText('Level 2')).toBeTruthy()
    expect(screen.getByText('120 XP')).toBeTruthy()
    expect(screen.getByText('70 of 150 XP to level 3')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progress to level 3' }).getAttribute('aria-valuetext')).toBe('70 of 150 XP')
    expect(screen.getByTestId('level-ring').getAttribute('aria-hidden')).toBe('true')
  })
  it('has the four study stats in one named list', () => {
    render(<ProgressSummary xp={xp()} stats={STATS} />)
    const list = screen.getByRole('list', { name: 'Study stats' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map(i => i.textContent)).toEqual(['Current streak3 days', 'Best streak8 days', 'Focus this week5h 30m', 'Retention (30 days)82%'])
  })
  it('draws the last 14 days of XP with a text alternative', () => {
    render(<ProgressSummary xp={summarize([day('2026-03-09', { reviews: 6 })], '2026-03-10')} stats={STATS} />)
    const chart = screen.getByRole('img', { name: /XP per day, last 14 days/ })
    expect(chart.getAttribute('aria-label')).toContain('2026-03-09: 6 XP')
    expect(chart.querySelectorAll('[title]')).toHaveLength(14)
  })
  it('still shows the stats when XP could not be read', () => {
    render(<ProgressSummary xp={null} stats={STATS} />)
    expect(screen.getByRole('list', { name: 'Study stats' })).toBeTruthy()
    expect(screen.queryByText(/^Level/)).toBeNull()
  })
  it('says level 1 for a new student', () => {
    render(<ProgressSummary xp={summarize([], '2026-03-10')} stats={STATS} />)
    expect(screen.getByText('Level 1')).toBeTruthy()
  })
})
