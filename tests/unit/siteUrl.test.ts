import { describe, it, expect, vi, afterEach } from 'vitest'
import { siteUrl } from '@/lib/site'

afterEach(() => { vi.unstubAllEnvs() })

describe('siteUrl', () => {
  it('uses the configured address', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://studyhub.app/')
    expect(siteUrl().href).toBe('https://studyhub.app/')
  })
  it('falls back to this computer when the address is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(siteUrl().href).toBe('http://localhost:3000/')
  })
  it('does not crash the whole app on a value that is not an address, or one that is not a web address', () => {
    for (const bad of ['studyhub.app', 'not a url', 'ftp://x.test', 'javascript:alert(1)']) {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', bad)
      expect(siteUrl().href, bad).toBe('http://localhost:3000/')
    }
  })
})
