// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { notesToDocx } from '@/lib/export/notesToDocx'

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file('word/document.xml')!.async('string')
}

const note = {
  title: 'Quadratics', course: 'Calculus',
  content_md: [
    '## Formula',
    '',
    'Inline $x^2$ and **bold** with *italic* and `code`.',
    '',
    '$$',
    'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
    '$$',
    '',
    '- first',
    '- second',
    '',
    '1. one',
    '2. two',
    '',
    '- [ ] todo',
    '- [x] done',
    '',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    '> quoted',
    '',
    'Broken $\\frac{$ math',
  ].join('\n'),
}

describe('notesToDocx', () => {
  it('writes a Word document with headings, lists, a table and real equations', async () => {
    const xml = await documentXml(await notesToDocx([note]))
    expect(xml).toMatch(/xmlns:m="http:\/\/schemas.openxmlformats.org\/officeDocument\/2006\/math"/)
    expect(xml).toContain('Quadratics') // title
    expect(xml).toContain('Calculus') // course line
    expect(xml).toMatch(/w:pStyle w:val="Heading2"[\s\S]*Formula/)
    expect((xml.match(/<m:oMath>/g) ?? []).length).toBeGreaterThanOrEqual(2) // inline + display
    expect(xml).toContain('<m:oMathPara>')
    expect(xml).toContain('<m:f>')
    expect(xml).toContain('<w:b/>') // bold run
    expect(xml).toContain('first')
    expect(xml).toContain('two')
    expect(xml).toContain('☐')
    expect(xml).toContain('☑')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toMatch(/<w:ind w:left="567"\/>[\s\S]{0,400}quoted/) // block quote is indented
  })

  it('keeps unparseable math as its LaTeX text instead of failing', async () => {
    const xml = await documentXml(await notesToDocx([note]))
    expect(xml).toContain('$\\frac{$')
  })

  it('puts several notes in one document, each starting on a new page', async () => {
    const xml = await documentXml(await notesToDocx([note, { title: 'Cells', course: null, content_md: 'Mitochondria' }]))
    expect(xml).toContain('Cells')
    expect(xml).toContain('Mitochondria')
    expect(xml).toContain('w:type="page"')
  })
})
