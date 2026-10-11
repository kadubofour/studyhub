import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
type Row = { day: string; reviews: number; quizzes: number; focus_minutes: number; tasks_done: number; plan_sessions: number; tutor_messages: number; lectures: number }
const rows = async (u: U, tz = 'UTC') => {
  const { data, error } = await u.sb.rpc('activity_by_day', { p_tz: tz })
  expect(error).toBeNull()
  return data as Row[]
}
const on = (rs: Row[], day: string) => rs.find(r => r.day === day)
// 03:30 UTC on 10 March 2026 is 23:30 on 9 March in New York and 12:30 on 10 March in Tokyo
const LATE = '2026-03-10T03:30:00Z'
const deck = async (u: U) => (await u.sb.from('decks').insert({ name: 'Cells' }).select('id').single()).data!.id as string
const card = async (u: U, deckId: string) => (await u.sb.from('cards').insert({ deck_id: deckId, front: 'Q', back: 'A' }).select('id').single()).data!.id as string
const review = (u: U, cardId: string, at: string) => u.sb.from('reviews').insert({ card_id: cardId, rating: 3, reviewed_at: at, prev_interval_days: 0, new_interval_days: 1 })

describe('activity_by_day', () => {
  it('a new student has no activity', async () => {
    expect(await rows(await newUser())).toEqual([])
  })
  it('counts reviews per day', async () => {
    const u = await newUser()
    const c = await card(u, await deck(u))
    await review(u, c, '2026-03-10T10:00:00Z'); await review(u, c, '2026-03-10T11:00:00Z'); await review(u, c, '2026-03-11T10:00:00Z')
    const rs = await rows(u)
    expect(on(rs, '2026-03-10')?.reviews).toBe(2)
    expect(on(rs, '2026-03-11')?.reviews).toBe(1)
  })
  it('counts finished quizzes only, focus minutes, done tasks, tutor messages and lectures', async () => {
    const u = await newUser()
    const note = (await u.sb.from('notes').insert({ title: 'N', content_md: 'x' }).select('id').single()).data!.id as string
    const q = (await u.sb.from('quizzes').insert({ note_id: note, title: 'Q', questions: ['q1', 'q2', 'q3'].map(id => ({ id, type: 'mcq', prompt: id, options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: 'x' })) }).select('id').single()).data!.id as string
    await u.sb.from('quiz_attempts').insert({ quiz_id: q, total: 1, correct: 1, started_at: '2026-03-10T09:00:00Z', finished_at: '2026-03-10T09:05:00Z' })
    await u.sb.from('quiz_attempts').insert({ quiz_id: q, total: 1, correct: 0, started_at: '2026-03-10T09:10:00Z', finished_at: null })
    await u.sb.from('focus_sessions').insert([
      { started_at: '2026-03-10T10:00:00Z', ended_at: '2026-03-10T10:25:00Z', minutes: 25, completed: true },
      { started_at: '2026-03-10T12:00:00Z', ended_at: '2026-03-10T12:10:00Z', minutes: 10, completed: false },
    ])
    await u.sb.from('tasks').insert([{ title: 'a', done_at: '2026-03-10T08:00:00Z' }, { title: 'open' }])
    const chat = (await u.sb.from('tutor_chats').insert({}).select('id').single()).data!.id as string
    await u.sb.from('tutor_messages').insert([
      { chat_id: chat, role: 'user', content: 'hi', created_at: '2026-03-10T08:00:00Z' },
      { chat_id: chat, role: 'assistant', content: 'hello', created_at: '2026-03-10T08:00:01Z' },
    ])
    await u.sb.from('lectures').insert({ title: 'L', duration_seconds: 60, mime: 'audio/webm', recorded_at: '2026-03-10T07:00:00Z' })
    expect(on(await rows(u), '2026-03-10')).toEqual({ day: '2026-03-10', reviews: 0, quizzes: 1, focus_minutes: 35, tasks_done: 1, plan_sessions: 0, tutor_messages: 1, lectures: 1 })
  })
  it('counts study plan sessions on the day they were ticked', async () => {
    const u = await newUser()
    const course = (await u.sb.from('courses').insert({ name: 'Bio', color: '#1D9E75' }).select('id').single()).data!.id as string
    const exam = (await u.sb.from('tasks').insert({ title: 'Mid', type: 'exam', course_id: course, due_at: new Date(Date.now() + 14 * 86_400_000).toISOString() }).select('id').single()).data!.id as string
    const plan = (await u.sb.from('study_plans').insert({ course_id: course, exam_task_id: exam }).select('id').single()).data!.id as string
    await u.sb.from('study_plan_days').insert({
      plan_id: plan, day: '2026-03-12',
      sessions: [
        { id: 'a', topic_id: '11111111-1111-4111-8111-111111111111', kind: 'learn', minutes: 25, done_at: '2026-03-10T10:00:00Z' },
        { id: 'b', topic_id: '11111111-1111-4111-8111-111111111111', kind: 'revise', minutes: 25, done_at: null },
      ],
    })
    const rs = await rows(u)
    expect(on(rs, '2026-03-10')?.plan_sessions).toBe(1)
    expect(on(rs, '2026-03-12')).toBeUndefined()
  })
  it('puts the same record on different days in different time zones', async () => {
    const u = await newUser()
    await u.sb.from('tasks').insert({ title: 'late', done_at: LATE })
    expect(on(await rows(u, 'America/New_York'), '2026-03-09')?.tasks_done).toBe(1)
    expect(on(await rows(u, 'Asia/Tokyo'), '2026-03-10')?.tasks_done).toBe(1)
    expect(on(await rows(u, 'America/New_York'), '2026-03-10')).toBeUndefined()
  })
  it('never counts another student, and rejects an unknown time zone', async () => {
    const u = await newUser(), other = await newUser()
    await other.sb.from('tasks').insert({ title: 'theirs', done_at: LATE })
    expect(await rows(u)).toEqual([])
    const { error } = await u.sb.rpc('activity_by_day', { p_tz: 'Not/AZone' })
    expect(error).not.toBeNull()
  })
})
