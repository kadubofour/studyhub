// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { notesToDocx } from '@/lib/export/notesToDocx'
import { docxToNote } from '@/lib/import/docxToNote'

const md = [
  '## Formula',
  '',
  'Inline $x^2$ here.',
  '',
  '$$',
  '\\frac{a}{b}',
  '$$',
  '',
  '- first',
  '- second',
  '',
  'Plain **bold** text with snake_case_words.',
].join('\n')

describe('docxToNote: drawings that are not picture files', () => {
  const DOC_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const para = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`
  const shapeDrawing = (descr: string) => `<w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><wp:inline><wp:extent cx="3000000" cy="1500000"/><wp:docPr id="1" name="Diagram" descr="${descr}"/><a:graphic><a:graphicData uri="x"><wps:wsp><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1200000" cy="600000"/></a:xfrm><a:prstGeom prst="roundRect"/><a:solidFill><a:srgbClr val="4472C4"/></a:solidFill></wps:spPr><wps:txbx><w:txbxContent><w:p><w:r><w:t>Sunlight</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:t>OLD FALLBACK</w:t></mc:Fallback></mc:AlternateContent></w:r></w:p>`
  async function docWith(body: string, extra: Record<string, string> = {}) {
    const zip = await JSZip.loadAsync(await (await notesToDocx([{ title: 'T', course: null, content_md: 'x' }])).arrayBuffer())
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${DOC_NS}><w:body>${body}</w:body></w:document>`)
    for (const [k, v] of Object.entries(extra)) zip.file(k, v)
    return zip.generateAsync({ type: 'arraybuffer' })
  }
  const fakePng = new Blob(['png'], { type: 'image/png' })
  it('draws a shape diagram and puts it between the paragraphs it sat between, with its description', async () => {
    const svgs: string[] = []
    const kept: string[] = []
    const note = await docxToNote(await docWith(para('Before the diagram.') + shapeDrawing('How energy flows') + para('After it.')), 'e.docx',
      async (_b, alt) => { kept.push(alt); return `![${alt}](studyhub-image:d.webp)` },
      async (svg, w, h) => { svgs.push(`${w}x${h}`); expect(svg).toContain('Sunlight'); return fakePng })
    expect(kept).toEqual(['How energy flows'])
    expect(svgs).toEqual(['1200x600'])
    expect(note.content_md).toBe('Before the diagram.\n\n![How energy flows](studyhub-image:d.webp)\n\nAfter it.')
    expect(note.content_md).not.toContain('OLD FALLBACK') // the old-Word fallback does not show beside it
  })
  it('draws a chart that fills its drawing, from the chart saved in the file', async () => {
    const chartDrawing = `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="4000000" cy="2000000"/><wp:docPr id="2" name="Chart"/><a:graphic><a:graphicData uri="x"><c:chart r:id="rId9"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
    const chart = `<?xml version="1.0"?><c:chartSpace ${DOC_NS}><c:chart><c:plotArea><c:pieChart><c:ser><c:cat><c:strLit><c:pt idx="0"><c:v>Cats</c:v></c:pt><c:pt idx="1"><c:v>Dogs</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:pt idx="0"><c:v>1</c:v></c:pt><c:pt idx="1"><c:v>3</c:v></c:pt></c:numLit></c:val></c:ser></c:pieChart></c:plotArea></c:chart></c:chartSpace>`
    let drawn = ''
    const note = await docxToNote(await docWith(chartDrawing, {
      'word/charts/chart1.xml': chart,
      'word/_rels/document.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId9" Type="x/chart" Target="charts/chart1.xml"/></Relationships>',
    }), 'c.docx', async (_b, alt) => `![${alt}](studyhub-image:c.webp)`, async svg => { drawn = svg; return fakePng })
    expect(drawn).toContain('75%')
    expect(note.content_md).toBe('![Figure](studyhub-image:c.webp)')
  })
  it('leaves a drawing out, rather than fail, when it cannot be drawn or kept', async () => {
    const buf = await docWith(para('Before.') + shapeDrawing('x') + para('After.'))
    expect((await docxToNote(buf, 'e.docx', async () => 'x', async () => null)).content_md).toBe('Before.\n\nAfter.')
    expect((await docxToNote(buf, 'e.docx', async () => null, async () => fakePng)).content_md).toBe('Before.\n\nAfter.')
    expect((await docxToNote(buf, 'e.docx', async () => 'x', async () => { throw new Error('no canvas') })).content_md).toBe('Before.\n\nAfter.')
  })
  it('draws nothing when there is no keeper (the import without pictures)', async () => {
    const note = await docxToNote(await docWith(para('Before.') + shapeDrawing('x') + para('After.')), 'e.docx')
    expect(note.content_md).toContain('Before.')
    expect(note.content_md).toContain('After.')
  })
})

