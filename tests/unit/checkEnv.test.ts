import { describe, it, expect } from 'vitest'
import { checkEnv, parseEnvFile } from '@/scripts/check-env'

const GOOD = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key', NEXT_PUBLIC_SITE_URL: 'https://studyhub.app',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key', OPENAI_API_KEY: 'sk-x', PAYSTACK_SECRET_KEY: 'sk_live_x', PAYSTACK_PLAN_MONTHLY: 'PLN_m', PAYSTACK_PLAN_YEARLY: 'PLN_y',
  YOUTUBE_API_KEY: 'yt', NEXT_PUBLIC_SUPPORT_EMAIL: 'help@studyhub.app',
}

describe('checkEnv', () => {
  it('is happy with everything set for production', () => {
    const r = checkEnv(GOOD, 'production')
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.features.filter(f => !f.on)).toEqual([])
  })
  it('fails for what the app cannot run without', () => {
    const r = checkEnv({}, 'production')
    expect(r.errors.map(e => e.name)).toEqual(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SITE_URL'])
  })
  it('says what each missing optional setting turns off', () => {
    const r = checkEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://a.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k', NEXT_PUBLIC_SITE_URL: 'https://s.app' }, 'production')
    expect(r.errors).toEqual([])
    const off = Object.fromEntries(r.features.map(f => [f.name, f]))
    expect(off['AI features'].on).toBe(false)
    expect(off['AI features'].missing).toEqual(['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    expect(off['Payments (Premium)'].missing).toEqual(['PAYSTACK_SECRET_KEY', 'PAYSTACK_PLAN_MONTHLY', 'PAYSTACK_PLAN_YEARLY', 'SUPABASE_SERVICE_ROLE_KEY'])
    expect(off['Account deletion'].missing).toEqual(['SUPABASE_SERVICE_ROLE_KEY'])
    expect(off['YouTube videos'].on).toBe(false)
    expect(off['Contact address on the legal pages'].on).toBe(false)
    for (const f of r.features) expect(f.effect.length).toBeGreaterThan(10)
  })
  it('treats blank values as missing', () => {
    expect(checkEnv({ ...GOOD, OPENAI_API_KEY: '   ' }, 'production').features.find(f => f.name === 'AI features')!.on).toBe(false)
  })
  it('warns about a site address that points at this computer, in production', () => {
    expect(checkEnv({ ...GOOD, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, 'production').warnings.join(' ')).toMatch(/NEXT_PUBLIC_SITE_URL/)
    expect(checkEnv({ ...GOOD, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, 'development').warnings).toEqual([])
  })
  it('warns when the service key is the same as the public key, and when a payment key is a test key in production', () => {
    expect(checkEnv({ ...GOOD, SUPABASE_SERVICE_ROLE_KEY: 'anon-key' }, 'production').warnings.join(' ')).toMatch(/SERVICE_ROLE/)
    expect(checkEnv({ ...GOOD, PAYSTACK_SECRET_KEY: 'sk_test_x' }, 'production').warnings.join(' ')).toMatch(/test key/)
    expect(checkEnv({ ...GOOD, PAYSTACK_SECRET_KEY: 'sk_test_x' }, 'development').warnings).toEqual([])
  })
  it('warns about test-only settings, which must never be on in production', () => {
    const w = checkEnv({ ...GOOD, E2E_FAKE_AI: '1', OPENAI_BASE_URL: 'http://localhost/fake', PAYSTACK_BASE_URL: 'http://x', YOUTUBE_API_BASE: 'http://y', E2E_FAKE_PAYSTACK: '1' }, 'production').warnings.join(' ')
    for (const n of ['E2E_FAKE_AI', 'OPENAI_BASE_URL', 'PAYSTACK_BASE_URL', 'YOUTUBE_API_BASE', 'E2E_FAKE_PAYSTACK']) expect(w).toContain(n)
  })
  it('does not print any value, only names', () => {
    const r = checkEnv({ ...GOOD, SUPABASE_SERVICE_ROLE_KEY: 'anon-key' }, 'production')
    expect(JSON.stringify(r)).not.toContain('service-key')
    expect(JSON.stringify(r)).not.toContain('sk_live_x')
  })
})

describe('parseEnvFile', () => {
  it('reads names and values, ignoring comments, blanks and quotes', () => {
    const env = parseEnvFile('# a comment\n\nA=1\nB="two words"\nC=\'x\'\nD=\nexport E=5\nF=a=b\n')
    expect(env).toEqual({ A: '1', B: 'two words', C: 'x', D: '', E: '5', F: 'a=b' })
  })
})
