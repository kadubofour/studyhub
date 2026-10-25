import { describe, it, expect } from 'vitest'
import { dayXp, levelInfo, summarize, GOALS, type ActivityDay } from '@/lib/xp/rules'

const day = (d: string, over: Partial<ActivityDay> = {}): ActivityDay =>
  ({ day: d, reviews: 0, quizzes: 0, focus_minutes: 0, tasks_done: 0, plan_sessions: 0, tutor_messages: 0, lectures: 0, games: 0, ...over })

describe('dayXp', () => {
  it('pays each kind at its rate', () => {
    expect(dayXp(day('d', { reviews: 7 }))).toBe(7)
    expect(dayXp(day('d', { quizzes: 2 }))).toBe(20)
    expect(dayXp(day('d', { focus_minutes: 24 }))).toBe(4) // 1 per whole 5 minutes
    expect(dayXp(day('d', { tasks_done: 3 }))).toBe(15)
    expect(dayXp(day('d', { plan_sessions: 2 }))).toBe(16)
    expect(dayXp(day('d', { tutor_messages: 4 }))).toBe(8)
    expect(dayXp(day('d', { lectures: 1 }))).toBe(15)
    expect(dayXp(day('d', { games: 2 }))).toBe(16)
  })
  it('stops paying past each daily cap', () => {
    expect(dayXp(day('d', { reviews: 500 }))).toBe(50)
    expect(dayXp(day('d', { quizzes: 9 }))).toBe(50)
    expect(dayXp(day('d', { focus_minutes: 600 }))).toBe(24)
    expect(dayXp(day('d', { tasks_done: 99 }))).toBe(50)
    expect(dayXp(day('d', { plan_sessions: 99 }))).toBe(64)
    expect(dayXp(day('d', { tutor_messages: 99 }))).toBe(20)
    expect(dayXp(day('d', { lectures: 9 }))).toBe(30)
    expect(dayXp(day('d', { games: 9 }))).toBe(24)
  })
  it('adds the bonus only when all three goals are met', () => {
    expect(dayXp(day('d', { reviews: 10, focus_minutes: 25, quizzes: 1 }))).toBe(10 + 5 + 10 + 20)
    expect(dayXp(day('d', { reviews: 10, focus_minutes: 24, quizzes: 1 }))).toBe(10 + 4 + 10)
    expect(dayXp(day('d', { reviews: 9, focus_minutes: 25, quizzes: 1 }))).toBe(9 + 5 + 10)
    expect(dayXp(day('d', { reviews: 10, focus_minutes: 25 }))).toBe(10 + 5)
  })
  it('is zero for an empty day', () => { expect(dayXp(day('d'))).toBe(0) })
})

describe('levelInfo', () => {
  it('starts at level 1 with nothing', () => { expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, span: 50, toNext: 50 }) })
  it('changes level exactly at 50, 200, 450 and 800', () => {
    expect(levelInfo(49).level).toBe(1)
    expect(levelInfo(50).level).toBe(2)
    expect(levelInfo(199).level).toBe(2)
    expect(levelInfo(200).level).toBe(3)
    expect(levelInfo(449).level).toBe(3)
    expect(levelInfo(450).level).toBe(4)
    expect(levelInfo(800).level).toBe(5)
  })
  it('says how far into the level and how far is left', () => {
    expect(levelInfo(120)).toMatchObject({ level: 2, into: 70, span: 150, toNext: 80 })
  })
})

describe('summarize', () => {
  const today = '2026-03-10'
  it('is level 1 and empty for a new student', () => {
    const s = summarize([], today)
    expect(s).toMatchObject({ total: 0, today: 0, streak: 0, best: 0 })
    expect(s.level.level).toBe(1)
    expect(s.last14).toHaveLength(14)
    expect(s.last14.at(-1)).toEqual({ day: today, xp: 0 })
    expect(s.goals.map(g => g.done)).toEqual([false, false, false])
  })
  it('totals every day and reports today', () => {
    const s = summarize([day('2026-03-08', { reviews: 5 }), day(today, { tasks_done: 2 })], today)
    expect(s.total).toBe(15)
    expect(s.today).toBe(10)
  })
  it('shows progress on each goal and when it is done', () => {
    const s = summarize([day(today, { reviews: 4, focus_minutes: 25, quizzes: 0 })], today)
    expect(s.goals.map(g => [g.key, g.value, g.target, g.done])).toEqual([['reviews', 4, 10, false], ['focus', 25, 25, true], ['quiz', 0, 1, false]])
    expect(s.allDone).toBe(false)
    expect(GOALS).toHaveLength(3)
  })
  it('counts the streak back from today', () => {
    const s = summarize([day('2026-03-08', { reviews: 1 }), day('2026-03-09', { reviews: 1 }), day(today, { reviews: 1 })], today)
    expect(s.streak).toBe(3)
  })
  it('keeps the streak alive when today has no activity yet', () => {
    const s = summarize([day('2026-03-08', { reviews: 1 }), day('2026-03-09', { reviews: 1 })], today)
    expect(s.streak).toBe(2)
  })
  it('ends the streak after a missed day, and remembers the best run', () => {
    const s = summarize([day('2026-03-01', { reviews: 1 }), day('2026-03-02', { reviews: 1 }), day('2026-03-03', { reviews: 1 }), day('2026-03-09', { reviews: 1 })], today)
    expect(s.streak).toBe(1)
    expect(s.best).toBe(3)
    expect(summarize([day('2026-03-05', { reviews: 1 })], today).streak).toBe(0)
  })
  it('takes total, streak and level from server XP when given', () => {
    const s = summarize([day(today)], today, [{ day: today, xp: 60 }])
    expect(s).toMatchObject({ total: 60, today: 60, streak: 1, best: 1 })
    expect(s.level.level).toBe(2)
    expect(s.last14.at(-1)).toEqual({ day: today, xp: 60 })
  })
  it('counts a day with only a game as active for the streak', () => {
    expect(summarize([day('2026-03-09', { games: 1 })], today).streak).toBe(1)
  })
  it('ignores days with no points when counting the streak', () => {
    expect(summarize([day('2026-03-09', { focus_minutes: 4 })], today).streak).toBe(0)
  })
  it('lists the last 14 days oldest first with their points', () => {
    const s = summarize([day('2026-03-09', { reviews: 6 }), day('2026-02-01', { reviews: 6 })], today)
    expect(s.last14[0].day).toBe('2026-02-25')
    expect(s.last14.find(d => d.day === '2026-03-09')?.xp).toBe(6)
    expect(s.last14.find(d => d.day === '2026-02-01')).toBeUndefined()
  })
})
