import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

const within60s = (iso: string) => Math.abs(Date.now() - new Date(iso).getTime()) < 60_000
const OLD = '2020-01-01T00:00:00Z'

describe('server-stamped received times', () => {
  it("received_at is the server's time, whatever the client sends", async () => {
    const u = await newUser()
    const deck = (await u.sb.from('decks').insert({ name: 'Cells' }).select('id').single()).data!.id as string
    const card = (await u.sb.from('cards').insert({ deck_id: deck, front: 'Q', back: 'A' }).select('id').single()).data!.id as string
    const ins = await u.sb.from('reviews').insert({ card_id: card, rating: 3, reviewed_at: OLD, received_at: OLD, prev_interval_days: 0, new_interval_days: 1 }).select('received_at, reviewed_at').single()
    expect(ins.error).toBeNull()
    expect(within60s(ins.data!.received_at)).toBe(true)
    expect(new Date(ins.data!.reviewed_at).getFullYear()).toBe(2020)
  })

  it("a task's done_received_at is stamped when it is ticked, and cleared when it is unticked", async () => {
    const u = await newUser()
    const t = (await u.sb.from('tasks').insert({ title: 'a', done_at: OLD, done_received_at: OLD }).select('id, done_received_at').single()).data!
    expect(within60s(t.done_received_at)).toBe(true)
    // a client cannot rewrite it
    await u.sb.from('tasks').update({ title: 'b', done_received_at: OLD }).eq('id', t.id)
    const same = (await u.sb.from('tasks').select('done_received_at').eq('id', t.id).single()).data!
    expect(same.done_received_at).toBe(t.done_received_at)
    await u.sb.from('tasks').update({ done_at: null }).eq('id', t.id)
    const cleared = (await u.sb.from('tasks').select('done_received_at').eq('id', t.id).single()).data!
    expect(cleared.done_received_at).toBeNull()
    await u.sb.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', t.id)
    const again = (await u.sb.from('tasks').select('done_received_at').eq('id', t.id).single()).data!
    expect(within60s(again.done_received_at)).toBe(true)
  })

  it('a finished quiz attempt gets finished_received_at; an unfinished one does not', async () => {
    const u = await newUser()
    const note = (await u.sb.from('notes').insert({ title: 'N', content_md: 'x' }).select('id').single()).data!.id as string
    const q = (await u.sb.from('quizzes').insert({ note_id: note, title: 'Q', questions: [{ id: 'q1', type: 'mcq', prompt: 'p', options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: 'x' }] }).select('id').single()).data!.id as string
    const open = (await u.sb.from('quiz_attempts').insert({ quiz_id: q, total: 1, finished_received_at: OLD }).select('id, finished_received_at').single()).data!
    expect(open.finished_received_at).toBeNull()
    const done = (await u.sb.from('quiz_attempts').update({ finished_at: OLD }).eq('id', open.id).select('finished_received_at').single()).data!
    expect(within60s(done.finished_received_at)).toBe(true)
  })

  it("a plan session's done_received_at is stamped in its jsonb when it is ticked", async () => {
    const u = await newUser()
    const course = (await u.sb.from('courses').insert({ name: 'Bio', color: '#1D9E75' }).select('id').single()).data!.id as string
    const exam = (await u.sb.from('tasks').insert({ title: 'Mid', type: 'exam', course_id: course, due_at: new Date(Date.now() + 14 * 86_400_000).toISOString() }).select('id').single()).data!.id as string
    const plan = (await u.sb.from('study_plans').insert({ course_id: course, exam_task_id: exam }).select('id').single()).data!.id as string
    const s = (id: string, done_at: string | null, extra: object = {}) => ({ id, topic_id: '11111111-1111-4111-8111-111111111111', kind: 'learn', minutes: 25, done_at, ...extra })
    const day = (await u.sb.from('study_plan_days').insert({ plan_id: plan, day: '2026-03-12', sessions: [s('a', null), s('b', null)] }).select('id, sessions').single()).data!
    expect(day.sessions.every((x: { done_received_at?: string }) => x.done_received_at === undefined)).toBe(true)
    const tick = (await u.sb.from('study_plan_days').update({ sessions: [s('a', OLD, { done_received_at: OLD }), s('b', null, { done_received_at: OLD })] }).eq('id', day.id).select('sessions').single()).data!
    expect(within60s(tick.sessions[0].done_received_at)).toBe(true)
    expect(tick.sessions[1].done_received_at).toBeUndefined()
    // saving again with the same done_at keeps the first stamp
    const first = tick.sessions[0].done_received_at
    await new Promise(r => setTimeout(r, 50))
    const keep = (await u.sb.from('study_plan_days').update({ sessions: [s('a', OLD, { done_received_at: OLD }), s('b', null)] }).eq('id', day.id).select('sessions').single()).data!
    expect(keep.sessions[0].done_received_at).toBe(first)
  })

  it('the other XP tables stamp received_at too', async () => {
    const u = await newUser()
    const f = (await u.sb.from('focus_sessions').insert({ started_at: OLD, ended_at: OLD, minutes: 5, completed: true, received_at: OLD }).select('received_at').single()).data!
    const l = (await u.sb.from('lectures').insert({ title: 'L', duration_seconds: 60, mime: 'audio/webm', recorded_at: OLD, received_at: OLD }).select('received_at').single()).data!
    const chat = (await u.sb.from('tutor_chats').insert({}).select('id').single()).data!.id as string
    const m = (await u.sb.from('tutor_messages').insert({ chat_id: chat, role: 'user', content: 'hi', created_at: OLD, received_at: OLD }).select('received_at').single()).data!
    const deck = (await u.sb.from('decks').insert({ name: 'D' }).select('id').single()).data!.id as string
    const g = (await u.sb.from('game_plays').insert({ deck_id: deck, game: 'match', score: 1, total: 1, created_at: OLD, received_at: OLD }).select('received_at').single()).data!
    for (const r of [f, l, m, g]) expect(within60s(r.received_at)).toBe(true)
  })

  it('on_time: 23 hours late counts, 25 hours late does not', async () => {
    const u = await newUser()
    const ask = async (claimed: string, received: string | null) => {
      const { data, error } = await u.sb.rpc('on_time', { claimed, received })
      expect(error).toBeNull()
      return data as boolean
    }
    expect(await ask('2026-03-10T00:00:00Z', '2026-03-10T23:00:00Z')).toBe(true)
    expect(await ask('2026-03-10T00:00:00Z', '2026-03-11T01:00:00Z')).toBe(false)
    expect(await ask('2026-03-11T01:00:00Z', '2026-03-10T00:00:00Z')).toBe(false)
    expect(await ask('2026-03-10T00:00:00Z', null)).toBe(false)
  })
})
