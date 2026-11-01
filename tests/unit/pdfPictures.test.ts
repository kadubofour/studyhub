// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { pdfPagePictures } from '@/lib/import/pdfPictures'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const OPS = { save: 1, restore: 2, transform: 3, paintImageXObject: 4, paintImageXObjectRepeat: 5, constructPath: 6, paintFormXObjectBegin: 7, paintFormXObjectEnd: 8 }

// A 600 x 800 page that paints the given images, each placed w x h on the page
function docWith(images: { name: string; w: number; h: number; y?: number }[]) {
  const fnArray: number[] = [], argsArray: unknown[] = []
  for (const im of images) {
    fnArray.push(OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore)
    argsArray.push(null, [im.w, 0, 0, im.h, 50, im.y ?? 50], [im.name], null)
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

describe('pdfPagePictures: what is decoration and not a figure', () => {
  const graphics = async (images: Parameters<typeof docWith>[0]) => pdfPagePictures(docWith(images), async () => null, OPS).hasGraphics?.(1)
  it('leaves out a picture the document shares across its pages (a logo or a watermark), and keeps one that is the page\'s own', async () => {
    expect(await graphics([{ name: 'g_logo', w: 300, h: 200, y: 300 }])).toBe(false)
    expect(await graphics([{ name: 'img_p0_1', w: 300, h: 200, y: 300 }])).toBe(true)
  })
  it('leaves out a picture in a running header or footer, and keeps the same picture in the body', async () => {
    expect(await graphics([{ name: 'a', w: 300, h: 100, y: 720 }])).toBe(false) // centred in the top tenth
    expect(await graphics([{ name: 'b', w: 300, h: 100, y: 5 }])).toBe(false) // centred in the bottom
    expect(await graphics([{ name: 'c', w: 300, h: 100, y: 400 }])).toBe(true)
  })
  it('leaves out a banner or a rule, and a picture of the page\'s corner too small to be a figure', async () => {
    expect(await graphics([{ name: 'bar', w: 560, h: 70, y: 300 }])).toBe(false) // 8 to 1
    expect(await graphics([{ name: 'tiny', w: 60, h: 60, y: 300 }])).toBe(false) // under 3% of the page
    expect(await graphics([{ name: 'fig', w: 300, h: 150, y: 300 }])).toBe(true)
  })
})
