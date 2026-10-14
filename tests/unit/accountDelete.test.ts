import { describe, it, expect, vi, beforeEach } from 'vitest'

const steps: string[] = []
let user: { id: string } | null
let ent: { subscription_code: string | null; email_token: string | null; auto_renew: boolean } | null
let entError = false
let disableFails = false
let removeFails = false
let deleteFails = false
// Files per bucket, listed the way Supabase storage does: at most `limit` entries, from `offset`
let tree: Record<string, Record<string, { name: string; id: string | null }[]>>
const removed: string[] = []
const disableSubscription = vi.fn(async (..._a: unknown[]) => { steps.push('paystack'); if (disableFails) throw new Error('paystack down') })
const signOut = vi.fn(async () => { steps.push('signout') })
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }), signOut } }) }))
vi.mock('@/lib/billing/paystack', () => ({ disableSubscription: (...a: unknown[]) => disableSubscription(...a) }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ent, error: entError ? { message: 'x' } : null }) }) }) }),
  rpc: async (...a: unknown[]) => { steps.push(`rpc ${a[0]} ${JSON.stringify(a[1])}`); return { error: null } },
  storage: { from: (bucket: string) => ({
    list: async (prefix: string, o?: { limit?: number; offset?: number }) => {
      const gone = new Set(removed.filter(r => r.startsWith(`${bucket}:`)).map(r => r.slice(bucket.length + 1)))
      const all = (tree[bucket]?.[prefix] ?? []).filter(e => !gone.has(`${prefix}/${e.name}`))
      const offset = o?.offset ?? 0
      return { data: all.slice(offset, offset + (o?.limit ?? 100)), error: null }
    },
    remove: async (paths: string[]) => { steps.push(`remove ${bucket}`); if (removeFails) return { error: { message: 'x' } }; removed.push(...paths.map(p => `${bucket}:${p}`)); return { error: null } },
  }) },
  auth: { admin: { deleteUser: async (id: string) => { steps.push(`delete ${id}`); return { error: deleteFails ? { message: 'x' } : null } } } },
}) }))
import { POST } from '@/app/api/account/delete/route'

const call = (body: unknown = { confirm: 'DELETE' }, headers: Record<string, string> = {}) =>
  POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }))
beforeEach(() => {
  steps.length = 0; removed.length = 0; user = { id: 'u1' }; ent = null; entError = false; disableFails = removeFails = deleteFails = false
  tree = {}; disableSubscription.mockClear(); signOut.mockClear()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
})

describe('POST /api/account/delete', () => {
  it('needs the student to be signed in, and to have typed the word', async () => {
    user = null
    expect((await call()).status).toBe(401)
    user = { id: 'u1' }
    for (const body of [{}, { confirm: 'delete' }, { confirm: 'yes' }, null]) expect((await call(body)).status, JSON.stringify(body)).toBe(400)
    expect(steps).toEqual([])
  })
  it('turns off renewal, removes files, deletes the sign-in, then signs out, in that order', async () => {
    ent = { subscription_code: 'SUB_1', email_token: 'tok', auto_renew: true }
    tree = { imports: { u1: [{ name: 'a.pdf', id: 'f1' }] }, lectures: { u1: [{ name: 'lec1-0.webm', id: 'f2' }, { name: 'lec1-1.webm', id: 'f3' }] }, 'note-images': { u1: [{ name: 'p1.webp', id: 'f4' }] } }
    const res = await call()
    expect(res.status).toBe(200)
    expect(disableSubscription).toHaveBeenCalledWith('SUB_1', 'tok')
    expect(steps).toEqual(['paystack', 'rpc set_subscription {"p_user":"u1","p_subscription_code":null,"p_email_token":null,"p_auto_renew":false}', 'remove imports', 'remove lectures', 'remove note-images', 'delete u1', 'signout'])
    expect(removed).toEqual(['imports:u1/a.pdf', 'lectures:u1/lec1-0.webm', 'lectures:u1/lec1-1.webm', 'note-images:u1/p1.webp'])
  })
  it('does not touch Paystack when there is no subscription', async () => {
    await call()
    expect(disableSubscription).not.toHaveBeenCalled()
    expect(steps).toEqual(['delete u1', 'signout'])
  })
  it('does not ask Paystack again for a subscription whose renewal is already off', async () => {
    ent = { subscription_code: 'SUB_1', email_token: 'tok', auto_renew: false } // set_subscription keeps the old codes
    const res = await call()
    expect(res.status).toBe(200)
    expect(disableSubscription).not.toHaveBeenCalled()
    expect(steps).toEqual(['delete u1', 'signout'])
  })
  it('stops, and deletes nothing, when the plan cannot be read, so nobody keeps paying for a gone account', async () => {
    entError = true
    expect((await call()).status).toBe(502)
    expect(steps).toEqual([])
  })
  it('stops, and deletes nothing, if renewal cannot be turned off', async () => {
    ent = { subscription_code: 'SUB_1', email_token: 'tok', auto_renew: true }
    disableFails = true
    const res = await call()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('delete_failed')
    expect(steps).toEqual(['paystack'])
  })
  it('stops before deleting the sign-in if files cannot be removed', async () => {
    tree = { imports: { u1: [{ name: 'a.pdf', id: 'f1' }] } }
    removeFails = true
    const res = await call()
    expect(res.status).toBe(502)
    expect(steps).not.toContain('delete u1')
    expect(signOut).not.toHaveBeenCalled()
  })
  it('keeps the student signed in if the sign-in cannot be deleted, so they can try again', async () => {
    deleteFails = true
    const res = await call()
    expect(res.status).toBe(502)
    expect(signOut).not.toHaveBeenCalled()
  })
  it('says it is unavailable when the server has no service key', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect((await call()).status).toBe(503)
    expect(steps).toEqual([])
  })
  it('removes every file even when a folder holds more than one page of them', async () => {
    tree = { lectures: { u1: Array.from({ length: 2500 }, (_, i) => ({ name: `p${i}.webm`, id: `f${i}` })) } }
    expect((await call()).status).toBe(200)
    expect(removed).toHaveLength(2500)
    expect(new Set(removed).size).toBe(2500)
  })
  it('refuses a request that is not JSON or does not come from this site', async () => {
    expect((await call({ confirm: 'DELETE' }, { 'Content-Type': 'text/plain' })).status).toBe(415)
    expect((await call({ confirm: 'DELETE' }, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403)
    expect((await call({ confirm: 'DELETE' }, { 'Sec-Fetch-Site': 'same-site' })).status).toBe(403)
    expect(steps).toEqual([])
    expect((await call({ confirm: 'DELETE' }, { 'Sec-Fetch-Site': 'same-origin' })).status).toBe(200)
  })
})
