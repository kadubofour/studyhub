// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
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
