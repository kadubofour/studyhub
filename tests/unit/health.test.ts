import { describe, it, expect, vi, beforeEach } from 'vitest'

let result: { error: { message: string } | null }
let throws = false
const createClient = vi.fn((..._a: unknown[]) => ({ from: () => ({ select: () => ({ limit: async () => { if (throws) throw new Error('network'); return result } }) }) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => createClient(...a) }))
import { GET } from '@/app/api/health/route'

beforeEach(() => { result = { error: null }; throws = false; process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon' })

describe('GET /api/health', () => {
  it('says ok when the app can reach its database', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
  it('says 503 when the database cannot be reached or answers with an error', async () => {
    result = { error: { message: 'down' } }
    expect((await GET()).status).toBe(503)
    throws = true
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false })
  })
  it('says 503 when the database address is not set, and never reveals any setting', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const res = await GET()
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toMatch(/key|url|http/i)
  })
  it('is never cached, so a monitor sees the truth', async () => {
    expect((await GET()).headers.get('cache-control')).toContain('no-store')
  })
})
