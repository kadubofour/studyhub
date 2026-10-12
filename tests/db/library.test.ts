import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'
import { loadLibrary, moveItems } from '@/lib/data/library'

type U = Awaited<ReturnType<typeof newUser>>
const course = async (u: U, name: string) => (await u.sb.from('courses').insert({ name, color: '#1D9E75' }).select('id').single()).data!.id as string
async function material(u: U, courseId: string | null) {
  const note = (await u.sb.from('notes').insert({ title: 'Krebs', content_md: 'x', course_id: courseId }).select('id').single()).data!.id as string
  const deck = (await u.sb.from('decks').insert({ name: 'Cells', course_id: courseId }).select('id').single()).data!.id as string
  await u.sb.from('cards').insert([{ deck_id: deck, front: 'a', back: 'b' }, { deck_id: deck, front: 'c', back: 'd' }])
  const lecture = (await u.sb.from('lectures').insert({ title: 'Week 3', duration_seconds: 1800, mime: 'audio/webm', course_id: courseId }).select('id').single()).data!.id as string
  const chat = (await u.sb.from('tutor_chats').insert({ title: 'Matrix?', course_id: courseId }).select('id').single()).data!.id as string
  const mcq = (id: string) => ({ id, type: 'mcq', prompt: id, options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: 'x' })
  const quiz = (await u.sb.from('quizzes').insert({ note_id: note, title: 'Krebs quiz', questions: [mcq('1'), mcq('2'), mcq('3')] }).select('id').single()).data!.id as string
  return { note, deck, lecture, chat, quiz }
}

describe('Library against the real database', () => {
  it('lists everything the student has, with its course, and nobody else\'s', async () => {
    const u = await newUser(), other = await newUser()
    const bio = await course(u, 'Biology')
    const m = await material(u, bio)
    await material(other, null)
    const items = await loadLibrary(u.sb, new Date())
    expect(items.map(i => `${i.kind}:${i.id}`).sort()).toEqual([`note:${m.note}`, `deck:${m.deck}`, `lecture:${m.lecture}`, `chat:${m.chat}`, `quiz:${m.quiz}`].sort())
    expect(items.every(i => i.course_id === bio)).toBe(true) // the quiz follows its note
    expect(items.find(i => i.kind === 'deck')!.meta).toBe('2 cards · 2 due')
    expect(items.find(i => i.kind === 'lecture')!.meta).toBe('30 min')
  })
  it('moves items between courses and out of the old course\'s topics', async () => {
    const u = await newUser()
    const bio = await course(u, 'Biology'), chem = await course(u, 'Chemistry')
    const m = await material(u, bio)
    const topic = (await u.sb.from('topics').insert({ course_id: bio, name: 'Krebs cycle' }).select('id').single()).data!.id as string
    await u.sb.from('topic_links').insert([{ topic_id: topic, note_id: m.note }, { topic_id: topic, deck_id: m.deck }, { topic_id: topic, lecture_id: m.lecture }])
    await moveItems(u.sb, [{ kind: 'note', id: m.note }, { kind: 'deck', id: m.deck }, { kind: 'lecture', id: m.lecture }, { kind: 'chat', id: m.chat }, { kind: 'quiz', id: m.quiz }], chem)
    const items = await loadLibrary(u.sb, new Date())
    expect(items.every(i => i.course_id === chem)).toBe(true)
    expect((await u.sb.from('topic_links').select('id')).data).toEqual([])
  })
  it('can put items back in no course', async () => {
    const u = await newUser()
    const bio = await course(u, 'Biology')
    const m = await material(u, bio)
    await moveItems(u.sb, [{ kind: 'note', id: m.note }], null)
    expect((await u.sb.from('notes').select('course_id').eq('id', m.note).single()).data).toEqual({ course_id: null })
  })
  it('refuses a move into someone else\'s course, and a move of someone else\'s items', async () => {
    const u = await newUser(), other = await newUser()
    const theirs = await course(other, 'Theirs')
    const mine = await material(u, null)
    await expect(moveItems(u.sb, [{ kind: 'note', id: mine.note }], theirs)).rejects.toBeTruthy()
    expect((await u.sb.from('notes').select('course_id').eq('id', mine.note).single()).data).toEqual({ course_id: null })
    const bio = await course(u, 'Biology')
    const stolen = await material(other, null)
    await moveItems(u.sb, [{ kind: 'note', id: stolen.note }], bio) // matches no row of theirs: changes nothing
    expect((await other.sb.from('notes').select('course_id').eq('id', stolen.note).single()).data).toEqual({ course_id: null })
  })
})
