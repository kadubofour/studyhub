import { describe, it, expect, vi } from 'vitest'
import { ImageError, MAX_BYTES, MAX_SIDE, fitWithin, prepareImage, removeNoteImages, uploadNoteImage, type ImageIo } from '@/lib/notes/prepareImage'

const blob = (type: string, size = 100) => new Blob([new Uint8Array(size)], { type })

describe('fitWithin', () => {
  it('shrinks the long side to the limit and keeps the shape', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
    expect(fitWithin(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 })
  })
  it('never makes a small picture bigger', () => { expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 }) })
  it('never goes below one pixel', () => { expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 }) })
})

describe('prepareImage', () => {
  const io = (over: Partial<ImageIo> = {}): ImageIo => ({
    decode: vi.fn(async () => ({ width: 3200, height: 1600, source: {} })),
    encode: vi.fn(async (_s, _w, _h, type) => blob(type, 2000)),
    ...over,
  })
  it('accepts PNG, JPEG and WebP only, with a message that says so', async () => {
    for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain', '']) {
      await expect(prepareImage(blob(type), io())).rejects.toMatchObject({ code: 'type' })
    }
    await expect(prepareImage(blob('image/gif'), io())).rejects.toBeInstanceOf(ImageError)
  })
  it('shrinks a big picture and saves it as WebP', async () => {
    const i = io()
    const out = await prepareImage(blob('image/png', 4_000_000), i)
    expect(i.encode).toHaveBeenCalledWith({}, MAX_SIDE, 800, 'image/webp', 0.85)
    expect(out.type).toBe('image/webp')
  })
  it('keeps a small picture\'s size but still saves it as WebP, which is smaller', async () => {
    const i = io({ decode: vi.fn(async () => ({ width: 800, height: 600, source: {} })) })
    await prepareImage(blob('image/jpeg', 300_000), i)
    expect(i.encode).toHaveBeenCalledWith({}, 800, 600, 'image/webp', 0.85)
  })
  it('keeps the original when it cannot be re-saved and is already small enough', async () => {
    const original = blob('image/png', 1000)
    const out = await prepareImage(original, io({ encode: vi.fn(async () => null) }))
    expect(out).toBe(original)
  })
  it('says the picture is too big when it cannot be made small enough', async () => {
    await expect(prepareImage(blob('image/png', MAX_BYTES + 1), io({ encode: vi.fn(async () => null) }))).rejects.toMatchObject({ code: 'big' })
    await expect(prepareImage(blob('image/png', 100), io({ encode: vi.fn(async () => blob('image/webp', MAX_BYTES + 1)) }))).rejects.toMatchObject({ code: 'big' })
  })
  it('says the picture could not be read when it cannot be opened', async () => {
    await expect(prepareImage(blob('image/png'), io({ decode: vi.fn(async () => { throw new Error('bad') }) }))).rejects.toMatchObject({ code: 'unreadable' })
  })
})

describe('uploadNoteImage', () => {
  const sbWith = (upload: (path: string, b: Blob, o: { contentType: string }) => Promise<{ error: unknown }>) => {
    const spy = vi.fn(upload)
    return { sb: { storage: { from: (b: string) => (b === 'note-images' ? { upload: spy, remove: vi.fn(async () => ({ error: null })) } : (() => { throw new Error('wrong bucket') })()) } } as never, spy }
  }
  it('stores it in the student\'s folder under a new name and gives back the token', async () => {
    const { sb, spy } = sbWith(async () => ({ error: null }))
    const token = await uploadNoteImage(sb, 'u1', blob('image/webp'))
    expect(token).toMatch(/^studyhub-image:[0-9a-f-]{36}\.webp$/)
    const [path, , opts] = spy.mock.calls[0]
    expect(path).toBe(`u1/${token.slice('studyhub-image:'.length)}`)
    expect(opts).toEqual({ contentType: 'image/webp' })
  })
  it('uses the right ending for each type', async () => {
    const { sb } = sbWith(async () => ({ error: null }))
    expect(await uploadNoteImage(sb, 'u1', blob('image/png'))).toMatch(/\.png$/)
    expect(await uploadNoteImage(sb, 'u1', blob('image/jpeg'))).toMatch(/\.jpg$/)
  })
  it('throws when the upload fails', async () => {
    const { sb } = sbWith(async () => ({ error: { message: 'offline' } }))
    await expect(uploadNoteImage(sb, 'u1', blob('image/webp'))).rejects.toBeTruthy()
  })
})

describe('removeNoteImages', () => {
  it('removes the named files from the student\'s folder, and does nothing for none', async () => {
    const remove = vi.fn(async () => ({ error: null }))
    const sb = { storage: { from: () => ({ remove }) } } as never
    await removeNoteImages(sb, 'u1', ['a.webp', 'b.png'])
    expect(remove).toHaveBeenCalledWith(['u1/a.webp', 'u1/b.png'])
    remove.mockClear()
    await removeNoteImages(sb, 'u1', [])
    expect(remove).not.toHaveBeenCalled()
  })
})
