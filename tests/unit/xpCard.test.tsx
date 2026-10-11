// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { XpCard } from '@/components/xp/XpCard'
import { summarize, type ActivityDay } from '@/lib/xp/rules'

const day = (d: string, over: Partial<ActivityDay> = {}): ActivityDay =>
  ({ day: d, reviews: 0, quizzes: 0, focus_minutes: 0, tasks_done: 0, plan_sessions: 0, tutor_messages: 0, lectures: 0, ...over })
afterEach(cleanup)

describe('XpCard', () => {
  it('shows level, total XP, streaks and the way to the next level', () => {
    const days = [day('2026-03-08', { reviews: 50 }), day('2026-03-09', { reviews: 50 }), day('2026-03-10', { reviews: 20 })] // 120 XP
    render(<XpCard xp={summarize(days, '2026-03-10')} />)
    expect(screen.getByText('Level 2')).toBeTruthy()
    expect(screen.getByText('120 XP')).toBeTruthy()
    expect(screen.getByText('70 of 150 XP to level 3')).toBeTruthy()
    expect(screen.getAllByText('3 days')).toHaveLength(2) // and best
  })
  it('says 0 days and level 1 for a new student', () => {
    render(<XpCard xp={summarize([], '2026-03-10')} />)
    expect(screen.getByText('Level 1')).toBeTruthy()
    expect(screen.getAllByText('0 days')).toHaveLength(2)
  })
  it('draws the last 14 days with a title and a text alternative', () => {
    render(<XpCard xp={summarize([day('2026-03-09', { reviews: 6 })], '2026-03-10')} />)
    const chart = screen.getByRole('img', { name: /XP per day, last 14 days/ })
    expect(chart.getAttribute('aria-label')).toContain('2026-03-09: 6 XP')
    expect(chart.querySelectorAll('[title]')).toHaveLength(14)
    expect(chart.querySelector('[title="2026-03-09: 6 XP"]')).not.toBeNull()
  })
})
