// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { Flame } from 'lucide-react'
import { ProgressHero } from '@/components/progress/ProgressHero'
import { StatTiles } from '@/components/progress/StatTiles'
import { MiniBars } from '@/components/progress/MiniBars'
import { headline, weekDots } from '@/lib/progress/summary'
import { summarize, type ActivityDay } from '@/lib/xp/rules'

afterEach(cleanup)
const day = (d: string, over: Partial<ActivityDay> = {}): ActivityDay =>
  ({ day: d, reviews: 0, quizzes: 0, focus_minutes: 0, tasks_done: 0, plan_sessions: 0, tutor_messages: 0, lectures: 0, games: 0, ...over })
const TODAY = '2026-10-14' // a Wednesday
const xp = () => summarize([day('2026-10-12', { reviews: 50 }), day('2026-10-13', { reviews: 50 }), day('2026-10-14', { reviews: 20 })], TODAY) // 120 XP
const hero = (over: Partial<Parameters<typeof ProgressHero>[0]> = {}) => render(
  <ProgressHero xp={xp()} headline={headline({ streak: 3, goalMinutes: 120, todayMinutes: 45, weekMinutes: 200, totalXp: 120 })}
    dots={weekDots(TODAY, new Map([['2026-10-12', 130], ['2026-10-13', 20]]), 120)} todayMinutes={45} goalMinutes={120} {...over} />)

describe('ProgressHero', () => {
  it('opens with how the student is doing in words, and a way to carry on', () => {
    hero()
    expect(screen.getByRole('heading', { level: 2, name: '3 days in a row. Keep it going.' })).toBeTruthy()
    expect(screen.getByText('1h 15m more of focus reaches today\'s goal.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start focus' }).getAttribute('href')).toBe('/focus')
  })
  it('shows the level in a ring, the total XP and the way to the next level', () => {
    hero()
    expect(screen.getByText('Level 2')).toBeTruthy()
    expect(screen.getByText('120 XP')).toBeTruthy()
    expect(screen.getByText('70 of 150 XP to level 3')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progress to level 3' }).getAttribute('aria-valuetext')).toBe('70 of 150 XP')
    expect(screen.getByTestId('level-ring').getAttribute('aria-hidden')).toBe('true')
  })
  it('draws the week day by day, saying in words what each day was', () => {
    hero()
    const week = within(screen.getByRole('list', { name: 'This week' }))
    expect(week.getAllByRole('listitem').map(li => li.getAttribute('aria-label'))).toEqual([
      'Monday: goal reached', 'Tuesday: 20m of focus', 'Wednesday: no focus', 'Thursday: still to come', 'Friday: still to come', 'Saturday: still to come', 'Sunday: still to come'])
    expect(screen.getByText(/2 of 7 days, goal reached on 1/)).toBeTruthy()
  })
  it('shows today\'s focus against the goal, and leaves it out when there is no goal', () => {
    hero()
    const bar = screen.getByRole('progressbar', { name: 'Today\'s focus goal' })
    expect(bar.getAttribute('aria-valuetext')).toBe('45m of 2h')
    expect(bar.getAttribute('aria-valuenow')).toBe('45')
    cleanup(); hero({ goalMinutes: 0 })
    expect(screen.queryByRole('progressbar', { name: 'Today\'s focus goal' })).toBeNull()
  })
  it('invites a new student in instead of showing zeros', () => {
    hero({ xp: summarize([], TODAY), headline: headline({ streak: 0, goalMinutes: 120, todayMinutes: 0, weekMinutes: 0, totalXp: 0 }), dots: weekDots(TODAY, new Map(), 120), todayMinutes: 0 })
    expect(screen.getByRole('heading', { level: 2, name: 'Your first session starts it all.' })).toBeTruthy()
    expect(screen.getByText(/a fresh week/)).toBeTruthy()
    expect(screen.getByText('Level 1')).toBeTruthy()
  })
  it('still shows the sentence and the week when XP could not be read', () => {
    hero({ xp: null })
    expect(screen.queryByText(/^Level/)).toBeNull()
    expect(screen.getByRole('list', { name: 'This week' })).toBeTruthy()
  })
})

describe('StatTiles', () => {
  it('has each number in one named list, with its label and a line about it', () => {
    render(<StatTiles stats={[{ label: 'Streak', value: '0 days', sub: 'Study today to start one', icon: Flame, tone: 'a' }, { label: 'Focus this week', value: '3h 41m', sub: 'The same as last week', icon: Flame, tone: 'b' }]} />)
    const items = within(screen.getByRole('list', { name: 'Study stats' })).getAllByRole('listitem')
    expect(items.map(i => i.textContent)).toEqual(['Streak0 daysStudy today to start one', 'Focus this week3h 41mThe same as last week'])
  })
})

describe('MiniBars', () => {
  const bars = [{ key: 'a', value: 0, label: 'Mon', tip: 'a: 0' }, { key: 'b', value: 30, label: 'Tue', tip: 'b: 30' }, { key: 'c', value: 60, label: 'Wed', tip: 'c: 60', now: true }]
  it('gives the chart a text alternative, a tip on each bar, and a quiet line for an empty one', () => {
    const { container } = render(<MiniBars bars={bars} aria="Three days" />)
    expect(screen.getByRole('img', { name: 'Three days' })).toBeTruthy()
    expect(container.querySelectorAll('[title]')).toHaveLength(3)
    const fills = container.querySelectorAll('[title] > div > div')
    expect((fills[0] as HTMLElement).style.height).toBe('3px') // nothing that day: a thin line, not a hole
    expect((fills[2] as HTMLElement).style.height).toBe('100%')
    expect((fills[1] as HTMLElement).style.height).toBe('50%')
  })
  it('writes the numbers above the bars only when asked, and not for an empty one', () => {
    render(<MiniBars bars={bars} aria="x" values format={n => `${n}m`} />)
    expect(screen.getByText('30m')).toBeTruthy()
    expect(screen.getByText('60m')).toBeTruthy()
    expect(screen.queryByText('0m')).toBeNull()
  })
})
