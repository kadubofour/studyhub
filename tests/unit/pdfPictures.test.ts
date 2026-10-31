// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { pdfPagePictures } from '@/lib/import/pdfPictures'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const OPS = { save: 1, restore: 2, transform: 3, paintImageXObject: 4, paintImageXObjectRepeat: 5, constructPath: 6, paintFormXObjectBegin: 7, paintFormXObjectEnd: 8 }

// A 600 x 800 page that paints the given images, each placed w x h on the page
function docWith(images: { name: string; w: number; h: number }[]) {
  const fnArray: number[] = [], argsArray: unknown[] = []
  for (const im of images) {
    fnArray.push(OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore)
    argsArray.push(null, [im.w, 0, 0, im.h, 50, 50], [im.name], null)
  }
  const page = { getViewport: () => ({ width: 600, height: 800 }), getOperatorList: async () => ({ fnArray, argsArray }) }
  return { numPages: 1, getPage: async () => page } as unknown as PDFDocumentProxy
}

describe('pdfPagePictures: which pictures count as figures', () => {
  it('leaves out a small picture (a logo or a signature) and keeps a picture that fills part of the page', async () => {
    const pics = pdfPagePictures(docWith([{ name: 'logo', w: 36, h: 18 }, { name: 'diagram', w: 400, h: 250 }]), async () => null, OPS)
    // the page draws graphics (the diagram), and only that
    expect(await pics.hasGraphics?.(1)).toBe(true)
  })
  it('does not count a page with only a small picture as drawing anything', async () => {
    const pics = pdfPagePictures(docWith([{ name: 'logo', w: 36, h: 18 }]), async () => null, OPS)
    expect(await pics.hasGraphics?.(1)).toBe(false)
  })
})
