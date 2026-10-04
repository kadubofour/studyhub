import { describe, it, expect, vi } from 'vitest'
import { audioUsed, partUrls } from '@/lib/data/lectures'

describe('partUrls', () => {
  it('signs playback links for a day, so a long listening session doesn\'t lose the later parts', async () => {
    const createSignedUrls = vi.fn(async () => ({ data: [{ signedUrl: 'https://x/0' }, { signedUrl: 'https://x/1' }], error: null }))
    const sb = { storage: { from: () => ({ createSignedUrls }) } } as never
    const parts = [0, 1].map(i => ({ path: `u1/L-${i}.webm`, start: i * 1200, duration: 1200, bytes: 1, transcribed: false }))
    expect(await partUrls(sb, parts)).toEqual(['https://x/0', 'https://x/1'])
    expect(createSignedUrls).toHaveBeenCalledWith(['u1/L-0.webm', 'u1/L-1.webm'], 86400)
  })
})

describe('audioUsed', () => {
  it('is counted on the server from the real audio files', async () => {
    const rpc = vi.fn(async () => ({ data: 1500, error: null }))
    expect(await audioUsed({ rpc } as never)).toBe(1500)
    expect(rpc).toHaveBeenCalledWith('lecture_audio_bytes')
  })
})
