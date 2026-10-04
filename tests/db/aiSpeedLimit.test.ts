import { describe, it, expect } from 'vitest'
import { newUser, adminClient } from './helpers'

// The speed limit is checked by the server (service role) through ai_check; cost 0 = speed only
const check = (user: string) => adminClient().rpc('ai_check', { p_user: user, p_cost: 0 })

describe('AI speed limit (10 AI requests a minute, for everyone)', () => {
  it('allows 10 AI requests a minute, then refuses', async () => {
    const u = await newUser()
    const results: string[] = []
    for (let i = 0; i < 11; i++) results.push((await check(u.id)).data as string)
    expect(results.slice(0, 10).every(r => r === 'ok')).toBe(true)
    expect(results[10]).toBe('rate_limited')
  })
  it('counts requests fired at the same moment', async () => {
    const u = await newUser()
    const results = await Promise.all(Array.from({ length: 15 }, () => check(u.id)))
    expect(results.filter(r => r.data === 'ok')).toHaveLength(10)
  })
  it('is per student', async () => {
    const a = await newUser(), b = await newUser()
    for (let i = 0; i < 10; i++) await check(a.id)
    expect((await check(b.id)).data).toBe('ok')
  })
  it('cannot be bypassed by editing the request log', async () => {
    const u = await newUser()
    for (let i = 0; i < 10; i++) await check(u.id)
    await u.sb.from('ai_requests').delete().eq('user_id', u.id)
    await u.sb.from('ai_requests').update({ at: '2000-01-01T00:00:00Z' }).eq('user_id', u.id)
    expect((await u.sb.from('ai_requests').insert({ user_id: u.id })).error).not.toBeNull()
    expect((await check(u.id)).data).toBe('rate_limited')
  })
  it('the old daily allowance is gone', async () => {
    const u = await newUser()
    expect((await u.sb.rpc('consume_ai_import')).error).not.toBeNull()
    expect((await u.sb.from('ai_usage').select('*')).error).not.toBeNull()
  })
})
