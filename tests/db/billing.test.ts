import { describe, it, expect } from 'vitest'
import { newUser, adminClient } from './helpers'

const admin = () => adminClient()
const check = (user: string, cost: number) => admin().rpc('ai_check', { p_user: user, p_cost: cost })
const charge = (user: string, cost: number) => admin().rpc('ai_charge', { p_user: user, p_cost: cost })
const pay = (user: string, reference: string, over: Record<string, unknown> = {}) => admin().rpc('apply_payment', {
  p_user: user, p_reference: reference, p_product: 'pass_1m', p_amount_minor: 5000, p_currency: 'GHS',
  p_channel: 'mobile_money', p_status: 'success', p_months: 1, p_paid_at: new Date().toISOString(),
  p_customer_code: `CUS_${user}`, p_card_brand: null, p_card_last4: null, ...over,
})
const ref = () => `T${crypto.randomUUID()}`

describe('usage functions are server-only', () => {
  it('students cannot call ai_check, ai_charge or apply_payment', async () => {
    const u = await newUser()
    expect((await u.sb.rpc('ai_check', { p_user: u.id, p_cost: 1 })).error).not.toBeNull()
    expect((await u.sb.rpc('ai_charge', { p_user: u.id, p_cost: -5 })).error).not.toBeNull()
    expect((await u.sb.rpc('apply_payment', { p_user: u.id, p_reference: 'x', p_product: 'pass_12m', p_amount_minor: 0, p_currency: 'GHS', p_channel: 'card', p_status: 'success', p_months: 12, p_paid_at: new Date().toISOString(), p_customer_code: null, p_card_brand: null, p_card_last4: null })).error).not.toBeNull()
    expect((await u.sb.rpc('ai_request_allowed')).error).not.toBeNull() // replaced by ai_check
  })
  it('students can read but not write their own plan, payments and usage', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    await charge(u.id, 2)
    expect((await u.sb.from('entitlements').select('premium_until').single()).data?.premium_until).toBeTruthy()
    expect((await u.sb.from('payments').select('id')).data).toHaveLength(1)
    expect((await u.sb.from('ai_charges').select('cost')).data).toEqual([{ cost: 2 }])
    await u.sb.from('entitlements').update({ premium_until: '2099-01-01T00:00:00Z' }).eq('user_id', u.id)
    await u.sb.from('ai_charges').delete().eq('user_id', u.id)
    expect((await u.sb.from('entitlements').insert({ user_id: u.id, premium_until: '2099-01-01T00:00:00Z' })).error).not.toBeNull()
    const ent = (await u.sb.from('entitlements').select('premium_until').single()).data!
    expect(new Date(ent.premium_until).getFullYear()).toBeLessThan(2099)
    expect((await u.sb.from('ai_charges').select('cost')).data).toHaveLength(1)
    expect((await u.sb.from('billing_events').select('id')).data).toEqual([])
  })
})

describe('Free plan: 10 AI actions a day, by cost', () => {
  it('allows up to 10 cost, then says daily_limit', async () => {
    const u = await newUser()
    expect((await check(u.id, 3)).data).toBe('ok') // an ok check reserves its cost
    expect((await check(u.id, 7)).data).toBe('ok')
    expect((await check(u.id, 1)).data).toBe('daily_limit')
    expect((await check(u.id, 0)).data).toBe('ok') // free marking still allowed
  })
  it('a big job that would pass the limit is refused even with some left', async () => {
    const u = await newUser()
    await charge(u.id, 8)
    expect((await check(u.id, 3)).data).toBe('daily_limit')
    expect((await check(u.id, 2)).data).toBe('ok')
  })
  it('the speed limit applies to everyone: 10 requests a minute', async () => {
    const u = await newUser()
    const results = await Promise.all(Array.from({ length: 12 }, () => check(u.id, 0)))
    expect(results.filter(r => r.data === 'ok')).toHaveLength(10)
    expect(results.filter(r => r.data === 'rate_limited')).toHaveLength(2)
  })
  it('rejects costs outside 0–10', async () => {
    const u = await newUser()
    expect((await check(u.id, -1)).error).not.toBeNull()
    expect((await check(u.id, 11)).error).not.toBeNull()
  })
})

describe('Premium: no daily limit, fair use 400 a month', () => {
  it('a Premium student passes the daily limit', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    await charge(u.id, 10)
    expect((await check(u.id, 5)).data).toBe('ok')
  })
  it('stops at 400 this month with fair_use', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    for (let i = 0; i < 40; i++) await charge(u.id, 10)
    expect((await check(u.id, 1)).data).toBe('fair_use')
  })
  it('when Premium has ended, the free daily limit applies at once', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    await admin().from('entitlements').update({ premium_until: new Date(Date.now() - 1000).toISOString() }).eq('user_id', u.id)
    await charge(u.id, 10)
    expect((await check(u.id, 1)).data).toBe('daily_limit')
  })
})

