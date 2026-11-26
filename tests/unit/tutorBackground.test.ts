import { describe, it, expect, vi, afterEach } from 'vitest'
import { awaitingReply, REPLY_WAIT_MS, stopTutorReply } from '@/lib/tutor/background'

const NOW = Date.parse('2026-11-26T10:00:00Z')
const at = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString()

describe('awaitingReply', () => {
  it('is true for a question asked a moment ago that has no reply yet', () => {
    expect(awaitingReply({ role: 'user', created_at: at(20) }, NOW)).toBe(true)
  })
  it('is false once the last message is the tutor\'s, or the question is too old for a reply still to be coming', () => {
    expect(awaitingReply({ role: 'assistant', created_at: at(5) }, NOW)).toBe(false)
    expect(awaitingReply({ role: 'user', created_at: at(REPLY_WAIT_MS / 1000 + 5) }, NOW)).toBe(false)
  })
  it('is false for an empty chat, and for a message that is not saved yet', () => {
    expect(awaitingReply(undefined, NOW)).toBe(false)
    expect(awaitingReply({ role: 'user', created_at: '' }, NOW)).toBe(false)
  })
})

describe('stopTutorReply', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('asks the server to stop this chat\'s reply, in a request that survives the page going', () => {
    const fetchMock = vi.fn(async () => ({}))
    vi.stubGlobal('fetch', fetchMock)
    stopTutorReply('chat1')
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/tutor/stop', expect.objectContaining({ method: 'POST', keepalive: true, body: JSON.stringify({ chatId: 'chat1' }) }))
  })
})
