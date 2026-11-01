// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { figureRedrawer } from '@/lib/import/figureRedraw'
import { placeFigures, type PagePictures } from '@/lib/import/placeFigures'

const drawing = { svg: '<svg/>', width: 100, height: 50 }
const blob = () => new Blob(['x'], { type: 'image/png' })

describe('figureRedrawer', () => {
  it('sends figures asked for together in one request, in order, up to six at a time', async () => {
    const post = vi.fn(async (figures: { caption: string }[]) => figures.map(() => drawing))
    const redraw = figureRedrawer({ post })
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => redraw(blob(), `fig ${i}`)))
    expect(results.every(r => r === drawing)).toBe(true)
    expect(post.mock.calls.map(c => c[0].length)).toEqual([6, 2])
    expect(post.mock.calls[0][0][0].caption).toBe('fig 0')
  })
  it('gives null for a figure the server could not redraw, and stops asking after a failed request', async () => {
    const post = vi.fn()
    post.mockResolvedValueOnce([null]).mockRejectedValueOnce(new Error('limit'))
    const redraw = figureRedrawer({ post })
    expect(await redraw(blob(), 'a')).toBeNull() // a photograph
    expect(await redraw(blob(), 'b')).toBeNull() // the request failed
    expect(await redraw(blob(), 'c')).toBeNull() // not asked again
    expect(post).toHaveBeenCalledTimes(2)
  })
  it('says the AI was used once a request is answered', async () => {
    const onUsed = vi.fn()
    await figureRedrawer({ post: async f => f.map(() => drawing), onUsed })(blob(), 'a')
    expect(onUsed).toHaveBeenCalledTimes(1)
  })
})

describe('placeFigures cuts the figures out together', () => {
  it('starts every figure of a few before waiting for any, and keeps them in order in the note', async () => {
    let running = 0, most = 0
    const source: PagePictures = {
      pictures: async () => [], snapshot: async () => null,
      crop: async (_p, _b, caption) => { running++; most = Math.max(most, running); await new Promise(r => setTimeout(r, 5)); running--; return `![${caption}](img-${caption})` },
    }
    const md = ['<!-- page 1 -->', '[[figure: one | 5, 5, 50, 50]]', 'text', '[[figure: two | 5, 55, 50, 95]]'].join('\n')
    const out = await placeFigures(md, source)
    expect(most).toBe(2)
    expect(out.indexOf('![one]')).toBeLessThan(out.indexOf('text'))
    expect(out.indexOf('text')).toBeLessThan(out.indexOf('![two]'))
  })
})