describe('apply_payment', () => {
  it('starts Premium from now and stacks a second pass on the end date', async () => {
    const u = await newUser()
    const first = new Date((await pay(u.id, ref())).data as string)
    const second = new Date((await pay(u.id, ref(), { p_product: 'pass_3m', p_amount_minor: 13500, p_months: 3 })).data as string)
    const days = (second.getTime() - first.getTime()) / 86_400_000
    expect(days).toBeGreaterThan(88)
    expect(days).toBeLessThan(93)
  })
  it('credits a reference only once, even when called at the same time', async () => {
    const u = await newUser()
    const r = ref()
    const results = await Promise.all([pay(u.id, r), pay(u.id, r), pay(u.id, r)])
    expect(results.every(x => !x.error)).toBe(true)
    expect((await admin().from('payments').select('id').eq('reference', r)).data).toHaveLength(1)
    const until = new Date((await admin().from('entitlements').select('premium_until').eq('user_id', u.id).single()).data!.premium_until)
    expect((until.getTime() - Date.now()) / 86_400_000).toBeLessThan(32)
  })
  it('records failed and needs_review payments without extending Premium', async () => {
    const u = await newUser()
    await pay(u.id, ref(), { p_status: 'needs_review' })
    const ent = (await admin().from('entitlements').select('premium_until').eq('user_id', u.id).maybeSingle()).data
    expect(ent?.premium_until ?? null).toBeNull()
  })
  it('a refund takes the months back off', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    const r = ref()
    const before = new Date((await pay(u.id, r, { p_product: 'pass_12m', p_amount_minor: 48000, p_months: 12 })).data as string)
    await admin().rpc('apply_refund', { p_reference: r })
    const after = new Date((await admin().from('entitlements').select('premium_until').eq('user_id', u.id).single()).data!.premium_until)
    expect((before.getTime() - after.getTime()) / 86_400_000).toBeGreaterThan(360)
    expect((await admin().from('payments').select('status').eq('reference', r).single()).data!.status).toBe('refunded')
  })
  it('set_subscription records auto-renew', async () => {
    const u = await newUser()
    await admin().rpc('set_subscription', { p_user: u.id, p_subscription_code: 'SUB_1', p_email_token: 'tok', p_auto_renew: true })
    const ent = (await u.sb.from('entitlements').select('auto_renew,subscription_code').single()).data!
    expect(ent).toEqual({ auto_renew: true, subscription_code: 'SUB_1' })
  })
})

describe('review fixes', () => {
  const release = (user: string, cost: number) => admin().rpc('ai_release', { p_user: user, p_cost: cost })
  it('parallel AI requests cannot overshoot the free limit', async () => {
    const u = await newUser()
    const results = await Promise.all(Array.from({ length: 8 }, () => check(u.id, 3)))
    expect(results.filter(r => r.data === 'ok')).toHaveLength(3)
    expect(results.filter(r => r.data === 'daily_limit')).toHaveLength(5)
  })
  it('a failed AI call gives its reservation back', async () => {
    const u = await newUser()
    expect((await check(u.id, 10)).data).toBe('ok')
    expect((await release(u.id, 10)).error).toBeNull()
    expect((await check(u.id, 10)).data).toBe('ok')
    expect((await u.sb.rpc('ai_release', { p_user: u.id, p_cost: 10 })).error).not.toBeNull() // server only
  })
  it('a reference that failed first and then succeeded is credited once', async () => {
    const u = await newUser()
    const r = ref()
    await pay(u.id, r, { p_status: 'failed', p_months: 0 })
    const until = (await pay(u.id, r)).data as string
    expect(until).toBeTruthy()
    expect((await admin().from('payments').select('status,months').eq('reference', r).single()).data).toEqual({ status: 'success', months: 1 })
    expect((await pay(u.id, r)).data).toBe(until) // and only once
  })
  it('a late disable for an old subscription leaves the current one alone', async () => {
    const u = await newUser()
    const sub = (code: string | null, on: boolean) => admin().rpc('set_subscription', { p_user: u.id, p_subscription_code: code, p_email_token: on ? 'tok' : null, p_auto_renew: on })
    const ent = async () => (await u.sb.from('entitlements').select('auto_renew,subscription_code').single()).data
    await sub('SUB_old', true); await sub('SUB_new', true)
    await sub('SUB_old', false)
    expect(await ent()).toEqual({ auto_renew: true, subscription_code: 'SUB_new' })
    await sub('SUB_new', false)
    expect(await ent()).toEqual({ auto_renew: false, subscription_code: 'SUB_new' })
    await sub('SUB_new', true); await sub(null, false) // turning renewal off in Settings
    expect((await ent())?.auto_renew).toBe(false)
  })
})