describe('docxToNote: pictures', () => {
  // a 1x1 PNG, embedded through the Word export, which is how a real document carries one
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))
  const withPicture = () => notesToDocx([{ title: 'Cells', course: null, content_md: 'Before the picture.\n\n![A cell](studyhub-image:cell.png)\n\nAfter it.' }],
    async () => ({ data: png, width: 1, height: 1, type: 'png' }))
  it('keeps a picture where it was, with its description, when there is a keeper', async () => {
    const kept: string[] = []
    const keep = async (b: Blob, alt: string) => { kept.push(`${b.type}:${alt}`); return `![${alt}](studyhub-image:kept.webp)` }
    const note = await docxToNote(await (await withPicture()).arrayBuffer(), 'cells.docx', keep)
    expect(kept).toEqual(['image/png:A cell'])
    expect(note.content_md).toBe('Before the picture.\n\n![A cell](studyhub-image:kept.webp)\n\nAfter it.')
  })
  it('only marks where a picture was without a keeper, or when it is left out', async () => {
    const buf = await (await withPicture()).arrayBuffer()
    expect((await docxToNote(buf, 'cells.docx')).content_md).toContain('*[Image: A cell]*')
    expect((await docxToNote(buf, 'cells.docx', async () => null)).content_md).toContain('*[Image: A cell]*')
  })
})

describe('docxToNote (Word import)', () => {
  it('round-trips headings, lists, bold and equations from a Word file', async () => {
    const blob = await notesToDocx([{ title: 'Quadratics', course: null, content_md: md }])
    const note = await docxToNote(await blob.arrayBuffer(), 'quadratics.docx')
    expect(note.title).toBe('Quadratics')
    expect(note.content_md).toMatch(/^## Formula$/m)
    expect(note.content_md).toMatch(/^- first$/m)
    expect(note.content_md).toContain('**bold**')
    expect(note.content_md).toContain('snake_case_words') // not mangled into snake\_case
    expect(note.content_md).toMatch(/\$x\^\{?2\}?\$/) // inline equation back as LaTeX
    expect(note.content_md).toMatch(/\$\$\s*\\frac\{a\}\{b\}\s*\$\$/) // display equation on its own
  })

  it('round-trips a table, including a | inside a cell', async () => {
    const blob = await notesToDocx([{ title: 'T', course: null, content_md: '| Term | Meaning |\n|---|---|\n| ATP | energy \\| currency |\n| DNA | genes |' }])
    const note = await docxToNote(await blob.arrayBuffer(), 't.docx')
    const lines = note.content_md.split('\n').filter(l => l.startsWith('|'))
    expect(lines).toHaveLength(4) // header, separator, two rows: nothing split across lines
    expect(lines[0]).toMatch(/^\| Term \| Meaning \|$/)
    expect(lines[2]).toContain('energy \\| currency')
  })

  it('escapes Word text that would otherwise turn into math, emphasis, links or HTML', async () => {
    const blob = await notesToDocx([{ title: 'T', course: null, content_md: 'Costs \\$5 and \\$10. Ratio 2\\*3\\*4, a \\<b\\> tag, \\[x\\](y)' }])
    const note = await docxToNote(await blob.arrayBuffer(), 't.docx')
    const { unified } = await import('unified')
    const remarkParse = (await import('remark-parse')).default
    const remarkMath = (await import('remark-math')).default
    const tree = unified().use(remarkParse).use(remarkMath).parse(note.content_md)
    const types = new Set<string>()
    const walk = (n: { type: string; children?: unknown[] }) => { types.add(n.type); (n.children as typeof n[] | undefined)?.forEach(walk) }
    walk(tree as never)
    for (const t of ['inlineMath', 'emphasis', 'link', 'html']) expect(types.has(t), t).toBe(false)
  })

  it('keeps every section heading when the document has no Title style', async () => {
    // A typical student Word file: Heading 1 for each section, no Title paragraph
    const { Document, Packer, Paragraph, HeadingLevel } = await import('docx')
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ text: 'Part one', heading: HeadingLevel.HEADING_1 }), new Paragraph({ text: 'A' }),
      new Paragraph({ text: 'Part two', heading: HeadingLevel.HEADING_1 }), new Paragraph({ text: 'B' }),
    ] }] })
    const blob = await Packer.toBlob(doc)
    const note = await docxToNote(await blob.arrayBuffer(), 'Essay.docx')
    expect(note.title).toBe('Essay')
    expect(note.content_md).toMatch(/^# Part one$/m)
    expect(note.content_md).toMatch(/^# Part two$/m)
  })

  it('falls back to the file name for the title', async () => {
    const blob = await notesToDocx([{ title: '', course: null, content_md: 'Just text' }])
    const note = await docxToNote(await blob.arrayBuffer(), 'Week 3 notes.docx')
    expect(note.title).toBe('Week 3 notes')
    expect(note.content_md).toContain('Just text')
  })
})
