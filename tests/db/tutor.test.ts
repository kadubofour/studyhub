import { describe, it, expect } from 'vitest'
import { newUser, adminClient } from './helpers'

const admin = () => adminClient()
const note = async (u: Awaited<ReturnType<typeof newUser>>, over: object = {}) =>
  (await u.sb.from('notes').insert({ title: 'Krebs cycle', content_md: 'The Krebs cycle runs in the mitochondrial matrix.', ...over }).select('id').single()).data!
const chat = (u: Awaited<ReturnType<typeof newUser>>, over: object = {}) => u.sb.from('tutor_chats').insert({ title: 'Help', ...over }).select('id').single()
const check = (user: string) => admin().rpc('tutor_check', { p_user: user })
const fill = (user: string, n: number, kind: 'tutor' | 'action') =>
  admin().from('ai_charges').insert(Array.from({ length: n }, () => ({ user_id: user, cost: 1, kind })))
const premium = (user: string) => admin().rpc('apply_payment', {
  p_user: user, p_reference: `T${crypto.randomUUID()}`, p_product: 'pass_1m', p_amount_minor: 5000, p_currency: 'GHS',
  p_channel: 'card', p_status: 'success', p_months: 1, p_paid_at: new Date().toISOString(),
  p_customer_code: `CUS_${user}`, p_card_brand: null, p_card_last4: null,
})

describe('tutor chats and messages', () => {
  it('a student keeps their own chats and messages; others can\'t see or change them', async () => {
    const u = await newUser(), other = await newUser()
    const { data: c } = await chat(u)
    const { error } = await u.sb.from('tutor_messages').insert({ chat_id: c!.id, user_id: u.id, role: 'user', content: 'hi' })
    expect(error).toBeNull()
    expect((await other.sb.from('tutor_chats').select('id').eq('id', c!.id)).data).toEqual([])
    expect((await other.sb.from('tutor_messages').select('id').eq('chat_id', c!.id)).data).toEqual([])
    expect((await other.sb.from('tutor_messages').insert({ chat_id: c!.id, user_id: other.id, role: 'user', content: 'x' })).error).not.toBeNull()
  })
  it('a chat can only be attached to the student\'s own course, note or lecture, and to one of note/lecture', async () => {
    const u = await newUser(), other = await newUser()
    const theirs = await note(other)
    const course = (await other.sb.from('courses').insert({ name: 'Theirs', color: '#000000' }).select('id').single()).data!
    const lecture = (await u.sb.from('lectures').insert({ title: 'L', duration_seconds: 60, mime: 'audio/webm' }).select('id').single()).data!
    const mine = await note(u)
    expect((await chat(u, { note_id: theirs.id })).error).not.toBeNull()
    expect((await chat(u, { course_id: course.id })).error).not.toBeNull()
    expect((await chat(u, { note_id: mine.id, lecture_id: lecture.id })).error).not.toBeNull()
    expect((await chat(u, { note_id: mine.id })).error).toBeNull()
    expect((await chat(u, { lecture_id: lecture.id })).error).toBeNull()
  })
  it('deleting a note leaves the chat, unattached', async () => {
    const u = await newUser()
    const n = await note(u)
    const { data: c } = await chat(u, { note_id: n.id })
    await u.sb.from('notes').delete().eq('id', n.id)
    const { data } = await u.sb.from('tutor_chats').select('note_id').eq('id', c!.id).single()
    expect(data!.note_id).toBeNull()
  })
  it('deleting a chat deletes its messages', async () => {
    const u = await newUser()
    const { data: c } = await chat(u)
    await u.sb.from('tutor_messages').insert({ chat_id: c!.id, user_id: u.id, role: 'user', content: 'hi' })
    await u.sb.from('tutor_chats').delete().eq('id', c!.id)
    expect((await admin().from('tutor_messages').select('id').eq('chat_id', c!.id)).data).toEqual([])
  })
})

