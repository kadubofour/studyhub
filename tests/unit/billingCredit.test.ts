import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VerifiedCharge } from '@/lib/billing/paystack'

const rpc = vi.fn(async (...a: unknown[]) => { void a; return { data: '2026-11-04T00:00:00Z', error: null } })
let customerRow: { user_id: string } | null = null
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  rpc: (...a: unknown[]) => rpc(...a),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: customerRow, error: null }) }) }) }),
}) }))
vi.mock('server-only', () => ({}))
import { creditVerifiedCharge, productFor, userForCharge } from '@/lib/billing/credit'

const base: VerifiedCharge = { reference: 'R1', status: 'success', amountMinor: 5000, currency: 'GHS', channel: 'mobile_money', paidAt: '2026-10-04T10:00:00Z', userId: 'u1', product: 'pass_1m', planCode: null, customerCode: 'CUS_1', cardBrand: null, cardLast4: null }
beforeEach(() => { rpc.mockClear(); customerRow = null; process.env.PAYSTACK_PLAN_MONTHLY = 'PLN_m'; process.env.PAYSTACK_PLAN_YEARLY = 'PLN_y' })
const args = () => rpc.mock.calls[0][1] as Record<string, unknown>

describe('productFor', () => {
  it('uses the product from checkout metadata, or the plan for renewals', () => {
    expect(productFor(base)).toBe('pass_1m')
    expect(productFor({ ...base, product: null, planCode: 'PLN_y' })).toBe('renew_12m')
    expect(productFor({ ...base, product: 'gold', planCode: null })).toBeNull()
  })
})

describe('creditVerifiedCharge', () => {
  it('credits a matching successful charge', async () => {
    expect(await creditVerifiedCharge(base, 'u1')).toEqual({ state: 'credited', premiumUntil: '2026-11-04T00:00:00Z' })
    expect(rpc.mock.calls[0][0]).toBe('apply_payment')
    expect(args()).toMatchObject({ p_user: 'u1', p_reference: 'R1', p_product: 'pass_1m', p_amount_minor: 5000, p_status: 'success', p_months: 1, p_channel: 'mobile_money', p_customer_code: 'CUS_1' })
  })
  it('records a wrong amount or currency as needs_review, extending nothing', async () => {
    expect((await creditVerifiedCharge({ ...base, amountMinor: 100 }, 'u1')).state).toBe('needs_review')
    expect(args()).toMatchObject({ p_status: 'needs_review', p_months: 0 })
    rpc.mockClear()
    expect((await creditVerifiedCharge({ ...base, currency: 'NGN' }, 'u1')).state).toBe('needs_review')
  })
  it('records failures and leaves pending charges alone', async () => {
    expect((await creditVerifiedCharge({ ...base, status: 'failed' }, 'u1')).state).toBe('failed')
    expect(args()).toMatchObject({ p_status: 'failed', p_months: 0 })
    rpc.mockClear()
    expect((await creditVerifiedCharge({ ...base, status: 'pending' }, 'u1')).state).toBe('pending')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('userForCharge', () => {
  it('uses the checkout metadata, or finds a renewal\'s student by Paystack customer', async () => {
    expect(await userForCharge(base)).toBe('u1')
    customerRow = { user_id: 'u9' }
    expect(await userForCharge({ ...base, userId: null })).toBe('u9')
    customerRow = null
    expect(await userForCharge({ ...base, userId: null })).toBeNull()
  })
})
