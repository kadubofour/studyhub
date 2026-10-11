// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { DailyGoalsCard } from '@/components/xp/DailyGoalsCard'
import { summarize, type ActivityDay } from '@/lib/xp/rules'

const day = (over: Partial<ActivityDay> = {}): ActivityDay =>
  ({ day: '2026-03-10', reviews: 0, quizzes: 0, focus_minutes: 0, tasks_done: 0, plan_sessions: 0, tutor_messages: 0, lectures: 0, games: 0, ...over })
const show = (d: Partial<ActivityDay>[]) => render(<DailyGoalsCard xp={summarize(d.map(x => day(x)), '2026-03-10')} />)
afterEach(cleanup)

describe('DailyGoalsCard', () => {
  it('lists the three goals with progress and today’s XP', () => {
    show([{ reviews: 4, focus_minutes: 10 }])
    const list = screen.getByRole('list', { name: 'Daily goals' })
    expect(within(list).getByText('Review 10 cards')).toBeTruthy()
    expect(within(list).getByText('4 / 10')).toBeTruthy()
    expect(within(list).getByText('10 / 25 min')).toBeTruthy()
    expect(within(list).getByText('0 / 1')).toBeTruthy()
    expect(screen.getByText('+6 XP today')).toBeTruthy()
  })
  it('says Done in words for a met goal and not for the others', () => {
    show([{ reviews: 12 }])
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Done')).toBeTruthy()
    expect(within(items[1]).queryByText('Done')).toBeNull()
  })
  it('shows the bonus until all three are done, then says it was earned', () => {
    show([{ reviews: 3 }])
    expect(screen.getByText('Finish all three for +20 XP')).toBeTruthy()
    cleanup()
    show([{ reviews: 10, focus_minutes: 25, quizzes: 1 }])
    expect(screen.queryByText('Finish all three for +20 XP')).toBeNull()
    expect(screen.getByText('All three done, bonus earned')).toBeTruthy()
  })
  it('shows the level bar with how much is left', () => {
    show([{ reviews: 30 }]) // 30 XP, level 1 of 50
    const bar = screen.getByRole('progressbar', { name: 'Progress to level 2' })
    expect(bar.getAttribute('aria-valuenow')).toBe('30')
    expect(bar.getAttribute('aria-valuemax')).toBe('50')
    expect(screen.getByText('30 of 50 XP to level 2')).toBeTruthy()
  })
})
