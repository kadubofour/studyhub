import { describe, it, expect, afterEach } from 'vitest'
import { POST, GET } from '@/app/api/test-paystack/[...path]/route'

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) })
afterEach(() => { delete process.env.E2E_FAKE_PAYSTACK })

describe('fake Paystack (E2E only)', () => {
  it('does not exist unless E2E mode is on', async () => {
    expect((await POST(new Request('http://x', { method: 'POST', body: '{}' }), ctx(['transaction', 'initialize']))).status).toBe(404)
  })
  it('initialises and verifies a transaction in Paystack\'s shape', async () => {
    process.env.E2E_FAKE_PAYSTACK = '1'
    const init = await (await POST(new Request('http://localhost:3100/x', { method: 'POST', body: JSON.stringify({ email: 'a@b.c', amount: 5000, currency: 'GHS', callback_url: 'http://localhost:3100/plans/return', metadata: { user_id: 'u1', product: 'pass_1m' } }) }), ctx(['transaction', 'initialize']))).json() as { status: boolean; data: { reference: string; authorization_url: string } }
    expect(init.status).toBe(true)
    expect(init.data.authorization_url).toContain('/api/test-paystack/pay?reference=')
    const v = await (await GET(new Request('http://x'), ctx(['transaction', 'verify', init.data.reference]))).json() as { data: { status: string; amount: number } }
    expect(v.data).toMatchObject({ status: 'ongoing', amount: 5000 })
  })
})
