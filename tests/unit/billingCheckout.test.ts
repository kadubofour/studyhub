import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string; email: string; email_confirmed_at: string | null } | null
const initializeCheckout = vi.fn(async () => ({ url: 'https://pay/x', reference: 'R1' }))
let renewing = false
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { auto_renew: renewing } }) }) }),
}) }))
vi.mock('@/lib/billing/paystack', () => ({ initializeCheckout: (...a: unknown[]) => initializeCheckout(...(a as [])) }))
vi.mock('@/lib/supabase/admin', () => ({ isBillingConfigured: () => !!process.env.PAYSTACK_SECRET_KEY }))
import { POST } from '@/app/api/billing/checkout/route'

const call = (body: object) => POST(new Request('https://studyhub.test/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) }))
const sent = () => (initializeCheckout.mock.calls[0] as unknown as [Record<string, unknown>])[0]
beforeEach(() => {
  user = { id: 'u1', email: 'ama@example.com', email_confirmed_at: '2026-10-01T00:00:00Z' }
  renewing = false; initializeCheckout.mockClear(); process.env.PAYSTACK_SECRET_KEY = 'sk'; process.env.PAYSTACK_PLAN_MONTHLY = 'PLN_m'; process.env.PAYSTACK_PLAN_YEARLY = 'PLN_y'
})

describe('POST /api/billing/checkout', () => {
  it('refuses a second auto-renew while one is on (it would charge twice); a pass is still fine', async () => {
    renewing = true
    const res = await call({ choice: '1m', autoRenew: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'already_renewing' })
    expect(initializeCheckout).not.toHaveBeenCalled()
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(200)
  })
  it('starts a pass that MoMo or card can pay, returning to /plans/return', async () => {
    const res = await call({ choice: '3m', autoRenew: false })
    expect(await res.json()).toEqual({ url: 'https://pay/x' })
    expect(sent()).toMatchObject({ email: 'ama@example.com', amountMinor: 13500, channels: ['card', 'mobile_money'], callbackUrl: 'https://studyhub.test/plans/return', metadata: { user_id: 'u1', product: 'pass_3m' } })
    expect(sent().planCode).toBeUndefined()
  })
  it('auto-renew is card only and uses the Paystack plan', async () => {
    await call({ choice: '12m', autoRenew: true })
    expect(sent()).toMatchObject({ amountMinor: 48000, channels: ['card'], planCode: 'PLN_y', metadata: { product: 'renew_12m' } })
  })
  it('refuses auto-renew for 3 months, unknown choices, signed-out and unconfirmed students', async () => {
    expect((await call({ choice: '3m', autoRenew: true })).status).toBe(400)
    expect((await call({ choice: '6m', autoRenew: false })).status).toBe(400)
    user = { id: 'u1', email: 'a@b.c', email_confirmed_at: null }
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(403)
    user = null
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(401)
    expect(initializeCheckout).not.toHaveBeenCalled()
  })
  it('says billing is unavailable without Paystack keys, and reports Paystack failures', async () => {
    delete process.env.PAYSTACK_SECRET_KEY
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(503)
    process.env.PAYSTACK_SECRET_KEY = 'sk'
    initializeCheckout.mockRejectedValueOnce(new Error('down'))
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(502)
  })
})
