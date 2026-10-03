import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

describe('AI speed limit (no caps, just a pace limit)', () => {
  it('allows 10 AI requests a minute, then refuses', async () => {
    const u = await newUser()
    const results: boolean[] = []
    for (let i = 0; i < 11; i++) results.push((await u.sb.rpc('ai_request_allowed')).data as boolean)
    expect(results.slice(0, 10).every(Boolean)).toBe(true)
    expect(results[10]).toBe(false)
  })
  it('counts requests fired at the same moment', async () => {
    const u = await newUser()
    const results = await Promise.all(Array.from({ length: 15 }, () => u.sb.rpc('ai_request_allowed')))
    expect(results.filter(r => r.data === true)).toHaveLength(10)
  })
  it('is per student', async () => {
    const a = await newUser(), b = await newUser()
    for (let i = 0; i < 10; i++) await a.sb.rpc('ai_request_allowed')
    expect((await b.sb.rpc('ai_request_allowed')).data).toBe(true)
  })
  it('cannot be bypassed by editing the request log', async () => {
    const u = await newUser()
    for (let i = 0; i < 10; i++) await u.sb.rpc('ai_request_allowed')
    await u.sb.from('ai_requests').delete().eq('user_id', u.id)
    await u.sb.from('ai_requests').update({ at: '2000-01-01T00:00:00Z' }).eq('user_id', u.id)
    expect((await u.sb.from('ai_requests').insert({ user_id: u.id })).error).not.toBeNull()
    expect((await u.sb.rpc('ai_request_allowed')).data).toBe(false)
  })
  it('the old daily allowance is gone', async () => {
    const u = await newUser()
    expect((await u.sb.rpc('consume_ai_import')).error).not.toBeNull()
    expect((await u.sb.from('ai_usage').select('*')).error).not.toBeNull()
  })
})
