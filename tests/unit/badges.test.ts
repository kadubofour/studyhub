import { describe, it, expect } from 'vitest'
import { BADGES, earnedCount, evaluate, inDisplayOrder, type Stats } from '@/lib/profile/badges'

const ZERO: Stats = { notes: 0, decks: 0, cards: 0, lectures: 0, lecture_minutes: 0, quizzes_done: 0, focus_minutes: 0, reviews: 0, games: 0, tutor_messages: 0, courses: 0 }
const ctx = (over: Partial<Stats> = {}, extra: { bestStreak?: number; level?: number } = {}) => ({ stats: { ...ZERO, ...over }, bestStreak: extra.bestStreak ?? 0, level: extra.level ?? 1 })
const by = (c: ReturnType<typeof ctx>) => Object.fromEntries(evaluate(c).map(b => [b.id, b]))

describe('badges', () => {
  it('has twelve, each with a name and a way to earn it', () => {
    expect(BADGES).toHaveLength(12)
    expect(new Set(BADGES.map(b => b.id)).size).toBe(12)
    for (const b of BADGES) { expect(b.label.length).toBeGreaterThan(2); expect(b.how.length).toBeGreaterThan(5); expect(b.target).toBeGreaterThan(0) }
  })
  it('shows every one as locked, with its progress, for a new student', () => {
    const all = evaluate(ctx())
    expect(all.every(b => !b.earned)).toBe(true)
    expect(all.filter(b => b.id !== 'level-5').every(b => b.value === 0)).toBe(true)
    expect(all.find(b => b.id === 'level-5')!.value).toBe(1) // everyone starts at level 1
    expect(earnedCount(all)).toBe(0)
  })
  it('earns each at its target', () => {
    const cases: [string, Partial<Stats>, { bestStreak?: number; level?: number }][] = [
      ['first-note', { notes: 1 }, {}], ['note-taker', { notes: 10 }, {}], ['card-collector', { cards: 50 }, {}], ['reviewer', { reviews: 100 }, {}],
      ['first-lecture', { lectures: 1 }, {}], ['deep-focus', { focus_minutes: 600 }, {}], ['quiz-ace', { quizzes_done: 5 }, {}], ['player', { games: 5 }, {}],
      ['curious', { tutor_messages: 20 }, {}], ['streak-3', {}, { bestStreak: 3 }], ['streak-7', {}, { bestStreak: 7 }], ['level-5', {}, { level: 5 }],
    ]
    for (const [id, stats, extra] of cases) expect(by(ctx(stats, extra))[id].earned, id).toBe(true)
  })
  it('does not earn one a step short', () => {
    const b = by(ctx({ notes: 9, cards: 49, reviews: 99, focus_minutes: 599, quizzes_done: 4, games: 4, tutor_messages: 19 }, { bestStreak: 2, level: 4 }))
    for (const id of ['note-taker', 'card-collector', 'reviewer', 'deep-focus', 'quiz-ace', 'player', 'curious', 'streak-3', 'level-5']) expect(b[id].earned, id).toBe(false)
  })
  it('shows progress towards a locked one, never past its target', () => {
    const b = by(ctx({ notes: 4, cards: 500 }))
    expect(b['note-taker']).toMatchObject({ value: 4, target: 10, earned: false })
    expect(b['card-collector']).toMatchObject({ value: 50, target: 50, earned: true })
  })
  it('measures deep focus in hours', () => {
    expect(by(ctx({ focus_minutes: 180 }))['deep-focus']).toMatchObject({ value: 3, target: 10, unit: 'hours' })
  })
  it('describes what is counted without overclaiming', () => {
    const how = Object.fromEntries(BADGES.map(b => [b.id, b.how]))
    expect(how['reviewer']).toBe('Do 100 card reviews')
    expect(how['quiz-ace']).toBe('Finish 5 quiz attempts')
  })
  it('lists the earned ones first, then the locked ones closest to done, keeping the usual order for a tie', () => {
    const order = inDisplayOrder(evaluate(ctx({ notes: 1, focus_minutes: 300, games: 1, tutor_messages: 4 }, { level: 2 }))).map(b => b.id)
    expect(order.slice(0, 1)).toEqual(['first-note'])
    // locked: deep-focus 5/10, level-5 2/5, note-taker 1/10, player 1/5 and curious 4/20 (0.2 each, player first), ...
    expect(order.slice(1, 5)).toEqual(['deep-focus', 'level-5', 'player', 'curious'])
    expect(order).toHaveLength(12)
  })
  it('does not change the list it was given', () => {
    const states = evaluate(ctx({ notes: 1 }))
    const copy = states.map(b => b.id)
    inDisplayOrder(states)
    expect(states.map(b => b.id)).toEqual(copy)
  })
  it('counts how many are earned', () => {
    expect(earnedCount(evaluate(ctx({ notes: 10, lectures: 1 })))).toBe(3) // first note, note-taker, first lecture
  })
})
