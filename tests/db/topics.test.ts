import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
type Row = { topic_id: string; name: string; answers_30d: number; correct_30d: number; answers_all: number; notes: number; lectures: number; decks: number; status: string }
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const course = async (u: U, name = 'Biology') => (await u.sb.from('courses').insert({ name, color: '#1D9E75' }).select('id').single()).data!.id as string
const note = async (u: U, courseId: string | null, title = 'Krebs') =>
  (await u.sb.from('notes').insert({ title, content_md: 'text', course_id: courseId }).select('id').single()).data!.id as string
const deck = async (u: U, courseId: string | null) => (await u.sb.from('decks').insert({ name: 'Cells', course_id: courseId }).select('id').single()).data!.id as string
const lecture = async (u: U, courseId: string | null) =>
  (await u.sb.from('lectures').insert({ title: 'Bio lecture', duration_seconds: 60, mime: 'audio/webm', course_id: courseId }).select('id').single()).data!.id as string
const topic = async (u: U, courseId: string, name: string) => (await u.sb.from('topics').insert({ course_id: courseId, name }).select('id').single()).data!.id as string
const link = (u: U, topicId: string, target: { note_id?: string; lecture_id?: string; deck_id?: string }) => u.sb.from('topic_links').insert({ topic_id: topicId, ...target })
const save = (u: U, courseId: string, topics: unknown) => u.sb.rpc('save_course_topics', { p_course: courseId, p_topics: topics })
const stats = async (u: U, courseId: string) => (await u.sb.rpc('topic_stats', { p_course: courseId })).data as Row[]
const mcq = (p: string) => ({ id: p, type: 'mcq', prompt: p, options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: 'x' })
const quiz = async (u: U, noteId: string) =>
  (await u.sb.from('quizzes').insert({ note_id: noteId, title: 'Quiz', questions: [mcq('q1'), mcq('q2'), mcq('q3')] }).select('id').single()).data!.id as string
const attempt = (u: U, quizId: string, answers: Record<string, boolean>, finishedAgo: number | null) =>
  u.sb.from('quiz_attempts').insert({
    quiz_id: quizId, total: Object.keys(answers).length, correct: Object.values(answers).filter(Boolean).length,
    answers: Object.fromEntries(Object.entries(answers).map(([k, ok]) => [k, { given: 'x', correct: ok, feedback: null }])),
    started_at: ago(finishedAgo ?? 0), finished_at: finishedAgo === null ? null : ago(finishedAgo),
  })
const card = async (u: U, deckId: string, noteId: string | null) =>
  (await u.sb.from('cards').insert({ deck_id: deckId, front: 'Q', back: 'A', ...(noteId ? { note_id: noteId } : {}) }).select('id').single()).data!.id as string
const review = (u: U, cardId: string, rating: number, reviewedAgo = 0) =>
  u.sb.from('reviews').insert({ card_id: cardId, rating, reviewed_at: ago(reviewedAgo), prev_interval_days: 0, new_interval_days: 1 })

