import { describe, it, expect } from 'vitest'
import { adminClient, newUser } from './helpers'

const ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/
type U = Awaited<ReturnType<typeof newUser>>

async function codeOf(u: U) {
  const { data } = await u.sb.from('profiles').select('friend_code').eq('id', u.id).single()
  return data!.friend_code as string
}
async function friendIds(u: U) {
  const { data, error } = await u.sb.rpc('my_friends')
  expect(error).toBeNull()
  return (data as { user_id: string }[]).map(r => r.user_id)
}
async function send(u: U, code: string) {
  const { data, error } = await u.sb.rpc('send_friend_request', { p_code: code })
  expect(error).toBeNull()
  return data as string
}
async function redeem(u: U, code: string) {
  const { data, error } = await u.sb.rpc('redeem_in_person', { p_code: code })
  expect(error).toBeNull()
  return data as string
}
async function startCode(u: U) {
  const { data, error } = await u.sb.rpc('start_in_person')
  expect(error).toBeNull()
  return (data as { code: string }[])[0].code
}

describe('friends', () => {
  it('new students get a friend code, and the board setting defaults on', async () => {
    const u = await newUser()
    expect(await codeOf(u)).toMatch(ALPHABET)
    const { data } = await u.sb.from('profiles').select('show_on_boards').eq('id', u.id).single()
    expect(data!.show_on_boards).toBe(true)
  })

  it('a code sends a request; accepting makes both friends; declining does not', async () => {
    const a = await newUser(), b = await newUser(), c = await newUser()
    expect(await send(a, await codeOf(b))).toBe('ok')
    // sending again does nothing, no error
    expect(await send(a, await codeOf(b))).toBe('ok')
    const reqs = (await b.sb.rpc('my_friend_requests')).data as { from_id: string; avatar_color: string }[]
    expect(reqs.map(r => r.from_id)).toEqual([a.id])
    expect(reqs[0].avatar_color).toMatch(/^#/)
    expect((await b.sb.rpc('respond_friend_request', { p_from: a.id, p_accept: true })).error).toBeNull()
    expect(await friendIds(a)).toEqual([b.id])
    expect(await friendIds(b)).toEqual([a.id])
    expect(((await b.sb.rpc('my_friend_requests')).data as unknown[]).length).toBe(0)
    expect(await send(a, await codeOf(b))).toBe('already_friends')
    expect(await send(a, await codeOf(a))).toBe('self')
    expect(await send(a, 'AAAAAAAA')).toBe('not_found')
    // declining
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(c) })
    expect((await c.sb.rpc('respond_friend_request', { p_from: a.id, p_accept: false })).error).toBeNull()
    expect(await friendIds(c)).toEqual([])
    expect(((await c.sb.rpc('my_friend_requests')).data as unknown[]).length).toBe(0)
    // removing
    await a.sb.rpc('remove_friend', { p_other: b.id })
    expect(await friendIds(a)).toEqual([])
    expect(await friendIds(b)).toEqual([])
  })

  it('two requests crossing make friends at once', async () => {
    const a = await newUser(), b = await newUser()
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(b) })
    await b.sb.rpc('send_friend_request', { p_code: await codeOf(a) })
    expect(await friendIds(a)).toEqual([b.id])
    const left = await adminClient().from('friend_requests').select('*').in('from_id', [a.id, b.id])
    expect(left.data).toEqual([])
  })

  it('remove_friend also clears pending requests between the two', async () => {
    const a = await newUser(), b = await newUser()
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(b) })
    await a.sb.rpc('remove_friend', { p_other: b.id })
    expect(((await b.sb.rpc('my_friend_requests')).data as unknown[]).length).toBe(0)
  })

  it('a new code stops the old one', async () => {
    const a = await newUser(), b = await newUser(), c = await newUser()
    const first = await startCode(a)
    expect(first).toMatch(/^\d{6}$/)
    const second = await startCode(a)
    if (second !== first) {
      expect(await redeem(b, first)).toBe('expired')
    }
    expect(await redeem(c, second)).toBe('ok')
    // the code is used up
    expect(await redeem(b, second)).toBe('expired')
  })

  it('Add in person makes friends at once and clears a pending request between them', async () => {
    const a = await newUser(), b = await newUser()
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(b) })
    const code = await startCode(b)
    expect(await redeem(a, code)).toBe('ok')
    expect(await friendIds(a)).toEqual([b.id])
    expect(await friendIds(b)).toEqual([a.id])
    const left = await adminClient().from('friend_requests').select('*').in('from_id', [a.id, b.id])
    expect(left.data).toEqual([])
    const codes = await adminClient().from('in_person_codes').select('*').eq('user_id', b.id)
    expect(codes.data).toEqual([])
  })

  it('you cannot redeem your own in-person code', async () => {
    const a = await newUser()
    expect(await redeem(a, await startCode(a))).toBe('self')
  })

  it('an in-person code stops working after 5 minutes', async () => {
    const a = await newUser(), b = await newUser()
    const code = await startCode(a)
    await adminClient().from('in_person_codes').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('user_id', a.id)
    expect(await redeem(b, code)).toBe('expired')
  })

  it("a student cannot read other students' friendships or requests", async () => {
    const a = await newUser(), b = await newUser(), c = await newUser(), d = await newUser()
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(b) })
    await b.sb.rpc('respond_friend_request', { p_from: a.id, p_accept: true })
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(c) })
    await startCode(a)
    for (const t of ['friendships', 'friend_requests', 'in_person_codes', 'social_log']) {
      const r = await d.sb.from(t).select('*')
      expect(r.error).toBeNull()
      expect(r.data).toEqual([])
    }
    // direct writes are refused
    const [x, y] = a.id < d.id ? [a.id, d.id] : [d.id, a.id]
    expect((await d.sb.from('friendships').insert({ a: x, b: y })).error).not.toBeNull()
  })

  it('the friend code cannot be edited, and a hidden student still shows in friends lists', async () => {
    const a = await newUser(), b = await newUser()
    const old = await codeOf(a)
    await a.sb.from('profiles').update({ show_on_boards: false, friend_code: 'ZZZZZZZZ' }).eq('id', a.id)
    expect(await codeOf(a)).toBe(old)
    await a.sb.rpc('send_friend_request', { p_code: await codeOf(b) })
    await b.sb.rpc('respond_friend_request', { p_from: a.id, p_accept: true })
    expect(await friendIds(b)).toEqual([a.id])
  })

  it('the 21st friend request in an hour is rate_limited', async () => {
    const a = await newUser()
    const codes: string[] = []
    for (let i = 0; i < 21; i++) codes.push(await codeOf(await newUser()))
    for (let i = 0; i < 20; i++) expect(await send(a, codes[i])).toBe('ok')
    expect(await send(a, codes[20])).toBe('rate_limited')
  })

  it('the 11th failed in-person redeem in an hour returns rate_limited, even with the right code', async () => {
    const a = await newUser(), b = await newUser()
    const code = await startCode(b)
    for (let i = 0; i < 10; i++) expect(await redeem(a, '000000')).toBe('expired')
    expect(await redeem(a, code)).toBe('rate_limited')
    expect(await friendIds(a)).toEqual([])
  })

  it('failed friend-request attempts count toward the limit too', async () => {
    const a = await newUser(), b = await newUser()
    for (let i = 0; i < 20; i++) expect(await send(a, 'AAAAAAAA')).toBe('not_found')
    expect(await send(a, await codeOf(b))).toBe('rate_limited')
  })

  it('new_friend_code gives a new code and the old one stops working', async () => {
    const a = await newUser(), b = await newUser()
    const old = await codeOf(a)
    const { data, error } = await a.sb.rpc('new_friend_code')
    expect(error).toBeNull()
    expect(data).toMatch(ALPHABET)
    expect(await codeOf(a)).toBe(data)
    expect(await send(b, old)).toBe('not_found')
    expect(await send(b, data as string)).toBe('ok')
  })
})
