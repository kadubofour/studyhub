import { describe, it, expect, vi } from 'vitest'
import { placeFigures, textWithPictures } from '@/lib/import/placeFigures'

const pics = (byPage: Record<number, string[]>) => async (page: number) => [...(byPage[page] ?? [])]

describe('putting a PDF\'s pictures where its figures were', () => {
  it('puts each page\'s pictures at its figure marks, in order, and takes the marks out', async () => {
    const md = '<!-- page 1 -->\n## Respiration\n\nIntro.\n\n[[figure: the Krebs cycle]]\n\nMore text.\n<!-- page 2 -->\n[[figure: a mitochondrion]]\n\nEnd.'
    const out = await placeFigures(md, { pictures: pics({ 1: ['![a](studyhub-image:1.webp)'], 2: ['![b](studyhub-image:2.webp)'] }), snapshot: async () => null })
    expect(out).toBe('## Respiration\n\nIntro.\n\n![a](studyhub-image:1.webp)\n\nMore text.\n\n![b](studyhub-image:2.webp)\n\nEnd.')
  })
  it('shows a figure drawn without a picture as its whole page, once per page', async () => {
    const snapshot = vi.fn(async (page: number) => `![page ${page}](studyhub-image:p${page}.webp)`)
    const out = await placeFigures('<!-- page 3 -->\n[[figure: a graph]]\n\nText\n\n[[figure: another graph]]', { pictures: pics({}), snapshot })
    expect(out).toBe('![page 3](studyhub-image:p3.webp)\n\nText')
    expect(snapshot).toHaveBeenCalledTimes(1)
  })
  it('keeps the figure\'s words in italics when the page cannot be drawn', async () => {
    expect(await placeFigures('<!-- page 1 -->\n[[figure: a graph of rate against temperature]]', { pictures: pics({}), snapshot: async () => null }))
      .toBe('*a graph of rate against temperature*')
  })
  it('puts a picture no mark asked for at the end of its page, so nothing is lost', async () => {
    const out = await placeFigures('<!-- page 1 -->\nPage one.\n<!-- page 2 -->\nPage two.', { pictures: pics({ 1: ['![x](studyhub-image:x.webp)'] }), snapshot: async () => null })
    expect(out).toBe('Page one.\n\n![x](studyhub-image:x.webp)\n\nPage two.')
  })
  it('leaves a note with no marks as it is', async () => {
    expect(await placeFigures('## Just text\n\nHello.', { pictures: pics({}), snapshot: async () => null })).toBe('## Just text\n\nHello.')
  })
  it('without the AI: each page\'s text, then its pictures, pages ruled apart', async () => {
    expect(await textWithPictures(['One', 'Two'], pics({ 2: ['![p](studyhub-image:p.webp)'] }))).toBe('One\n\n---\n\nTwo\n\n![p](studyhub-image:p.webp)')
  })
})
