import { describe, it, expect } from 'vitest'
import { redrawFigure, type PageLike } from '@/lib/import/pdfRedraw'

const OPS = {
  save: 1, restore: 2, transform: 3, paintImageXObject: 4, paintImageXObjectRepeat: 5, constructPath: 6, setLineWidth: 7, setDash: 8, setFillRGBColor: 9, setStrokeRGBColor: 10, setFillColorN: 11,
  stroke: 20, fill: 22, eoFill: 23, fillStroke: 24, eoFillStroke: 25, closeStroke: 26, closeFillStroke: 27, closeEOFillStroke: 28,
}
// A 600 x 800 page, drawn upside down as pdf.js does (y counts from the bottom)
const view = { width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] }
const path = (op: number, ...d: number[]) => [op, [Float32Array.from(d)], null]
const line = (x0: number, y0: number, x1: number, y1: number) => path(OPS.stroke, 0, x0, y0, 1, x1, y1)

function page(ops: [number, unknown][], items: { str: string; transform: number[]; width: number; height: number }[] = []): PageLike {
  return {
    getViewport: () => view,
    getOperatorList: async () => ({ fnArray: ops.map(o => o[0]), argsArray: ops.map(o => o[1]) }),
    getTextContent: async () => ({ items, styles: {} }),
  }
}
const label = (str: string, x: number, y: number) => ({ str, transform: [10, 0, 0, 10, x, y], width: 6, height: 10 })
// a number line near the middle of the page: PDF y 400 is 400 down from the top
const numberLine: [number, unknown][] = [[OPS.constructPath, line(100, 400, 300, 400)], [OPS.constructPath, line(100, 395, 100, 405)], [OPS.constructPath, line(300, 395, 300, 405)]]
const BOX = { x0: 10, y0: 40, x1: 60, y1: 60 } // percent: x 60-360, y 320-480 from the top

describe('redrawFigure', () => {
  it('draws the lines in the box and the labels beside them as one SVG as large as the drawing', async () => {
    const fig = await redrawFigure(page(numberLine, [label('a', 98, 385), label('b', 298, 385)]), BOX, OPS)
    expect(fig).not.toBeNull()
    expect(fig!.svg).toContain('<path')
    expect(fig!.svg).toContain('>a</text>')
    expect(fig!.svg).toContain('>b</text>')
    expect(fig!.width).toBeLessThan(260) // the line is 200 wide, with the labels and some room, not the 300 of the box
    expect(fig!.height).toBeLessThan(80)
  })
  it('leaves out text that is above the drawing, a line of text, and a page rule', async () => {
    const rule: [number, unknown] = [OPS.constructPath, line(0, 790, 600, 790)]
    const fig = await redrawFigure(page([...numberLine, rule],
      [label('a', 98, 385), label('We show the interval in the figure', 100, 430), label('above', 150, 440)]), BOX, OPS)
    expect(fig!.svg).toContain('>a</text>')
    expect(fig!.svg).not.toContain('We show')
    expect(fig!.svg).not.toContain('>above<')
    expect(fig!.svg).not.toContain('790')
  })
  it('draws a hatched fill as a light wash of its colour, not solid', async () => {
    const bar: [number, unknown][] = [[OPS.setFillColorN, ['TilingPattern', '#0000ff', {}]], [OPS.constructPath, path(OPS.fill, 0, 100, 400, 1, 300, 400, 1, 300, 410, 1, 100, 410, 4)]]
    const fig = await redrawFigure(page([...numberLine, ...bar]), BOX, OPS)
    expect(fig!.svg).toContain('fill="#0000ff" fill-opacity="0.28"')
  })
  it('returns null when nothing is drawn in the box, or a picture file is', async () => {
    expect(await redrawFigure(page(numberLine), { x0: 70, y0: 5, x1: 95, y1: 15 }, OPS)).toBeNull()
    expect(await redrawFigure(page([[OPS.save, null], [OPS.transform, [100, 0, 0, 80, 100, 360]], [OPS.paintImageXObject, ['img']], [OPS.restore, null], ...numberLine]), BOX, OPS)).toBeNull()
  })
})
