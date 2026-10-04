import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])], { type: 'image/jpeg' })
const blob = (type: string) => new Blob([new Uint8Array([1, 2, 3])], { type })

describe('imports bucket: scan pages', () => {
  it('a student can upload page photos to their own folder, and delete them', async () => {
    const u = await newUser()
    const path = `${u.id}/${crypto.randomUUID()}-scan-1.jpg`
    expect((await u.sb.storage.from('imports').upload(path, jpeg(), { contentType: 'image/jpeg' })).error).toBeNull()
    for (const type of ['image/png', 'image/webp']) {
      const res = await u.sb.storage.from('imports').upload(`${u.id}/${crypto.randomUUID()}-scan.img`, blob(type), { contentType: type })
      expect(res.error, type).toBeNull()
    }
    expect((await u.sb.storage.from('imports').remove([path])).error).toBeNull()
  })
  it('a student can\'t read or delete another student\'s scan pages', async () => {
    const owner = await newUser(), other = await newUser()
    const path = `${owner.id}/${crypto.randomUUID()}-scan-1.jpg`
    expect((await owner.sb.storage.from('imports').upload(path, jpeg(), { contentType: 'image/jpeg' })).error).toBeNull()
    expect((await other.sb.storage.from('imports').download(path)).data).toBeNull()
    await other.sb.storage.from('imports').remove([path])
    expect((await owner.sb.storage.from('imports').download(path)).data).not.toBeNull() // still there
  })
  it('other image types and other students\' folders are refused', async () => {
    const u = await newUser(), other = await newUser()
    expect((await u.sb.storage.from('imports').upload(`${u.id}/a.gif`, blob('image/gif'), { contentType: 'image/gif' })).error).not.toBeNull()
    expect((await u.sb.storage.from('imports').upload(`${other.id}/a.jpg`, jpeg(), { contentType: 'image/jpeg' })).error).not.toBeNull()
  })
})
