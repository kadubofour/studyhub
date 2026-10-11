import { describe, it, expect, afterEach } from 'vitest'
import { GET as search } from '@/app/api/test-youtube/v3/search/route'
import { GET as videos } from '@/app/api/test-youtube/v3/videos/route'

afterEach(() => { delete process.env.E2E_FAKE_AI })

describe('fake YouTube (E2E only)', () => {
  it('does not exist unless E2E mode is on', async () => {
    expect((await search()).status).toBe(404)
    expect((await videos()).status).toBe(404)
  })
  it('answers a search and its details in the YouTube shape', async () => {
    process.env.E2E_FAKE_AI = '1'
    const s = await (await search()).json() as { items: { id: { videoId: string } }[] }
    const v = await (await videos()).json() as { items: { id: string; contentDetails: { duration: string } }[] }
    expect(s.items.map(i => i.id.videoId)).toEqual(v.items.map(i => i.id))
  })
})
