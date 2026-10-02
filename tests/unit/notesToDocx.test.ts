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

async function part(blob: Blob, name: string): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file(name)!.async('string')
}

describe('notesToDocx robustness', () => {
  it('drops control characters (pasted from Word/PDF) that would make Word reject the file', async () => {
    const xml = await documentXml(await notesToDocx([{ title: 'T\u000B', course: null, content_md: 'a\u000Bb and $x\u0001$' }]))
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/)
    expect(xml).toContain('ab')
  })

  it('numbers each ordered list on its own, honouring its start number', async () => {
    const blob = await notesToDocx([{ title: 'L', course: null, content_md: '1. a\n2. b\n\nText\n\n5. e\n6. f\n   1. nested' }])
    const numbering = await part(blob, 'word/numbering.xml')
    expect(numbering).toMatch(/<w:start w:val="5"\/>/)
    const xml = await documentXml(blob)
    const numIds = [...xml.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map(m => m[1])
    expect(new Set(numIds).size).toBeGreaterThanOrEqual(3) // first list, second list and the nested list are separate
  })

  it('indents extra paragraphs inside a list item and gives a code-first item its bullet', async () => {
    const xml = await documentXml(await notesToDocx([{ title: 'L', course: null, content_md: '- first\n\n  more about first\n\n- ```\n  code\n  ```' }]))
    expect(xml).toMatch(/<w:ind w:left="720"\/>[\s\S]{0,300}more about first/)
    expect((xml.match(/<w:numPr>/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps an image as a readable placeholder instead of an empty line', async () => {
    const xml = await documentXml(await notesToDocx([{ title: 'I', course: null, content_md: '![Cell diagram](https://example.com/cell.png)' }]))
    expect(xml).toContain('Cell diagram')
  })
})

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
