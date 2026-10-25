import { describe, it, expect, vi, beforeEach } from 'vitest'

const T = 'a'.repeat(64)
let user: { id: string } | null
let copyResult: { data: unknown; error: { message: string } | null }
let files: { owner_id: string; file: string }[]
let existing: Set<string>
const callerRpc = vi.fn()
const adminRpc = vi.fn()
const copied: string[] = []
const signed: string[] = []

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async (fn: string, args: unknown) => { callerRpc(fn, args); return copyResult },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  adminClient: () => ({
    rpc: async (fn: string, args: unknown) => { adminRpc(fn, args); return { data: files, error: null } },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, seconds: number) => {
          signed.push(`${bucket}:${path}:${seconds}`)
          return existing.has(path) ? { data: { signedUrl: `https://store.test/${path}?sig=1` }, error: null } : { data: null, error: { message: 'Object not found' } }
        },
        copy: async (from: string, to: string) => {
          if (!existing.has(from)) return { data: null, error: { message: 'Object not found' } }
          copied.push(`${bucket}:${from}->${to}`)
          return { data: { path: to }, error: null }
        },
      }),
    },
  }),
}))

import { GET } from '@/app/s/[token]/image/[file]/route'
import { POST } from '@/app/api/share/[token]/copy/route'

const image = (file: string, token = T) => GET(new Request(`http://x/s/${token}/image/${file}`), { params: Promise.resolve({ token, file }) })
const copy = (token = T) => POST(new Request(`http://x/api/share/${token}/copy`, { method: 'POST' }), { params: Promise.resolve({ token }) })

beforeEach(() => {
  user = { id: 'me' }
  copyResult = { data: [{ kind: 'note', id: 'new-note' }], error: null }
  files = [{ owner_id: 'owner', file: 'pic.webp' }]
  existing = new Set(['owner/pic.webp'])
  copied.length = 0; signed.length = 0
  callerRpc.mockClear(); adminRpc.mockClear()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
})

describe('GET /s/<token>/image/<file>', () => {
  it('sends a picture the shared note uses to a one-hour signed link', async () => {
    const res = await image('pic.webp')
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toBe('https://store.test/owner/pic.webp?sig=1')
    expect(adminRpc).toHaveBeenCalledWith('shared_note_files', { p_token: T })
    expect(signed).toEqual(['note-images:owner/pic.webp:3600'])
  })
  it('the image route refuses a file the shared note does not use', async () => {
    existing.add('owner/other.webp')
    const res = await image('other.webp')
    expect(res.status).toBe(404)
    expect(signed).toEqual([])
  })
  it('a file the note uses but that is gone is a 404 too, and so is a turned-off link', async () => {
    existing.clear()
    expect((await image('pic.webp')).status).toBe(404)
    files = []
    expect((await image('pic.webp')).status).toBe(404)
  })
  it('refuses a file name with a folder in it without asking the database', async () => {
    expect((await image('..%2Fsecret')).status).toBe(404)
    expect(adminRpc).not.toHaveBeenCalled()
  })
})

describe('POST /api/share/<token>/copy', () => {
  it('copies as the caller and copies the pictures into the caller\'s folder', async () => {
    const res = await copy()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ kind: 'note', id: 'new-note' })
    expect(callerRpc).toHaveBeenCalledWith('copy_shared', { p_token: T })
    expect(copied).toEqual(['note-images:owner/pic.webp->me/pic.webp'])
  })
  it('copy returns 410 link_off for a revoked token', async () => {
    copyResult = { data: null, error: { message: 'link_off' } }
    const res = await copy()
    expect(res.status).toBe(410)
    expect(await res.json()).toEqual({ error: 'link_off' })
    expect(copied).toEqual([])
  })
  it('copy skips a missing picture and still succeeds', async () => {
    files = [{ owner_id: 'owner', file: 'gone.webp' }, { owner_id: 'owner', file: 'pic.webp' }]
    const res = await copy()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ kind: 'note', id: 'new-note' })
    expect(copied).toEqual(['note-images:owner/pic.webp->me/pic.webp'])
  })
  it('does not copy pictures onto themselves when the owner copies their own note', async () => {
    user = { id: 'owner' }
    expect((await copy()).status).toBe(200)
    expect(copied).toEqual([])
  })
  it('a deck copy touches no pictures', async () => {
    copyResult = { data: [{ kind: 'deck', id: 'd2' }], error: null }
    expect(await (await copy()).json()).toEqual({ kind: 'deck', id: 'd2' })
    expect(adminRpc).not.toHaveBeenCalled()
  })
  it('says who must sign in, who is copying too fast and what cannot be copied', async () => {
    user = null
    expect((await copy()).status).toBe(401)
    expect(callerRpc).not.toHaveBeenCalled()
    user = { id: 'me' }
    copyResult = { data: null, error: { message: 'rate_limited' } }
    expect((await copy()).status).toBe(429)
    copyResult = { data: null, error: { message: 'not_copyable' } }
    expect((await copy()).status).toBe(400)
    copyResult = { data: null, error: { message: 'something else' } }
    expect((await copy()).status).toBe(500)
  })
})
