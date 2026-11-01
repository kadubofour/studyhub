import { describe, expect, it, vi } from 'vitest'
import { cleanSvg, redrawFigures } from '@/lib/ai/redrawFigures'
import type { AiClient } from '@/lib/ai/openai'

const good = '<svg viewBox="0 0 400 100"><line x1="10" y1="50" x2="390" y2="50" stroke="#111"/><text x="10" y="80">a</text></svg>'

describe('cleanSvg: only a safe drawing with a size is kept', () => {
  it('keeps a drawing, gives it a white page and the namespace, and reports its size', () => {
    const r = cleanSvg(good)!
    expect(r.width).toBe(400); expect(r.height).toBe(100)
    expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(r.svg).toMatch(/<rect[^>]*fill="#ffffff"/)
    expect(r.svg).toContain('<text x="10" y="80">a</text>')
  })
  it('takes it out of a code fence, and reads the size from width and height when there is no viewBox', () => {
    const r = cleanSvg('```svg\n<svg width="300" height="150"><circle r="5"/></svg>\n```')!
    expect([r.width, r.height]).toEqual([300, 150])
    expect(r.svg).toContain('viewBox="0 0 300 150"')
  })
  it.each([
    ['a script', '<svg viewBox="0 0 100 100"><script>alert(1)</script></svg>'],
    ['an event handler', '<svg viewBox="0 0 100 100"><rect width="9" height="9" onload="x()"/></svg>'],
    ['an embedded picture', '<svg viewBox="0 0 100 100"><image href="data:image/png;base64,AAAA"/></svg>'],
    ['a link', '<svg viewBox="0 0 100 100"><a href="https://x.test"><text>x</text></a></svg>'],
    ['foreign content', '<svg viewBox="0 0 100 100"><foreignObject><div/></foreignObject></svg>'],
    ['an outside url', '<svg viewBox="0 0 100 100"><rect fill="url(https://x.test/a)" width="5" height="5"/></svg>'],
    ['no size', '<svg><circle r="5"/></svg>'],
    ['something that is not an svg', 'Sorry, I cannot redraw that.'],
    ['an empty answer', ''],
  ])('refuses %s', (_name, svg) => expect(cleanSvg(svg)).toBeNull())
  it('refuses a drawing that is far too long', () => expect(cleanSvg(`<svg viewBox="0 0 100 100">${'<g/>'.repeat(20_000)}</svg>`)).toBeNull())
})

describe('redrawFigures', () => {
  const clientReplying = (drawings: { svg: string }[]) => {
    const parse = vi.fn(async () => ({ status: 'completed', output: [], output_parsed: { drawings } }))
    return { client: { responses: { parse } } as unknown as AiClient, parse }
  }
  const figure = (caption: string) => ({ mime: 'image/png' as const, base64: 'AAAA', caption })

  it('returns a drawing for each picture in order, and null where the answer is empty or unsafe', async () => {
    const { client } = clientReplying([{ svg: good }, { svg: '' }, { svg: '<svg viewBox="0 0 9 9"><script/></svg>' }])
    const out = await redrawFigures(client, [figure('a'), figure('photo'), figure('c')])
    expect(out[0]?.width).toBe(400)
    expect(out[1]).toBeNull()
    expect(out[2]).toBeNull()
  })
  it('gives null for a picture the model did not answer', async () => {
    const { client } = clientReplying([{ svg: good }])
    expect(await redrawFigures(client, [figure('a'), figure('b')])).toHaveLength(2)
  })
  it('sends every picture with its caption, and asks for a faithful redraw with the labels as text', async () => {
    const { client, parse } = clientReplying([{ svg: good }])
    await redrawFigures(client, [figure('Venn diagram')])
    const call = (parse.mock.calls as unknown[][])[0][0] as unknown as { instructions: string; input: { content: { type: string; text?: string; image_url?: string }[] }[] }
    expect(call.instructions).toMatch(/same layout/i)
    expect(call.instructions).toMatch(/<text>/)
    expect(call.instructions).toMatch(/photograph/i)
    const parts = call.input[0].content
    expect(parts.some(p => p.type === 'input_image' && p.image_url === 'data:image/png;base64,AAAA')).toBe(true)
    expect(parts.some(p => p.text?.includes('Venn diagram'))).toBe(true)
  })
})