describe('topics and links: privacy and rules', () => {
  it('a student keeps their own topics and links; others cannot see or use them', async () => {
    const u = await newUser(), other = await newUser()
    const c = await course(u), n = await note(u, c)
    const t = await topic(u, c, 'Glycolysis')
    expect((await link(u, t, { note_id: n })).error).toBeNull()
    expect((await other.sb.from('topics').select('id').eq('id', t)).data).toEqual([])
    expect((await other.sb.from('topic_links').select('id').eq('topic_id', t)).data).toEqual([])
    expect((await other.sb.from('topics').insert({ course_id: c, name: 'Mine now' })).error).not.toBeNull()
    const oc = await course(other), ot = await topic(other, oc, 'Theirs')
    expect((await link(other, ot, { note_id: n })).error).not.toBeNull() // someone else's note
  })
  it('a link must point at something in the same course as its topic', async () => {
    const u = await newUser()
    const c1 = await course(u, 'Bio'), c2 = await course(u, 'Chem')
    const t = await topic(u, c1, 'Glycolysis')
    expect((await link(u, t, { note_id: await note(u, c2) })).error).not.toBeNull()
    expect((await link(u, t, { note_id: await note(u, null) })).error).not.toBeNull()
    expect((await link(u, t, { lecture_id: await lecture(u, c2) })).error).not.toBeNull()
    expect((await link(u, t, { deck_id: await deck(u, c2) })).error).not.toBeNull()
    expect((await link(u, t, { note_id: await note(u, c1) })).error).toBeNull()
    expect((await link(u, t, { lecture_id: await lecture(u, c1) })).error).toBeNull()
    expect((await link(u, t, { deck_id: await deck(u, c1) })).error).toBeNull()
  })
  it('a link has exactly one target and cannot repeat', async () => {
    const u = await newUser()
    const c = await course(u), n = await note(u, c), d = await deck(u, c), t = await topic(u, c, 'A')
    expect((await link(u, t, { note_id: n, deck_id: d })).error).not.toBeNull()
    expect((await link(u, t, {})).error).not.toBeNull()
    expect((await link(u, t, { note_id: n })).error).toBeNull()
    expect((await link(u, t, { note_id: n })).error).not.toBeNull()
  })
  it('names are unique in a course ignoring case, and a course holds at most 40 topics', async () => {
    const u = await newUser()
    const c = await course(u)
    await topic(u, c, 'Glycolysis')
    expect((await u.sb.from('topics').insert({ course_id: c, name: ' glycolysis ' })).error).not.toBeNull()
    expect((await u.sb.from('topics').insert({ course_id: c, name: 'x'.repeat(81) })).error).not.toBeNull()
    const rest = Array.from({ length: 39 }, (_, i) => ({ course_id: c, name: `T${i}` }))
    expect((await u.sb.from('topics').insert(rest)).error).toBeNull()
    expect((await u.sb.from('topics').insert({ course_id: c, name: 'One too many' })).error).not.toBeNull()
  })
  it('deleting a note, deck or course tidies the links and topics', async () => {
    const u = await newUser()
    const c = await course(u), n = await note(u, c), d = await deck(u, c), t = await topic(u, c, 'A')
    await link(u, t, { note_id: n }); await link(u, t, { deck_id: d })
    await u.sb.from('notes').delete().eq('id', n)
    expect((await u.sb.from('topic_links').select('id').eq('topic_id', t)).data).toHaveLength(1)
    await u.sb.from('decks').delete().eq('id', d)
    expect((await u.sb.from('topic_links').select('id').eq('topic_id', t)).data).toHaveLength(0)
    await link(u, t, { note_id: await note(u, c, 'Again') })
    await u.sb.from('courses').delete().eq('id', c)
    expect((await u.sb.from('topics').select('id').eq('id', t)).data).toEqual([])
  })
  it('moving a note, lecture or deck to another course drops its topic links', async () => {
    const u = await newUser()
    const c1 = await course(u, 'Bio'), c2 = await course(u, 'Chem')
    const n = await note(u, c1), l = await lecture(u, c1), d = await deck(u, c1), t = await topic(u, c1, 'A')
    await link(u, t, { note_id: n }); await link(u, t, { lecture_id: l }); await link(u, t, { deck_id: d })
    await u.sb.from('notes').update({ course_id: c2 }).eq('id', n)
    await u.sb.from('lectures').update({ course_id: c2 }).eq('id', l)
    await u.sb.from('decks').update({ course_id: c2 }).eq('id', d)
    expect((await u.sb.from('topic_links').select('id').eq('topic_id', t)).data).toHaveLength(0)
  })
  it('a card can only point at the student\'s own note', async () => {
    const u = await newUser(), other = await newUser()
    const c = await course(u), d = await deck(u, c)
    expect((await u.sb.from('cards').insert({ deck_id: d, front: 'Q', back: 'A', note_id: await note(u, c) })).error).toBeNull()
    expect((await u.sb.from('cards').insert({ deck_id: d, front: 'Q', back: 'A', note_id: await note(other, null) })).error).not.toBeNull()
  })
})

describe('save_course_topics', () => {
  it('creates, renames, reorders, deletes and replaces links in one go', async () => {
    const u = await newUser()
    const c = await course(u), n1 = await note(u, c, 'N1'), n2 = await note(u, c, 'N2'), d = await deck(u, c)
    expect((await save(u, c, [
      { name: 'Glycolysis', links: [{ kind: 'note', id: n1 }] },
      { name: 'Krebs cycle', links: [{ kind: 'note', id: n2 }, { kind: 'deck', id: d }] },
      { name: 'ETC', links: [] },
    ])).error).toBeNull()
    let rows = await stats(u, c)
    expect(rows.map(r => r.name)).toEqual(['Glycolysis', 'Krebs cycle', 'ETC'])
    expect(rows.map(r => [r.notes, r.decks])).toEqual([[1, 0], [1, 1], [0, 0]])
    const [g, k] = rows
    expect((await save(u, c, [
      { id: k.topic_id, name: 'The Krebs cycle', links: [{ kind: 'note', id: n1 }] },
      { id: g.topic_id, name: 'Glycolysis', links: [] },
    ])).error).toBeNull()
    rows = await stats(u, c)
    expect(rows.map(r => r.name)).toEqual(['The Krebs cycle', 'Glycolysis'])
    expect(rows.map(r => [r.notes, r.decks])).toEqual([[1, 0], [0, 0]])
    expect(rows[0].topic_id).toBe(k.topic_id) // renamed and moved, not recreated
  })
  it('two topics can swap names in one save', async () => {
    const u = await newUser()
    const c = await course(u)
    await save(u, c, [{ name: 'A', links: [] }, { name: 'B', links: [] }])
    const [a, b] = await stats(u, c)
    expect((await save(u, c, [{ id: a.topic_id, name: 'B', links: [] }, { id: b.topic_id, name: 'A', links: [] }])).error).toBeNull()
    expect((await stats(u, c)).map(r => r.name)).toEqual(['B', 'A'])
  })
  it('changes nothing when any part is invalid', async () => {
    const u = await newUser()
    const c = await course(u), other = await course(u, 'Chem'), foreign = await note(u, other), n = await note(u, c)
    await save(u, c, [{ name: 'Keep me', links: [{ kind: 'note', id: n }] }])
    const before = await stats(u, c)
    const bad = [
      [{ name: 'Same', links: [] }, { name: 'same', links: [] }],
      [{ name: 'Fine', links: [{ kind: 'note', id: foreign }] }],
      [{ name: '', links: [] }],
      [{ name: 'X', links: [{ kind: 'quiz', id: n }] }],
      Array.from({ length: 41 }, (_, i) => ({ name: `T${i}`, links: [] })),
    ]
    for (const topics of bad) expect((await save(u, c, topics)).error, JSON.stringify(topics).slice(0, 60)).not.toBeNull()
    expect(await stats(u, c)).toEqual(before)
  })
  it('refuses someone else\'s course and topic ids that are not in the course', async () => {
    const u = await newUser(), other = await newUser()
    const c = await course(u), oc = await course(other)
    expect((await save(other, c, [{ name: 'Mine now', links: [] }])).error).not.toBeNull()
    await save(other, oc, [{ name: 'Theirs', links: [] }])
    const [theirs] = await stats(other, oc)
    expect((await save(u, c, [{ id: theirs.topic_id, name: 'Stolen', links: [] }])).error).not.toBeNull()
  })
})

