import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

const events = new Set<string>()
const rpc = vi.fn(async (...a: unknown[]) => { void a; return { data: null, error: null } })
let customerUser: string | null = 'u1'
let insertFails = false
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  rpc: (...a: unknown[]) => rpc(...a),
  from: (t: string) => t === 'billing_events'
    ? { insert: async (row: { id: string }) => insertFails ? { error: { code: '08006' } } : (events.has(row.id) ? { error: { code: '23505' } } : (events.add(row.id), { error: null })),
        delete: () => ({ eq: async (_c: string, id: string) => { events.delete(id); return { error: null } } }) }
    : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: customerUser ? { user_id: customerUser } : null }) }) }) },
}) }))
const verifyTransaction = vi.fn()
const creditVerifiedCharge = vi.fn(async () => ({ state: 'credited', premiumUntil: 'x' }))
vi.mock('@/lib/billing/credit', async () => ({
  creditVerifiedCharge: (...a: unknown[]) => creditVerifiedCharge(...(a as [])),
  userForCharge: async (c: { userId: string | null }) => c.userId ?? customerUser,
}))
vi.mock('@/lib/billing/paystack', async orig => ({ ...(await orig<typeof import('@/lib/billing/paystack')>()), verifyTransaction: (r: string) => verifyTransaction(r) }))
import { POST } from '@/app/api/billing/webhook/route'

const sign = (body: string) => crypto.createHmac('sha512', 'sk_test').update(body).digest('hex')
const send = (payload: object, signature?: string) => {
  const body = JSON.stringify(payload)
  return POST(new Request('https://x/api/billing/webhook', { method: 'POST', body, headers: { 'x-paystack-signature': signature ?? sign(body) } }))
}
const charge = { reference: 'R1', status: 'success', amount: 5000, currency: 'GHS', channel: 'card', metadata: { user_id: 'u1', product: 'pass_1m' } }
beforeEach(() => {
  events.clear(); rpc.mockClear(); creditVerifiedCharge.mockClear(); verifyTransaction.mockReset(); customerUser = 'u1'; insertFails = false
  process.env.PAYSTACK_SECRET_KEY = 'sk_test'
  verifyTransaction.mockResolvedValue({ reference: 'R1', status: 'success', amountMinor: 5000, currency: 'GHS', channel: 'card', paidAt: null, userId: 'u1', product: 'pass_1m', planCode: null, customerCode: 'CUS_1', cardBrand: null, cardLast4: null })
})

describe('POST /api/billing/webhook', () => {
  it('rejects a bad or missing signature and credits nothing', async () => {
    expect((await send({ event: 'charge.success', data: charge }, 'forged')).status).toBe(401)
    expect(creditVerifiedCharge).not.toHaveBeenCalled()
  })
  it('re-verifies a charge with Paystack before crediting it (never trusts the body)', async () => {
    const res = await send({ event: 'charge.success', data: { ...charge, amount: 1 } })
    expect(res.status).toBe(200)
    expect(verifyTransaction).toHaveBeenCalledWith('R1')
    expect((creditVerifiedCharge.mock.calls[0] as unknown[])[0]).toMatchObject({ amountMinor: 5000 })
    expect((creditVerifiedCharge.mock.calls[0] as unknown[])[1]).toBe('u1')
  })
  it('handles the same event only once', async () => {
    await send({ event: 'charge.success', data: charge })
    await send({ event: 'charge.success', data: charge })
    expect(creditVerifiedCharge).toHaveBeenCalledTimes(1)
  })
  it('records subscriptions and their cancellation', async () => {
    await send({ event: 'subscription.create', data: { subscription_code: 'SUB_1', email_token: 'tok', customer: { customer_code: 'CUS_1' }, plan: { plan_code: 'PLN_m' } } })
    expect(rpc).toHaveBeenLastCalledWith('set_subscription', { p_user: 'u1', p_subscription_code: 'SUB_1', p_email_token: 'tok', p_auto_renew: true })
    await send({ event: 'subscription.not_renew', data: { subscription_code: 'SUB_1', customer: { customer_code: 'CUS_1' } } })
    expect(rpc).toHaveBeenLastCalledWith('set_subscription', { p_user: 'u1', p_subscription_code: 'SUB_1', p_email_token: null, p_auto_renew: false })
  })
  it('applies refunds by transaction reference', async () => {
    await send({ event: 'refund.processed', data: { id: 9, transaction_reference: 'R1' } })
    expect(rpc).toHaveBeenLastCalledWith('apply_refund', { p_reference: 'R1' })
  })
  it('returns 500 (so Paystack retries) and forgets the event when processing fails', async () => {
    creditVerifiedCharge.mockRejectedValueOnce(new Error('db down'))
    expect((await send({ event: 'charge.success', data: charge })).status).toBe(500)
    expect((await send({ event: 'charge.success', data: charge })).status).toBe(200)
    expect(creditVerifiedCharge).toHaveBeenCalledTimes(2)
  })
  it('retries a subscription event that arrives before its student is known', async () => {
    customerUser = null
    const create = { event: 'subscription.create', data: { subscription_code: 'SUB_1', email_token: 'tok', customer: { customer_code: 'CUS_1' }, plan: { plan_code: 'PLN_m' } } }
    expect((await send(create)).status).toBe(500)
    customerUser = 'u1' // the charge has been credited since
    expect((await send(create)).status).toBe(200)
    expect(rpc).toHaveBeenLastCalledWith('set_subscription', expect.objectContaining({ p_user: 'u1', p_auto_renew: true }))
  })
  it('retries when the event log or a database call fails, instead of dropping the event', async () => {
    insertFails = true
    expect((await send({ event: 'charge.success', data: charge })).status).toBe(500)
    expect(creditVerifiedCharge).not.toHaveBeenCalled()
    insertFails = false
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } } as never)
    expect((await send({ event: 'refund.processed', data: { id: 9, transaction_reference: 'R1' } })).status).toBe(500)
    expect((await send({ event: 'refund.processed', data: { id: 9, transaction_reference: 'R1' } })).status).toBe(200)
  })
  it('ignores events it does not use', async () => {
    expect((await send({ event: 'transfer.success', data: { id: 1 } })).status).toBe(200)
  })
})
