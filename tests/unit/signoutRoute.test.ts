import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string } | null = { id: 'u1' }
let profile: { id: string } | null = { id: 'u1' }
const signOut = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user } }), signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
  }),
}))

import { GET } from '@/app/auth/signout/route'

beforeEach(() => { user = { id: 'u1' }; profile = { id: 'u1' }; signOut.mockClear() })

describe('GET /auth/signout', () => {
  it('signs out and explains when the account\'s profile is missing', async () => {
    profile = null
    const res = await GET(new Request('http://x/auth/signout?reason=profile'))
    expect(signOut).toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://x/login?error=profile')
  })
  it('does nothing for a healthy account, so a link on another site can\'t log students out', async () => {
    const res = await GET(new Request('http://x/auth/signout?reason=profile'))
    expect(signOut).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://x/home')
  })
})
