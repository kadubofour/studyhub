import { describe, it, expect, vi, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { billing } from '@/lib/billing/provider'

afterEach(() => { vi.unstubAllGlobals(); delete process.env.PAYSTACK_SECRET_KEY })

describe('billing provider', () => {
  it('is Paystack for now, behind the provider-neutral interface the routes use', async () => {
    expect(billing.name).toBe('paystack')
    expect(billing.signatureHeader).toBe('x-paystack-signature')
    process.env.PAYSTACK_SECRET_KEY = 'sk'
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'R1' } })
    expect(billing.verifySignature(body, crypto.createHmac('sha512', 'sk').update(body).digest('hex'))).toBe(true)
    expect(billing.parseWebhook(body)).toMatchObject({ kind: 'charge', reference: 'R1' })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://pay/x', reference: 'R9' } })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await billing.initializeCheckout({ email: 'a@b.c', amountMinor: 5000, callbackUrl: 'https://x/plans/return', channels: ['card'], metadata: { user_id: 'u1', product: 'pass_1m' } }))
      .toEqual({ url: 'https://pay/x', reference: 'R9' })
  })
})
