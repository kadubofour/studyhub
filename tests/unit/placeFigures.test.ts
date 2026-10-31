import { describe, it, expect, vi } from 'vitest'
import { parseBox, placeFigures, textWithPictures, type PagePictures } from '@/lib/import/placeFigures'

const pics = (byPage: Record<number, string[]>) => async (page: number) => [...(byPage[page] ?? [])]
const source = (over: Partial<PagePictures> = {}): PagePictures => ({ pictures: pics({}), crop: async () => null, snapshot: async () => null, ...over })

describe('a figure\'s box on its page', () => {
  it('reads four numbers as percentages of the page, in either corner order', () => {
    expect(parseBox('10, 20, 90, 60')).toEqual({ x0: 10, y0: 20, x1: 90, y1: 60 })
    expect(parseBox('90 60 10 20')).toEqual({ x0: 10, y0: 20, x1: 90, y1: 60 })
  })
  it('keeps a box that runs past the page on the page', () => {
    expect(parseBox('-5,0,120,100')).toEqual({ x0: 0, y0: 0, x1: 100, y1: 100 })
  })
  it('is null for anything that is not a box worth cutting out', () => {
    for (const bad of [undefined, '', '1,2,3', '10,10,12,12', 'a,b,c,d', '10,10,90,11']) expect(parseBox(bad), String(bad)).toBeNull()
  })
})

describe('putting a PDF\'s figures where they were', () => {
  it('cuts a figure out of its page by its box, however it was drawn, and takes the mark out', async () => {
    const crop = vi.fn(async (_p: number, _b: unknown, caption: string) => `![${caption}](studyhub-image:fig.webp)`)
    const out = await placeFigures('<!-- page 2 -->\nIntro.\n\n[[figure: the Krebs cycle | 10,30,90,70]]\n\nMore text.', source({ crop }))
    expect(crop).toHaveBeenCalledWith(2, { x0: 10, y0: 30, x1: 90, y1: 70 }, 'the Krebs cycle')
    expect(out).toBe('Intro.\n\n![the Krebs cycle](studyhub-image:fig.webp)\n\nMore text.')
  })
  it('does not add the page\'s embedded pictures again at its end when the AI marked its figures', async () => {
    const out = await placeFigures('<!-- page 1 -->\n[[figure: a graph | 5,5,95,60]]\nText.', source({ pictures: pics({ 1: ['![same](studyhub-image:same.webp)'] }), crop: async () => '![graph](studyhub-image:g.webp)' }))
    expect(out).toBe('![graph](studyhub-image:g.webp)\n\nText.')
  })
  it('takes the page\'s next embedded picture for a figure with no usable box, in order', async () => {
    const md = '<!-- page 1 -->\n## Respiration\n\n[[figure: the Krebs cycle]]\n\nMore.\n<!-- page 2 -->\n[[figure: a mitochondrion | 1,1,2,2]]'
    const out = await placeFigures(md, source({ pictures: pics({ 1: ['![a](studyhub-image:1.webp)'], 2: ['![b](studyhub-image:2.webp)'] }) }))
    expect(out).toBe('## Respiration\n\n![a](studyhub-image:1.webp)\n\nMore.\n\n![b](studyhub-image:2.webp)')
  })
  it('falls back to the embedded picture when the page cannot be cut', async () => {
    const out = await placeFigures('<!-- page 1 -->\n[[figure: x | 10,10,90,90]]', source({ pictures: pics({ 1: ['![p](studyhub-image:p.webp)'] }) }))
    expect(out).toBe('![p](studyhub-image:p.webp)')
  })
  it('shows a figure with no box and no picture as its whole page, once per page', async () => {
    const snapshot = vi.fn(async (page: number) => `![page ${page}](studyhub-image:p${page}.webp)`)
    const out = await placeFigures('<!-- page 3 -->\n[[figure: a graph]]\n\nText\n\n[[figure: another graph]]', source({ snapshot }))
    expect(out).toBe('![page 3](studyhub-image:p3.webp)\n\nText')
    expect(snapshot).toHaveBeenCalledTimes(1)
  })
  it('keeps the figure\'s words in italics when nothing can be drawn', async () => {
    expect(await placeFigures('<!-- page 1 -->\n[[figure: a graph of rate against temperature]]', source())).toBe('*a graph of rate against temperature*')
  })
  it('puts the pictures of a page the AI marked nothing on at its end, so nothing is lost', async () => {
    const out = await placeFigures('<!-- page 1 -->\nPage one.\n<!-- page 2 -->\nPage two.', source({ pictures: pics({ 1: ['![x](studyhub-image:x.webp)'] }) }))
    expect(out).toBe('Page one.\n\n![x](studyhub-image:x.webp)\n\nPage two.')
  })
  it('leaves a note with no marks as it is', async () => {
    expect(await placeFigures('## Just text\n\nHello.', source())).toBe('## Just text\n\nHello.')
  })
})

describe('a PDF read without the AI', () => {
  it('shows each page\'s text, then its pictures, pages ruled apart', async () => {
    expect(await textWithPictures(['One', 'Two'], source({ pictures: pics({ 2: ['![p](studyhub-image:p.webp)'] }) }))).toBe('One\n\n---\n\nTwo\n\n![p](studyhub-image:p.webp)')
  })
  it('shows a page that draws shapes or lines, with no picture files, as a picture of the page', async () => {
    const out = await textWithPictures(['Plain', 'A flowchart'], source({
      hasGraphics: async p => p === 2, snapshot: async p => `![page ${p}](studyhub-image:p${p}.webp)`,
    }))
    expect(out).toBe('Plain\n\n---\n\nA flowchart\n\n![page 2](studyhub-image:p2.webp)')
  })
})
