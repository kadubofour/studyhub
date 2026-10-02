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

  it('falls back to the file name for the title', async () => {
    const blob = await notesToDocx([{ title: '', course: null, content_md: 'Just text' }])
    const note = await docxToNote(await blob.arrayBuffer(), 'Week 3 notes.docx')
    expect(note.title).toBe('Week 3 notes')
    expect(note.content_md).toContain('Just text')
  })
})
