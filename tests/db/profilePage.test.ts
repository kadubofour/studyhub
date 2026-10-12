import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
type Stats = { notes: number; decks: number; cards: number; lectures: number; lecture_minutes: number; quizzes_done: number; focus_minutes: number; reviews: number; games: number; tutor_messages: number; courses: number }
const stats = async (u: U) => { const { data, error } = await u.sb.rpc('profile_stats'); expect(error).toBeNull(); return (Array.isArray(data) ? data[0] : data) as Stats }

describe('profile columns', () => {
  it('start empty, with a default avatar colour, and accept a school, a programme and a colour', async () => {
    const u = await newUser()
    const { data } = await u.sb.from('profiles').select('school,programme,avatar_color').eq('id', u.id).single()
    expect(data).toEqual({ school: null, programme: null, avatar_color: '#3B5BDB' })
    const ok = await u.sb.from('profiles').update({ school: 'University of Ghana', programme: 'Biology', avatar_color: '#D4537E' }).eq('id', u.id)
    expect(ok.error).toBeNull()
  })
  it('refuse a long or empty school or programme, and anything that is not a colour', async () => {
    const u = await newUser()
    for (const bad of [{ display_name: 'a'.repeat(81) }, { display_name: '' }, { school: 'a'.repeat(81) }, { school: '' }, { programme: 'a'.repeat(81) }, { programme: '' }, { avatar_color: 'red' }, { avatar_color: '#12345' }, { avatar_color: '#GGGGGG' }]) {
      expect((await u.sb.from('profiles').update(bad).eq('id', u.id)).error, JSON.stringify(bad)).not.toBeNull()
    }
  })
})

describe('profile_stats', () => {
  it('is all zeros for a new student', async () => {
    const s = await stats(await newUser())
    expect(Object.values(s).every(v => v === 0)).toBe(true)
  })
  it('counts what the student has made and done', async () => {
    const u = await newUser()
    const course = (await u.sb.from('courses').insert({ name: 'Bio', color: '#1D9E75' }).select('id').single()).data!.id as string
    const note = (await u.sb.from('notes').insert({ title: 'N', content_md: 'x', course_id: course }).select('id').single()).data!.id as string
    await u.sb.from('notes').insert({ title: 'N2', content_md: 'x' })
    const deck = (await u.sb.from('decks').insert({ name: 'D' }).select('id').single()).data!.id as string
    const cards = (await u.sb.from('cards').insert([{ deck_id: deck, front: 'a', back: 'b' }, { deck_id: deck, front: 'c', back: 'd' }, { deck_id: deck, front: 'e', back: 'f' }]).select('id')).data!
    await u.sb.from('reviews').insert([cards[0], cards[1]].map(c => ({ card_id: c.id, rating: 3, prev_interval_days: 0, new_interval_days: 1 })))
    await u.sb.from('lectures').insert([{ title: 'L1', duration_seconds: 600, mime: 'audio/webm' }, { title: 'L2', duration_seconds: 1500, mime: 'audio/webm' }])
    await u.sb.from('focus_sessions').insert([{ started_at: '2026-03-10T10:00:00Z', ended_at: '2026-03-10T10:25:00Z', minutes: 25, completed: true }, { started_at: '2026-03-11T10:00:00Z', ended_at: '2026-03-11T10:35:00Z', minutes: 35, completed: true }])
    const mcq = (id: string) => ({ id, type: 'mcq', prompt: id, options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: 'x' })
    const quiz = (await u.sb.from('quizzes').insert({ note_id: note, title: 'Q', questions: [mcq('1'), mcq('2'), mcq('3')] }).select('id').single()).data!.id as string
    await u.sb.from('quiz_attempts').insert([{ quiz_id: quiz, total: 3, correct: 2, finished_at: new Date().toISOString() }, { quiz_id: quiz, total: 3, correct: 0, finished_at: null }])
    await u.sb.from('game_plays').insert({ game: 'speed', score: 3, total: 4 })
    const chat = (await u.sb.from('tutor_chats').insert({}).select('id').single()).data!.id as string
    await u.sb.from('tutor_messages').insert([{ chat_id: chat, role: 'user', content: 'hi' }, { chat_id: chat, role: 'assistant', content: 'hello' }, { chat_id: chat, role: 'user', content: 'more' }])
    expect(await stats(u)).toEqual({ notes: 2, decks: 1, cards: 3, lectures: 2, lecture_minutes: 35, quizzes_done: 1, focus_minutes: 60, reviews: 2, games: 1, tutor_messages: 2, courses: 1 })
  })
  it('never counts another student', async () => {
    const u = await newUser(), other = await newUser()
    await other.sb.from('notes').insert({ title: 'Theirs', content_md: 'x' })
    await other.sb.from('courses').insert({ name: 'Theirs', color: '#1D9E75' })
    const s = await stats(u)
    expect(s.notes).toBe(0)
    expect(s.courses).toBe(0)
  })
})
