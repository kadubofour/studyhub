import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'
import { dayXp, type ActivityDay } from '@/lib/xp/rules'

type U = Awaited<ReturnType<typeof newUser>>
const codeOf = async (u: U) => (await u.sb.from('profiles').select('friend_code').single()).data!.friend_code as string
const named = async (u: U, name: string) => { await u.sb.from('profiles').update({ display_name: name }).eq('id', u.id); return u }
const ask = async (from: U, to: U) => from.sb.rpc('send_friend_request', { p_code: await codeOf(to) })
async function friends(a: U, b: U) {
  await ask(a, b)
  const req = (await b.sb.rpc('list_friends')).data!.find((r: { user_id: string }) => r.user_id === a.id)
  expect((await b.sb.rpc('accept_friend_request', { p_id: req.id })).error).toBeNull()
}
const note = async (u: U, over: object = {}) => (await u.sb.from('notes').insert({ title: 'Krebs cycle', content_md: 'The matrix', ...over }).select('id').single()).data!.id as string
const deck = async (u: U) => {
  const id = (await u.sb.from('decks').insert({ name: 'Cells' }).select('id').single()).data!.id as string
  await u.sb.from('cards').insert([{ deck_id: id, front: 'Q1', back: 'A1' }, { deck_id: id, front: 'Q2', back: 'A2' }])
  return id
}

describe('friend codes and requests', () => {
  it('every student has their own code of 8 letters and digits', async () => {
    const a = await newUser(), b = await newUser()
    const [ca, cb] = [await codeOf(a), await codeOf(b)]
    expect(ca).toMatch(/^[A-Z2-9]{8}$/)
    expect(ca).not.toBe(cb)
    expect((await a.sb.from('profiles').select('friend_code').eq('id', b.id)).data).toEqual([]) // not someone else's
  })
  it('asks by code; the other side sees it as incoming and accepts; then both are friends', async () => {
    const a = await named(await newUser(), 'Ama'), b = await named(await newUser(), 'Kofi')
    expect((await ask(a, b)).data).toBe('sent')
    const incoming = (await b.sb.rpc('list_friends')).data!
    expect(incoming).toEqual([expect.objectContaining({ user_id: a.id, display_name: 'Ama', status: 'pending', incoming: true })])
    expect((await a.sb.rpc('list_friends')).data![0]).toMatchObject({ user_id: b.id, display_name: 'Kofi', incoming: false })
    expect((await a.sb.rpc('accept_friend_request', { p_id: incoming[0].id })).error).not.toBeNull() // only the one asked accepts
    expect((await b.sb.rpc('accept_friend_request', { p_id: incoming[0].id })).error).toBeNull()
    expect((await a.sb.rpc('list_friends')).data![0].status).toBe('accepted')
  })
  it('a code in lower case or with spaces still works; a wrong code, your own, or asking twice says so', async () => {
    const a = await newUser(), b = await newUser()
    expect((await a.sb.rpc('send_friend_request', { p_code: ` ${(await codeOf(b)).toLowerCase()} ` })).data).toBe('sent')
    expect((await a.sb.rpc('send_friend_request', { p_code: await codeOf(b) })).data).toBe('already_asked')
    expect((await a.sb.rpc('send_friend_request', { p_code: 'ZZZZZZZZ' })).error?.code).toBe('P0002')
    expect((await a.sb.rpc('send_friend_request', { p_code: await codeOf(a) })).error).not.toBeNull()
  })
  it('asking someone who already asked you makes you friends at once', async () => {
    const a = await newUser(), b = await newUser()
    await ask(a, b)
    expect((await ask(b, a)).data).toBe('accepted')
    expect((await b.sb.rpc('list_friends')).data![0].status).toBe('accepted')
  })
  it('either side can remove the friendship; no one else sees it or can make one for others', async () => {
    const a = await newUser(), b = await newUser(), c = await newUser()
    await friends(a, b)
    const row = (await a.sb.from('friendships').select('id').single()).data!
    expect((await c.sb.from('friendships').select('id')).data).toEqual([])
    expect((await c.sb.from('friendships').insert({ requester: a.id, addressee: c.id })).error).not.toBeNull()
    await b.sb.from('friendships').delete().eq('id', row.id)
    expect((await a.sb.rpc('list_friends')).data).toEqual([])
  })
})

