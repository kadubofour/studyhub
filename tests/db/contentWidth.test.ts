import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

describe('profile content width', () => {
  it('starts wide, and can be set to focused, wide or full', async () => {
    const u = await newUser()
    const { data } = await u.sb.from('profiles').select('content_width').eq('id', u.id).single()
    expect(data).toEqual({ content_width: 'wide' })
    for (const w of ['focused', 'full', 'wide']) {
      const r = await u.sb.from('profiles').update({ content_width: w }).eq('id', u.id)
      expect(r.error, w).toBeNull()
    }
  })
  it('refuses any other value', async () => {
    const u = await newUser()
    for (const bad of ['huge', '', 'FULL']) {
      expect((await u.sb.from('profiles').update({ content_width: bad }).eq('id', u.id)).error, bad).not.toBeNull()
    }
  })
})
