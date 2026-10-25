import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'
import { dayXp, type ActivityDay } from '@/lib/xp/rules'

type U = Awaited<ReturnType<typeof newUser>>
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const many = <T,>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i))

describe('server XP', () => {
  it('my_xp_days matches dayXp for the same on-time activity', async () => {
    const u = await newUser()
    const now = new Date().toISOString()
    const deck = (await u.sb.from('decks').insert({ name: 'D' }).select('id').single()).data!.id as string
    const card = (await u.sb.from('cards').insert({ deck_id: deck, front: 'Q', back: 'A' }).select('id').single()).data!.id as string
    // 55 reviews (cap 50), 7 quizzes (cap 5), 12 tasks (cap 10), 12 tutor messages (cap 10), 3 lectures (cap 2), 4 games (cap 3), 9 plan sessions (cap 8), 130 focus minutes (cap 24 units)
    const r = await u.sb.from('reviews').insert(many(55, () => ({ card_id: card, rating: 3, reviewed_at: now, prev_interval_days: 0, new_interval_days: 1 })))
    expect(r.error).toBeNull()
    const note = (await u.sb.from('notes').insert({ title: 'N', content_md: 'x' }).select('id').single()).data!.id as string
    const q = (await u.sb.from('quizzes').insert({ note_id: note, title: 'Q', questions: [{ id: 'q1', type: 'mcq', prompt: 'p', options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: 'x' }] }).select('id').single()).data!.id as string
    expect((await u.sb.from('quiz_attempts').insert(many(7, () => ({ quiz_id: q, total: 1, correct: 1, started_at: now, finished_at: now })))).error).toBeNull()
    expect((await u.sb.from('focus_sessions').insert([
      { started_at: now, ended_at: now, minutes: 28, completed: true },
      { started_at: new Date(Date.now() - 1000).toISOString(), ended_at: now, minutes: 102, completed: true },
    ])).error).toBeNull()
    expect((await u.sb.from('tasks').insert(many(12, i => ({ title: `t${i}`, done_at: now })))).error).toBeNull()
    const chat = (await u.sb.from('tutor_chats').insert({}).select('id').single()).data!.id as string
    expect((await u.sb.from('tutor_messages').insert(many(12, i => ({ chat_id: chat, role: 'user', content: `m${i}`, created_at: now })))).error).toBeNull()
    expect((await u.sb.from('lectures').insert(many(3, i => ({ title: `L${i}`, duration_seconds: 60, mime: 'audio/webm', recorded_at: now })))).error).toBeNull()
    expect((await u.sb.from('game_plays').insert(many(4, () => ({ deck_id: deck, game: 'match', score: 1, total: 1, created_at: now })))).error).toBeNull()
    const course = (await u.sb.from('courses').insert({ name: 'Bio', color: '#1D9E75' }).select('id').single()).data!.id as string
    const exam = (await u.sb.from('tasks').insert({ title: 'Mid', type: 'exam', course_id: course, due_at: ago(-14) }).select('id').single()).data!.id as string
    const plan = (await u.sb.from('study_plans').insert({ course_id: course, exam_task_id: exam }).select('id').single()).data!.id as string
    expect((await u.sb.from('study_plan_days').insert({
      plan_id: plan, day: '2026-03-12',
      sessions: many(9, i => ({ id: `s${i}`, topic_id: '11111111-1111-4111-8111-111111111111', kind: 'learn', minutes: 25, done_at: now })),
    })).error).toBeNull()

    const act = await u.sb.rpc('activity_by_day', { p_tz: 'America/New_York' })
    expect(act.error).toBeNull()
    const expected = (act.data as ActivityDay[]).map(a => ({ day: a.day, xp: dayXp(a) })).filter(d => d.xp > 0)
    const mine = await u.sb.rpc('my_xp_days')
    expect(mine.error).toBeNull()
    expect(expected.length).toBeGreaterThan(0)
    // every cap is exceeded and the 20 XP bonus is met: 50+50+24+50+64+20+30+24+20
    expect(expected).toHaveLength(1)
    expect(expected[0].xp).toBe(50 + 50 + 24 + 50 + 64 + 20 + 30 + 24 + 20)
    expect(mine.data).toEqual(expected)
  })

  it('back-filled activity earns no XP', async () => {
    const u: U = await newUser()
    const deck = (await u.sb.from('decks').insert({ name: 'D' }).select('id').single()).data!.id as string
    const card = (await u.sb.from('cards').insert({ deck_id: deck, front: 'Q', back: 'A' }).select('id').single()).data!.id as string
    const ins = await u.sb.from('reviews').insert({ card_id: card, rating: 3, reviewed_at: ago(10), prev_interval_days: 0, new_interval_days: 1 })
    expect(ins.error).toBeNull()
    const act = await u.sb.rpc('activity_by_day', { p_tz: 'America/New_York' })
    expect((act.data as ActivityDay[]).reduce((n, a) => n + a.reviews, 0)).toBe(1)
    const mine = await u.sb.rpc('my_xp_days')
    expect(mine.error).toBeNull()
    expect(mine.data).toEqual([])
  })

  it('xp_days and xp_totals cannot be called by a student', async () => {
    const u = await newUser(), other = await newUser()
    expect((await u.sb.rpc('xp_days', { p_user: other.id })).error).not.toBeNull()
    expect((await u.sb.rpc('xp_days', { p_user: u.id })).error).not.toBeNull()
    expect((await u.sb.rpc('xp_totals', { p_user: other.id })).error).not.toBeNull()
  })
})

describe('xp_totals', () => {
  it('totals, this week and the streak, for the internal caller', async () => {
    const u = await newUser()
    const { adminClient } = await import('./helpers')
    await u.sb.from('tasks').insert([{ title: 'a', done_at: new Date().toISOString() }])
    const { data, error } = await adminClient().rpc('xp_totals', { p_user: u.id })
    expect(error).toBeNull()
    expect(data).toEqual([{ total: 5, week: 5, streak: 1 }])
  })
})
