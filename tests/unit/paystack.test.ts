import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { disableSubscription, initializeCheckout, parseCharge, verifySignature, verifyTransaction } from '@/lib/billing/paystack'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); process.env.PAYSTACK_SECRET_KEY = 'sk_test_x'; delete process.env.PAYSTACK_BASE_URL })
afterEach(() => { vi.unstubAllGlobals(); delete process.env.PAYSTACK_SECRET_KEY })
const reply = (body: object, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))

describe('verifySignature', () => {
  const body = '{"event":"charge.success"}'
  const sig = crypto.createHmac('sha512', 'sk_test_x').update(body).digest('hex')
  it('accepts Paystack\'s HMAC-SHA512 of the raw body', () => { expect(verifySignature(body, sig)).toBe(true) })
  it('rejects a wrong, missing or tampered signature', () => {
    expect(verifySignature(body, 'nope')).toBe(false)
    expect(verifySignature(body, null)).toBe(false)
    expect(verifySignature(body + ' ', sig)).toBe(false)
  })
})

describe('initializeCheckout', () => {
  it('posts the amount in pesewas, GHS, channels, metadata and plan with the secret key', async () => {
    reply({ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'R1' } })
    const out = await initializeCheckout({ email: 'a@b.c', amountMinor: 5000, callbackUrl: 'https://x/plans/return', channels: ['card', 'mobile_money'], metadata: { user_id: 'u1', product: 'pass_1m' } })
    expect(out).toEqual({ url: 'https://checkout.paystack.com/abc', reference: 'R1' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.paystack.co/transaction/initialize')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_x')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.c', amount: 5000, currency: 'GHS', callback_url: 'https://x/plans/return', channels: ['card', 'mobile_money'], metadata: { user_id: 'u1', product: 'pass_1m' } })
  })
  it('includes the plan code for auto-renew and throws PaystackError on failure', async () => {
    reply({ status: true, data: { authorization_url: 'u', reference: 'R' } })
    await initializeCheckout({ email: 'a@b.c', amountMinor: 5000, callbackUrl: 'c', channels: ['card'], metadata: { user_id: 'u', product: 'renew_1m' }, planCode: 'PLN_m' })
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).plan).toBe('PLN_m')
    reply({ status: false, message: 'bad' }, 400)
    await expect(initializeCheckout({ email: 'a', amountMinor: 1, callbackUrl: 'c', channels: ['card'], metadata: { user_id: 'u', product: 'pass_1m' } })).rejects.toThrow('bad')
  })
})

describe('parseCharge / verifyTransaction', () => {
  const data = {
    status: 'success', reference: 'R1', amount: 5000, currency: 'GHS', channel: 'mobile_money', paid_at: '2026-10-04T10:00:00Z',
    metadata: '{"user_id":"u1","product":"pass_1m"}', customer: { customer_code: 'CUS_1' }, authorization: { last4: '4242', brand: 'visa' }, plan: { plan_code: 'PLN_m' },
  }
  it('normalises Paystack\'s fields (metadata may be a JSON string, plan an object or code)', () => {
    expect(parseCharge(data)).toEqual({ reference: 'R1', status: 'success', amountMinor: 5000, currency: 'GHS', channel: 'mobile_money', paidAt: '2026-10-04T10:00:00Z', userId: 'u1', product: 'pass_1m', planCode: 'PLN_m', customerCode: 'CUS_1', cardBrand: 'visa', cardLast4: '4242' })
    expect(parseCharge({ ...data, plan: 'PLN_y', metadata: { user_id: 'u2' } })).toMatchObject({ planCode: 'PLN_y', userId: 'u2', product: null })
    expect(parseCharge({ ...data, status: 'abandoned', channel: 'bank' })).toMatchObject({ status: 'pending', channel: 'other' })
    expect(parseCharge({ ...data, status: 'failed', plan: null })).toMatchObject({ status: 'failed', planCode: null })
  })
  it('verifies by reference', async () => {
    reply({ status: true, data })
    expect((await verifyTransaction('R 1')).reference).toBe('R1')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.paystack.co/transaction/verify/R%201')
  })
})

describe('disableSubscription', () => {
  it('posts the code and email token', async () => {
    reply({ status: true, message: 'ok' })
    await disableSubscription('SUB_1', 'tok')
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ code: 'SUB_1', token: 'tok' })
  })
})
