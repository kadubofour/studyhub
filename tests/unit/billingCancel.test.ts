import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string } | null = { id: 'u1' }
let ent: { subscription_code: string | null; email_token: string | null; auto_renew: boolean } | null
const disableSubscription = vi.fn(async () => {})
const rpc = vi.fn(async () => ({ error: null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  rpc: (...a: unknown[]) => rpc(...(a as [])),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ent }) }) }) }),
}) }))
vi.mock('@/lib/billing/paystack', () => ({ disableSubscription: (...a: unknown[]) => disableSubscription(...(a as [])) }))
import { POST } from '@/app/api/billing/cancel-renewal/route'

const call = () => POST()
beforeEach(() => { user = { id: 'u1' }; ent = { subscription_code: 'SUB_1', email_token: 'tok', auto_renew: true }; disableSubscription.mockClear(); rpc.mockClear() })

describe('POST /api/billing/cancel-renewal', () => {
  it('disables the Paystack subscription and records auto-renew off', async () => {
    expect((await call()).status).toBe(200)
    expect(disableSubscription).toHaveBeenCalledWith('SUB_1', 'tok')
    expect(rpc).toHaveBeenCalledWith('set_subscription', { p_user: 'u1', p_subscription_code: null, p_email_token: null, p_auto_renew: false })
  })
  it('404s without a subscription, 502s when Paystack fails (renewal stays on), 401s signed out', async () => {
    disableSubscription.mockRejectedValueOnce(new Error('down'))
    expect((await call()).status).toBe(502)
    expect(rpc).not.toHaveBeenCalled()
    ent = { subscription_code: null, email_token: null, auto_renew: false }
    expect((await call()).status).toBe(404)
    user = null
    expect((await call()).status).toBe(401)
  })
})