describe('topic_stats', () => {
  it('counts quiz answers and card reviews of the last 30 days, once per topic, with the right status', async () => {
    const u = await newUser()
    const c = await course(u), n1 = await note(u, c, 'N1'), n2 = await note(u, c, 'N2'), n3 = await note(u, c, 'N3'), d = await deck(u, c)
    await save(u, c, [
      { name: 'A', links: [{ kind: 'note', id: n1 }, { kind: 'deck', id: d }] }, // note AND deck both match the same cards
      { name: 'B', links: [{ kind: 'note', id: n1 }] },                         // the same answers also count here
      { name: 'C', links: [{ kind: 'note', id: n2 }] },                         // only an old answer
      { name: 'D', links: [] },                                                 // nothing
      { name: 'E', links: [{ kind: 'note', id: n3 }] },                         // recent and mostly wrong
    ])
    await attempt(u, await quiz(u, n1), { q1: true, q2: false }, 2)
    await attempt(u, await quiz(u, n1), { q1: true }, null) // unfinished: ignored
    const cd = await card(u, d, n1)
    for (const r of [3, 4, 1]) await review(u, cd, r)
    let [a, b, cc, dd] = await stats(u, c)
    expect([a.answers_30d, a.correct_30d, a.status]).toEqual([5, 3, 'covered']) // 2 quiz + 3 reviews, 60% is not under 60%
    expect([b.answers_30d, b.correct_30d]).toEqual([5, 3])
    for (let i = 0; i < 5; i++) await review(u, cd, 4)
    ;[a, b] = await stats(u, c)
    expect([a.answers_30d, a.correct_30d, a.status]).toEqual([10, 8, 'mastered']) // 80% exactly
    expect(b.status).toBe('mastered')
    await attempt(u, await quiz(u, n2), { q1: true }, 40)
    cc = (await stats(u, c))[2]
    expect([cc.answers_30d, cc.answers_all, cc.status]).toEqual([0, 1, 'covered'])
    dd = (await stats(u, c))[3]
    expect([dd.answers_all, dd.status]).toEqual([0, 'not_started'])
    await attempt(u, await quiz(u, n3), { q1: false, q2: false, q3: false }, 1)
    await attempt(u, await quiz(u, n3), { q1: true, q2: false }, 1)
    const e = (await stats(u, c))[4]
    expect([e.answers_30d, e.correct_30d, e.status]).toEqual([5, 1, 'weak'])
  })
  it('only sees the student\'s own data', async () => {
    const u = await newUser(), other = await newUser()
    const c = await course(u), n = await note(u, c)
    await save(u, c, [{ name: 'A', links: [{ kind: 'note', id: n }] }])
    await attempt(u, await quiz(u, n), { q1: false, q2: false, q3: false, q4: false, q5: false }, 1)
    expect((await other.sb.rpc('topic_stats', { p_course: c })).data).toEqual([])
    expect((await stats(u, c))[0].status).toBe('weak')
  })
})

describe('a topic stays in its course', () => {
  it('cannot be moved to another course, which would skip the 40-topic and same-course rules', async () => {
    const u = await newUser()
    const c1 = await course(u, 'Bio'), c2 = await course(u, 'Chem')
    const t = await topic(u, c1, 'A')
    await link(u, t, { note_id: await note(u, c1) })
    expect((await u.sb.from('topics').update({ course_id: c2 }).eq('id', t)).error).not.toBeNull()
    expect((await u.sb.from('topics').select('course_id').eq('id', t).single()).data).toEqual({ course_id: c1 })
    expect((await u.sb.from('topics').update({ name: 'Renamed', position: 3 }).eq('id', t)).error).toBeNull() // other edits still fine
  })
})
