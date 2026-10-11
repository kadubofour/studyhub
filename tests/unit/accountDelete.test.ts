import { describe, it, expect, vi, beforeEach } from 'vitest'

const steps: string[] = []
let user: { id: string } | null
let ent: { subscription_code: string | null; email_token: string | null } | null
let disableFails = false
let removeFails = false
let deleteFails = false
// Files per bucket: a folder is an entry with no id (as in Supabase storage)
let tree: Record<string, Record<string, { name: string; id: string | null }[]>>
const removed: string[] = []
const disableSubscription = vi.fn(async (..._a: unknown[]) => { steps.push('paystack'); if (disableFails) throw new Error('paystack down') })
const signOut = vi.fn(async () => { steps.push('signout') })
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }), signOut } }) }))
vi.mock('@/lib/billing/paystack', () => ({ disableSubscription: (...a: unknown[]) => disableSubscription(...a) }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ent }) }) }) }),
  storage: { from: (bucket: string) => ({
    list: async (prefix: string) => ({ data: tree[bucket]?.[prefix] ?? [], error: null }),
    remove: async (paths: string[]) => { steps.push(`remove ${bucket}`); if (removeFails) return { error: { message: 'x' } }; removed.push(...paths.map(p => `${bucket}:${p}`)); return { error: null } },
  }) },
  auth: { admin: { deleteUser: async (id: string) => { steps.push(`delete ${id}`); return { error: deleteFails ? { message: 'x' } : null } } } },
}) }))
import { POST } from '@/app/api/account/delete/route'

const call = (body: unknown = { confirm: 'DELETE' }) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
beforeEach(() => {
  steps.length = 0; removed.length = 0; user = { id: 'u1' }; ent = null; disableFails = removeFails = deleteFails = false
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
    ent = { subscription_code: 'SUB_1', email_token: 'tok' }
    tree = { imports: { u1: [{ name: 'a.pdf', id: 'f1' }] }, lectures: { u1: [{ name: 'lec1', id: null }], 'u1/lec1': [{ name: 'part0.webm', id: 'f2' }, { name: 'part1.webm', id: 'f3' }] } }
    const res = await call()
    expect(res.status).toBe(200)
    expect(disableSubscription).toHaveBeenCalledWith('SUB_1', 'tok')
    expect(steps).toEqual(['paystack', 'remove imports', 'remove lectures', 'delete u1', 'signout'])
    expect(removed).toEqual(['imports:u1/a.pdf', 'lectures:u1/lec1/part0.webm', 'lectures:u1/lec1/part1.webm'])
  })
  it('does not touch Paystack when there is no subscription', async () => {
    await call()
    expect(disableSubscription).not.toHaveBeenCalled()
    expect(steps).toEqual(['delete u1', 'signout'])
  })
  it('stops, and deletes nothing, if renewal cannot be turned off', async () => {
    ent = { subscription_code: 'SUB_1', email_token: 'tok' }
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
  it('removes a long folder of files in batches', async () => {
    tree = { lectures: { u1: Array.from({ length: 250 }, (_, i) => ({ name: `p${i}.webm`, id: `f${i}` })) } }
    await call()
    expect(removed).toHaveLength(250)
  })
})
