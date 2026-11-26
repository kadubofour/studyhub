import { describe, it, expect, vi, beforeEach } from 'vitest'

const CHAT = '11111111-1111-4111-8111-111111111111'
let user: { id: string } | null
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
import { POST } from '@/app/api/ai/tutor/stop/route'
import { startRun, stopRun } from '@/lib/ai/tutorRuns'

const call = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
beforeEach(() => { user = { id: 'u1' } })

describe('POST /api/ai/tutor/stop', () => {
  it('ends the reply being written for the student\'s chat', async () => {
    const run = startRun('u1', CHAT)
    expect(run.signal.aborted).toBe(false)
    expect(await (await call({ chatId: CHAT })).json()).toEqual({ stopped: true })
    expect(run.signal.aborted).toBe(true)
    run.end()
  })
  it('says so when there was nothing to stop, and never ends someone else\'s reply', async () => {
    expect(await (await call({ chatId: CHAT })).json()).toEqual({ stopped: false })
    const theirs = startRun('u2', CHAT)
    expect(await (await call({ chatId: CHAT })).json()).toEqual({ stopped: false })
    expect(theirs.signal.aborted).toBe(false)
    theirs.end()
  })
  it('forgets a reply that has finished', () => {
    const run = startRun('u1', CHAT)
    run.end()
    expect(stopRun('u1', CHAT)).toBe(false)
  })
  it('needs a signed-in student and a real chat id', async () => {
    expect((await call({ chatId: 'nope' })).status).toBe(400)
    user = null
    expect((await call({ chatId: CHAT })).status).toBe(401)
  })
})
