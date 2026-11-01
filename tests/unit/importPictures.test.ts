import { describe, it, expect, vi } from 'vitest'
import { MAX_PICTURES, mediaType, pictureKeeper } from '@/lib/import/pictures'

// A stand-in for the browser: each picture's size is written in it as "WxH"
const io = {
  size: async (b: Blob) => { const [w, h] = (await b.text()).match(/^(\d+)x(\d+)/)!.slice(1).map(Number); return { width: w, height: h } },
  redraw: async (b: Blob) => new Blob([await b.text()], { type: 'image/png' }),
  decode: async (b: Blob) => ({ width: 100, height: 100, source: b }),
  encode: async (_s: unknown, _w: number, _h: number, type: string) => new Blob(['out'], { type }),
}
function storage() {
  const upload = vi.fn(async (..._a: unknown[]) => ({ error: null }))
  return { sb: { storage: { from: () => ({ upload }) } } as never, upload }
}
const pic = (w: number, h: number, type = 'image/png', tag = '') => new Blob([`${w}x${h}${tag}`], { type })

describe('keeping an uploaded file\'s pictures', () => {
  it('stores a picture in the student\'s folder and gives back the note\'s Markdown for it', async () => {
    const { sb, upload } = storage()
    const md = await pictureKeeper(sb, 'u1', io)(pic(800, 600), 'The Krebs cycle')
    expect(md).toMatch(/^!\[The Krebs cycle\]\(studyhub-image:[0-9a-f-]+\.webp\)$/)
    expect(upload.mock.calls[0][0]).toMatch(/^u1\/[0-9a-f-]+\.webp$/)
  })
  it('leaves out decoration: a bullet, an icon or a rule', async () => {
    const { sb, upload } = storage()
    const keep = pictureKeeper(sb, 'u1', io)
    expect(await keep(pic(16, 16), '')).toBeNull()
    expect(await keep(pic(900, 4), '')).toBeNull()
    expect(upload).not.toHaveBeenCalled()
  })
  it('stores the same picture once, however often it appears', async () => {
    const { sb, upload } = storage()
    const keep = pictureKeeper(sb, 'u1', io)
    const a = await keep(pic(300, 200, 'image/png', 'figure'), 'Figure 2')
    const b = await keep(pic(300, 200, 'image/png', 'figure'), 'Figure 2')
    expect(a).toBe(b)
    expect(upload).toHaveBeenCalledTimes(1)
  })
  it('keeps only visual aids: a picture described as a logo, a background or the like is left out, whatever its size', async () => {
    const { sb, upload } = storage()
    const keep = pictureKeeper(sb, 'u1', io)
    for (const alt of ['University logo', 'Slide background', 'Decorative swirl', 'Company watermark', 'Lecturer signature', 'Header image', 'Clip art of a book']) expect(await keep(pic(600, 400, 'image/png', alt), alt), alt).toBeNull()
    expect(await keep(pic(600, 400, 'image/png', 'ok'), 'Graph of rate against temperature')).not.toBeNull()
    expect(await keep(pic(600, 401, 'image/png', 'plain'), '')).not.toBeNull() // no description: judged by its shape alone
    expect(upload).toHaveBeenCalledTimes(2)
  })
  it('leaves out a banner or a rule, and a picture too small to read, but keeps one just big enough', async () => {
    const { sb } = storage()
    const keep = pictureKeeper(sb, 'u1', io)
    expect(await keep(pic(900, 120), '')).toBeNull() // 7.5 times longer than tall
    expect(await keep(pic(79, 200), '')).toBeNull()
    expect(await keep(pic(200, 79), '')).toBeNull()
    expect(await keep(pic(500, 100), '')).not.toBeNull() // exactly 5 to 1
    expect(await keep(pic(80, 80), '')).not.toBeNull()
  })
  it('lets a figure drawn from the file be long and thin (a timeline), as long as it is big enough, but not described as decoration', async () => {
    const { sb } = storage()
    const keep = pictureKeeper(sb, 'u1', io)
    expect(await keep(pic(1200, 150, 'image/png', 'timeline'), 'Timeline of the war', true)).not.toBeNull()
    expect(await keep(pic(1200, 150, 'image/png', 'bar'), 'Decorative bar', true)).toBeNull()
    expect(await keep(pic(1200, 40, 'image/png', 'strip'), 'Strip', true)).toBeNull()
  })
  it('redraws a type a note cannot hold (GIF, TIFF…) as PNG', async () => {
    const { sb, upload } = storage()
    expect(await pictureKeeper(sb, 'u1', io)(pic(200, 200, 'image/gif'), 'Animation')).not.toBeNull()
    expect(upload).toHaveBeenCalledTimes(1)
  })
  it('keeps at most MAX_PICTURES from one file', async () => {
    const { sb, upload } = storage()
    const keep = pictureKeeper(sb, 'u1', io)
    const kept = await Promise.all(Array.from({ length: MAX_PICTURES + 5 }, (_, i) => keep(pic(200, 200, 'image/png', `#${i}`), '')))
    expect(kept.filter(Boolean)).toHaveLength(MAX_PICTURES)
    expect(upload).toHaveBeenCalledTimes(MAX_PICTURES)
  })
  it('leaves a picture out, rather than failing the import, when it cannot be stored', async () => {
    const sb = { storage: { from: () => ({ upload: async () => ({ error: new Error('offline') }) }) } } as never
    expect(await pictureKeeper(sb, 'u1', io)(pic(200, 200), '')).toBeNull()
  })
  it('names an Office file\'s picture types', () => {
    expect(mediaType('../media/image1.JPEG')).toBe('image/jpeg')
    expect(mediaType('image2.emf')).toBe('image/emf')
  })
})

describe('diagram pictures', () => {
  it('are told apart by their file name, so dark mode can light their lines', async () => {
    const { isDiagramToken } = await import('@/lib/notes/images')
    expect(isDiagramToken('studyhub-image:fig-abc123.webp')).toBe(true)
    expect(isDiagramToken('studyhub-image:abc123.webp')).toBe(false)
    expect(isDiagramToken('https://x.test/fig-1.png')).toBe(false)
  })
})

describe('older pictures that look like diagrams', () => {
  const px = (n: number, f: (i: number) => [number, number, number]) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { const [r, g, b] = f(i); a.set([r, g, b, 255], i * 4) } return a }
  it('black lines on white paper count; a photo does not', async () => {
    const { looksLikeDiagram } = await import('@/lib/notes/diagramLook')
    expect(looksLikeDiagram(px(4096, i => (i % 20 === 0 ? [0, 0, 0] : [255, 255, 255])))).toBe(true)
    expect(looksLikeDiagram(px(4096, i => [(i * 7) % 256, (i * 13) % 256, (i * 29) % 256]))).toBe(false)
    expect(looksLikeDiagram(px(4096, () => [90, 120, 60]))).toBe(false)
  })
})
