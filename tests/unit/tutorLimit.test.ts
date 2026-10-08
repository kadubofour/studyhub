import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc }) }))
import { reserveTutorMessage, releaseTutorMessage } from '@/lib/ai/tutorLimit'

beforeEach(() => rpc.mockReset())
describe('tutor message reservation', () => {
  it('asks the database to reserve one message for the student', async () => {
    rpc.mockResolvedValue({ data: 'ok', error: null })
    expect(await reserveTutorMessage('u1')).toBe('ok')
    expect(rpc).toHaveBeenCalledWith('tutor_check', { p_user: 'u1' })
  })
  it('passes the limit codes through', async () => {
    rpc.mockResolvedValue({ data: 'tutor_limit', error: null })
    expect(await reserveTutorMessage('u1')).toBe('tutor_limit')
  })
  it('a database error is ai_failed, not an accepted message', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await reserveTutorMessage('u1')).toBe('ai_failed')
  })
  it('gives a message back', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await releaseTutorMessage('u1')
    expect(rpc).toHaveBeenCalledWith('tutor_release', { p_user: 'u1' })
  })
})
