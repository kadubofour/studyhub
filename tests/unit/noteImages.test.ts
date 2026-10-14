import { describe, it, expect, vi } from 'vitest'
import { IMAGE_SCHEME, imageFilesIn, imagePath, isImageToken, makeImageResolver, stripImagesForAi, toToken, tokenFile } from '@/lib/notes/images'

describe('tokens', () => {
  it('names a stored picture inside a note, and reads the file name back', () => {
    expect(IMAGE_SCHEME).toBe('studyhub-image:')
    expect(toToken('abc.webp')).toBe('studyhub-image:abc.webp')
    expect(isImageToken('studyhub-image:abc.webp')).toBe(true)
    expect(isImageToken('https://x.test/a.png')).toBe(false)
    expect(isImageToken(undefined)).toBe(false)
    expect(tokenFile('studyhub-image:abc.webp')).toBe('abc.webp')
    expect(tokenFile('https://x.test/a.png')).toBeNull()
  })
  it('refuses a token that could point somewhere else', () => {
    expect(tokenFile('studyhub-image:../other/abc.png')).toBeNull()
    expect(tokenFile('studyhub-image:a/b.png')).toBeNull()
    expect(tokenFile('studyhub-image:')).toBeNull()
  })
  it('puts a file in the student\'s own folder', () => {
    expect(imagePath('u1', 'abc.webp')).toBe('u1/abc.webp')
  })
})

describe('imageFilesIn', () => {
  it('lists the pictures a note uses, once each', () => {
    const md = 'Hello\n\n![Krebs](studyhub-image:a.webp)\n\ntext ![](studyhub-image:b.png) and ![again](studyhub-image:a.webp) and ![web](https://x.test/c.png)'
    expect(imageFilesIn(md)).toEqual(['a.webp', 'b.png'])
  })
  it('is empty for a note with no pictures', () => { expect(imageFilesIn('just words')).toEqual([]) })
})

describe('stripImagesForAi', () => {
  it('leaves only the description of each picture, so pictures never reach the AI', () => {
    expect(stripImagesForAi('Intro\n\n![The Krebs cycle](studyhub-image:a.webp)\n\nEnd')).toBe('Intro\n\nThe Krebs cycle\n\nEnd')
  })
  it('drops a picture with no description', () => {
    expect(stripImagesForAi('A ![](studyhub-image:a.webp) B')).toBe('A  B')
  })
  it('leaves web pictures and ordinary text alone', () => {
    expect(stripImagesForAi('![web](https://x.test/c.png) and [a link](https://x.test)')).toBe('![web](https://x.test/c.png) and [a link](https://x.test)')
  })
})

describe('makeImageResolver', () => {
  const sbWith = (impl: (path: string, secs: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }>) => {
    const createSignedUrl = vi.fn(impl)
    return { sb: { storage: { from: (b: string) => (b === 'note-images' ? { createSignedUrl } : (() => { throw new Error('wrong bucket') })()) } } as never, createSignedUrl }
  }
  it('turns a token into a signed link for the student\'s own file', async () => {
    const { sb, createSignedUrl } = sbWith(async p => ({ data: { signedUrl: `https://s.test/${p}?t=1` }, error: null }))
    const resolve = makeImageResolver(sb, 'u1')
    expect(await resolve('studyhub-image:a.webp')).toBe('https://s.test/u1/a.webp?t=1')
    expect(createSignedUrl).toHaveBeenCalledWith('u1/a.webp', 3600)
  })
  it('keeps the link for a while, and asks once when several ask together', async () => {
    const { sb, createSignedUrl } = sbWith(async p => ({ data: { signedUrl: `https://s.test/${p}` }, error: null }))
    let now = 0
    const resolve = makeImageResolver(sb, 'u1', () => now)
    await Promise.all([resolve('studyhub-image:a.webp'), resolve('studyhub-image:a.webp')])
    now = 49 * 60_000
    await resolve('studyhub-image:a.webp')
    expect(createSignedUrl).toHaveBeenCalledTimes(1)
    now = 51 * 60_000 // a link kept for 50 minutes is asked for again
    await resolve('studyhub-image:a.webp')
    expect(createSignedUrl).toHaveBeenCalledTimes(2)
  })
  it('gives web addresses back as they are, without asking', async () => {
    const { sb, createSignedUrl } = sbWith(async () => ({ data: null, error: null }))
    expect(await makeImageResolver(sb, 'u1')('https://x.test/a.png')).toBe('https://x.test/a.png')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
  it('gives nothing when the file cannot be reached, and tries again next time', async () => {
    let fail = true
    const { sb, createSignedUrl } = sbWith(async p => (fail ? { data: null, error: { message: 'offline' } } : { data: { signedUrl: `https://s.test/${p}` }, error: null }))
    const resolve = makeImageResolver(sb, 'u1')
    expect(await resolve('studyhub-image:a.webp')).toBeNull()
    fail = false
    expect(await resolve('studyhub-image:a.webp')).toBe('https://s.test/u1/a.webp')
    expect(createSignedUrl).toHaveBeenCalledTimes(2)
  })
  it('does not ask for a token that is not a file in the student\'s folder', async () => {
    const { sb, createSignedUrl } = sbWith(async () => ({ data: { signedUrl: 'x' }, error: null }))
    expect(await makeImageResolver(sb, 'u1')('studyhub-image:../u2/a.png')).toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
