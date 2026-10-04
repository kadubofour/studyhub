import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string } | null = { id: 'u1' }
const verifyTransaction = vi.fn()
const creditVerifiedCharge = vi.fn(async (): Promise<{ state: string; premiumUntil: string | null }> => ({ state: 'credited', premiumUntil: '2026-11-04T00:00:00Z' }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
vi.mock('@/lib/billing/paystack', () => ({ verifyTransaction: (r: string) => verifyTransaction(r) }))
vi.mock('@/lib/billing/credit', () => ({ creditVerifiedCharge: (...a: unknown[]) => creditVerifiedCharge(...(a as [])) }))
import { GET } from '@/app/api/billing/confirm/route'

const call = (ref = 'R1') => GET(new Request(`https://x/api/billing/confirm?reference=${ref}`))
const charge = (over = {}) => ({ reference: 'R1', status: 'success', userId: 'u1', ...over })
beforeEach(() => { user = { id: 'u1' }; verifyTransaction.mockReset(); creditVerifiedCharge.mockClear() })

describe('GET /api/billing/confirm', () => {
  it('verifies with Paystack and credits the student\'s own payment', async () => {
    verifyTransaction.mockResolvedValue(charge())
    expect(await (await call()).json()).toEqual({ state: 'credited', premiumUntil: '2026-11-04T00:00:00Z' })
    expect((creditVerifiedCharge.mock.calls[0] as unknown[])[1]).toBe('u1')
  })
  it('reports a pending MoMo payment as pending, not failed', async () => {
    verifyTransaction.mockResolvedValue(charge({ status: 'pending' }))
    creditVerifiedCharge.mockResolvedValueOnce({ state: 'pending', premiumUntil: null })
    expect(await (await call()).json()).toEqual({ state: 'pending', premiumUntil: null })
  })
  it('refuses another student\'s reference', async () => {
    verifyTransaction.mockResolvedValue(charge({ userId: 'u2' }))
    expect((await call()).status).toBe(403)
    expect(creditVerifiedCharge).not.toHaveBeenCalled()
  })
  it('needs a signed-in student and a reference; reports Paystack errors', async () => {
    expect((await call('')).status).toBe(400)
    verifyTransaction.mockRejectedValueOnce(new Error('down'))
    expect((await call()).status).toBe(502)
    user = null
    expect((await call()).status).toBe(401)
  })
})
