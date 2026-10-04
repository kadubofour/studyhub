import { describe, it, expect, vi, afterEach } from 'vitest'

const saved = { ...process.env }
afterEach(() => { process.env = { ...saved }; vi.resetModules() })

async function flagWith(env: Record<string, string | undefined>) {
  delete process.env.PAYSTACK_SECRET_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.NEXT_PUBLIC_BILLING_ENABLED
  Object.assign(process.env, env)
  vi.resetModules()
  const config = (await import('@/next.config')).default
  return config.env?.NEXT_PUBLIC_BILLING_ENABLED
}

describe('billing switch in the browser', () => {
  it('is on only when the server can take payments (Paystack and service-role keys both set)', async () => {
    expect(await flagWith({ PAYSTACK_SECRET_KEY: 'sk', SUPABASE_SERVICE_ROLE_KEY: 'srk' })).toBe('1')
    expect(await flagWith({ PAYSTACK_SECRET_KEY: 'sk' })).toBe('')
    expect(await flagWith({ SUPABASE_SERVICE_ROLE_KEY: 'srk' })).toBe('')
    expect(await flagWith({ NEXT_PUBLIC_BILLING_ENABLED: '1' })).toBe('') // can't be switched on without keys
  })
})