describe('the weekly board', () => {
  it('lists you and your accepted friends with this week\'s XP, highest first, and no one else', async () => {
    const a = await named(await newUser(), 'Ama'), b = await named(await newUser(), 'Kofi'), c = await newUser(), d = await newUser()
    await friends(a, b)
    await ask(a, c) // asked, not accepted
    await b.sb.from('focus_sessions').insert({ started_at: new Date().toISOString(), ended_at: new Date().toISOString(), minutes: 50, completed: true })
    await d.sb.from('focus_sessions').insert({ started_at: new Date().toISOString(), ended_at: new Date().toISOString(), minutes: 50, completed: true })
    const board = (await a.sb.rpc('friends_week_xp', { p_tz: 'UTC' })).data!
    expect(board.map((r: { user_id: string }) => r.user_id)).toEqual([b.id, a.id])
    expect(board[0]).toMatchObject({ display_name: 'Kofi', xp: 10, is_me: false })
    expect(board[1]).toMatchObject({ display_name: 'Ama', xp: 0, is_me: true })
  })
  it('counts XP by the same rules and daily caps as the app (lib/xp/rules.ts)', async () => {
    const a = await newUser()
    const now = new Date().toISOString(), earlier = new Date(Date.now() - 60_000).toISOString() // one session per start time
    expect((await a.sb.from('focus_sessions').insert([{ started_at: now, ended_at: now, minutes: 200, completed: true }, { started_at: earlier, ended_at: earlier, minutes: 7, completed: true }])).error).toBeNull()
    for (let i = 0; i < 12; i++) await a.sb.from('tasks').insert({ title: `T${i}`, done_at: now })
    const expected = dayXp({ day: '2026-01-01', reviews: 0, quizzes: 0, focus_minutes: 207, tasks_done: 12, plan_sessions: 0, tutor_messages: 0, lectures: 0, games: 0 } satisfies ActivityDay)
    expect(expected).toBe(24 + 50) // focus capped at 24 units, tasks at 10
    expect((await a.sb.rpc('friends_week_xp', { p_tz: 'UTC' })).data![0].xp).toBe(expected)
  })
  it('the XP of one student cannot be asked for directly', async () => {
    const a = await newUser(), b = await newUser()
    expect((await a.sb.rpc('week_xp', { p_user: b.id, p_tz: 'UTC', p_from: '2026-01-01' })).error).not.toBeNull()
  })
})

describe('sharing notes and decks', () => {
  it('shares your own note or deck with a friend, who can read it; not with a stranger, and not someone else\'s', async () => {
    const a = await named(await newUser(), 'Ama'), b = await newUser(), c = await newUser()
    await friends(a, b)
    const n = await note(a), dk = await deck(a)
    expect((await a.sb.from('shares').insert({ recipient: b.id, kind: 'note', item_id: n })).error).toBeNull()
    expect((await a.sb.from('shares').insert({ recipient: b.id, kind: 'deck', item_id: dk })).error).toBeNull()
    expect((await a.sb.from('shares').insert({ recipient: c.id, kind: 'note', item_id: n })).error).not.toBeNull() // not a friend
    expect((await b.sb.from('shares').insert({ recipient: a.id, kind: 'note', item_id: n })).error).not.toBeNull() // not theirs
    const mine = (await b.sb.rpc('shared_with_me')).data!
    expect(mine.map((s: { kind: string }) => s.kind).sort()).toEqual(['deck', 'note'])
    const noteShare = mine.find((s: { kind: string }) => s.kind === 'note')
    expect(noteShare).toMatchObject({ title: 'Krebs cycle', owner_name: 'Ama' })
    expect((await b.sb.rpc('shared_note', { p_share: noteShare.id })).data![0]).toMatchObject({ title: 'Krebs cycle', content_md: 'The matrix' })
    const deckShare = mine.find((s: { kind: string }) => s.kind === 'deck')
    const shared = (await b.sb.rpc('shared_deck', { p_share: deckShare.id })).data
    expect(shared).toMatchObject({ name: 'Cells' })
    expect(shared.cards).toEqual(expect.arrayContaining([{ front: 'Q1', back: 'A1' }, { front: 'Q2', back: 'A2' }]))
    expect(shared.cards).toHaveLength(2)
    // a shared note is not one of the friend's own notes, and others cannot open the share
    expect((await b.sb.from('notes').select('id')).data).toEqual([])
    expect((await c.sb.rpc('shared_note', { p_share: noteShare.id })).data).toEqual([])
    expect((await a.sb.rpc('shared_by_me')).data!).toHaveLength(2)
  })
  it('a share ends when the note is deleted or the friendship ends', async () => {
    const a = await newUser(), b = await newUser()
    await friends(a, b)
    const n1 = await note(a), n2 = await note(a)
    await a.sb.from('shares').insert([{ recipient: b.id, kind: 'note', item_id: n1 }, { recipient: b.id, kind: 'note', item_id: n2 }])
    await a.sb.from('notes').delete().eq('id', n1)
    expect((await b.sb.rpc('shared_with_me')).data!).toHaveLength(1)
    await a.sb.from('friendships').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    expect((await b.sb.rpc('shared_with_me')).data).toEqual([])
    expect((await a.sb.from('shares').select('id')).data).toEqual([])
  })
  it('the friend can read only the pictures the shared note uses, and only while shared', async () => {
    const a = await newUser(), b = await newUser()
    await friends(a, b)
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
    await a.sb.storage.from('note-images').upload(`${a.id}/used.png`, png)
    await a.sb.storage.from('note-images').upload(`${a.id}/other.png`, png)
    const n = await note(a, { content_md: 'See ![cell](studyhub-image:used.png)' })
    expect((await b.sb.storage.from('note-images').createSignedUrl(`${a.id}/used.png`, 60)).error).not.toBeNull() // not shared yet
    const share = (await a.sb.from('shares').insert({ recipient: b.id, kind: 'note', item_id: n }).select('id').single()).data!
    expect((await b.sb.storage.from('note-images').createSignedUrl(`${a.id}/used.png`, 60)).error).toBeNull()
    expect((await b.sb.storage.from('note-images').createSignedUrl(`${a.id}/other.png`, 60)).error).not.toBeNull()
    await b.sb.from('shares').delete().eq('id', share.id) // the friend takes it off their list
    expect((await b.sb.storage.from('note-images').createSignedUrl(`${a.id}/used.png`, 60)).error).not.toBeNull()
  })
})