describe('tutor_find_material', () => {
  it('finds the student\'s own notes, lectures and cards, and never another student\'s', async () => {
    const u = await newUser(), other = await newUser()
    await note(u)
    await note(other, { title: 'Their mitochondrial secrets', content_md: 'mitochondrial mitochondrial' })
    await u.sb.from('lectures').insert({ title: 'Bio lecture', duration_seconds: 60, mime: 'audio/webm', transcript: [{ start: 0, end: 2, text: 'Today the mitochondrial matrix.' }] })
    const deck = (await u.sb.from('decks').insert({ name: 'Bio' }).select('id').single()).data!
    await u.sb.from('cards').insert({ deck_id: deck.id, front: 'Where is the mitochondrial matrix?', back: 'Inside' })
    const { data } = await u.sb.rpc('tutor_find_material', { p_query: 'mitochondrial matrix', p_limit: 5 })
    const rows = data as { kind: string; title: string }[]
    expect(rows.map(r => r.kind).sort()).toEqual(['card', 'lecture', 'note'])
    expect(rows.some(r => r.title.includes('Their'))).toBe(false)
  })
  it('an empty or symbol-only query returns nothing instead of failing', async () => {
    const u = await newUser()
    await note(u)
    expect((await u.sb.rpc('tutor_find_material', { p_query: '   ', p_limit: 5 })).data).toEqual([])
    expect((await u.sb.rpc('tutor_find_material', { p_query: '"""(!', p_limit: 5 })).error).toBeNull()
  })
  it('returns at most the limit, never more than 10', async () => {
    const u = await newUser()
    for (let i = 0; i < 12; i++) await note(u, { title: `Krebs ${i}`, content_md: 'krebs cycle' })
    expect(((await u.sb.rpc('tutor_find_material', { p_query: 'krebs', p_limit: 50 })).data as unknown[]).length).toBe(10)
  })
})

describe('tutor_check: Free 20 a day, Premium counts toward fair use', () => {
  it('lets a Free student send 20 a day, then says tutor_limit', async () => {
    const u = await newUser()
    await fill(u.id, 19, 'tutor')
    expect((await check(u.id)).data).toBe('ok')
    expect((await check(u.id)).data).toBe('tutor_limit')
  })
  it('parallel messages cannot overshoot: at 18 used, five at once give exactly two ok', async () => {
    const u = await newUser()
    await fill(u.id, 18, 'tutor')
    const results = (await Promise.all([1, 2, 3, 4, 5].map(() => check(u.id)))).map(r => r.data)
    expect(results.filter(r => r === 'ok')).toHaveLength(2)
    expect(results.filter(r => r === 'tutor_limit')).toHaveLength(3)
  })
  it('tutor messages don\'t use the 10 free AI actions, and actions don\'t use the tutor messages', async () => {
    const u = await newUser()
    await fill(u.id, 20, 'tutor')
    expect((await admin().rpc('ai_check', { p_user: u.id, p_cost: 10 })).data).toBe('ok')
    const v = await newUser()
    await fill(v.id, 10, 'action')
    expect((await check(v.id)).data).toBe('ok')
  })
  it('a released message gives itself back, and releasing an AI action leaves tutor messages alone', async () => {
    const u = await newUser()
    await fill(u.id, 19, 'tutor')
    expect((await check(u.id)).data).toBe('ok')
    await admin().rpc('tutor_release', { p_user: u.id })
    expect((await check(u.id)).data).toBe('ok')
    await admin().rpc('ai_release', { p_user: u.id, p_cost: 1 }) // no 'action' charge exists: must not delete a tutor one
    expect((await check(u.id)).data).toBe('tutor_limit')
  })
  it('Premium has no daily limit; its messages count toward 400 a month', async () => {
    const u = await newUser()
    await premium(u.id)
    await fill(u.id, 30, 'tutor')
    expect((await check(u.id)).data).toBe('ok')
    await fill(u.id, 368, 'action')
    expect((await check(u.id)).data).toBe('ok') // the 400th
    expect((await check(u.id)).data).toBe('fair_use')
  })
  it('is for the server only', async () => {
    const u = await newUser()
    expect((await u.sb.rpc('tutor_check', { p_user: u.id })).error).not.toBeNull()
    expect((await u.sb.rpc('tutor_release', { p_user: u.id })).error).not.toBeNull()
  })
  it('the speed limit applies: 10 requests a minute', async () => {
    const u = await newUser()
    const results = (await Promise.all(Array.from({ length: 12 }, () => check(u.id)))).map(r => r.data)
    expect(results.filter(r => r === 'ok')).toHaveLength(10)
    expect(results.filter(r => r === 'rate_limited')).toHaveLength(2)
  })
})
