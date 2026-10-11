// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { fileKind } from '@/lib/import/fileKind'
import { pptxToNote, MAX_SLIDES } from '@/lib/import/pptxToNote'
import { textToNote, MAX_TEXT_BYTES } from '@/lib/import/textToNote'

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const shapes = (...paras: string[][]) => paras.map(runs => `<p:sp><p:txBody><a:p>${runs.map(t => `<a:r><a:t>${t}</a:t></a:r>`).join('')}</a:p></p:txBody></p:sp>`).join('')
const slide = (...paras: string[][]) => `<?xml version="1.0"?><p:sld ${A} ${P}><p:cSld><p:spTree>${shapes(...paras)}</p:spTree></p:cSld></p:sld>`
const numberShape = '<p:sp><p:nvSpPr><p:cNvPr id="1" name="n"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody></p:sp>'
const notes = (text: string) => `<?xml version="1.0"?><p:notes ${A} ${P}><p:cSld><p:spTree>${numberShape}${shapes([text])}</p:spTree></p:cSld></p:notes>`
async function pptx(slides: { xml: string; notes?: string }[], extra: Record<string, string> = {}): Promise<ArrayBuffer> {
  const zip = new JSZip()
  slides.forEach((s, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, s.xml)
    if (s.notes !== undefined) zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, notes(s.notes))
  })
  for (const [k, v] of Object.entries(extra)) zip.file(k, v)
  return zip.generateAsync({ type: 'arraybuffer' })
}
const file = (name: string, type = '') => ({ name, type }) as File

describe('fileKind', () => {
  it('recognises the types by extension, ignoring case', () => {
    expect(fileKind(file('Notes.PDF'))).toBe('pdf')
    expect(fileKind(file('essay.docx'))).toBe('docx')
    expect(fileKind(file('Lecture 3.pptx'))).toBe('pptx')
    expect(fileKind(file('readme.md'))).toBe('text')
    expect(fileKind(file('plain.txt'))).toBe('text')
    expect(fileKind(file('scan.JPG'))).toBe('image')
    expect(fileKind(file('shot.png'))).toBe('image')
    expect(fileKind(file('slide.webp'))).toBe('image')
    expect(fileKind(file('talk.mp3'))).toBe('audio')
    expect(fileKind(file('talk.m4a'))).toBe('audio')
    expect(fileKind(file('talk.wav'))).toBe('audio')
    expect(fileKind(file('clip.mp4'))).toBe('audio')
  })
  it('falls back to the media type when the name has no useful extension', () => {
    expect(fileKind(file('upload', 'application/pdf'))).toBe('pdf')
    expect(fileKind(file('photo', 'image/jpeg'))).toBe('image')
    expect(fileKind(file('voice', 'audio/webm'))).toBe('audio')
  })
  it('says unknown for anything else, including old Office formats', () => {
    expect(fileKind(file('old.doc'))).toBeNull()
    expect(fileKind(file('old.ppt'))).toBeNull()
    expect(fileKind(file('data.xlsx'))).toBeNull()
    expect(fileKind(file('noextension'))).toBeNull()
  })
})

describe('pptxToNote', () => {
  it('turns each slide into a titled section with its other text as bullets, in slide order', async () => {
    const buf = await pptx([
      { xml: slide(['Krebs cycle'], ['Takes place in the matrix'], ['Makes NADH']) },
      { xml: slide(['Glycolysis'], ['Splits glucose']) },
    ])
    const out = await pptxToNote(buf, 'Biology week 3.pptx')
    expect(out.title).toBe('Krebs cycle')
    expect(out.content_md).toBe('## Slide 1: Krebs cycle\n\n- Takes place in the matrix\n- Makes NADH\n\n## Slide 2: Glycolysis\n\n- Splits glucose')
  })
  it('puts slide 10 after slide 9, not after slide 1', async () => {
    const slides = Array.from({ length: 11 }, (_, i) => ({ xml: slide([`Title ${i + 1}`]) }))
    const out = await pptxToNote(await pptx(slides), 'deck.pptx')
    const order = [...out.content_md.matchAll(/## Slide (\d+):/g)].map(m => Number(m[1]))
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })
  it('joins the runs of one paragraph and keeps special characters', async () => {
    const buf = await pptx([{ xml: slide(['Intro'], ['Fish ', '&amp; ', 'chips'], ['x &lt; y']) }])
    const out = await pptxToNote(buf, 'a.pptx')
    expect(out.content_md).toContain('- Fish & chips')
    expect(out.content_md).toContain('- x < y')
  })
  it('adds the speaker notes under each slide and ignores the slide number placeholder', async () => {
    const buf = await pptx([{ xml: slide(['Topic'], ['Point']), notes: 'Remember to mention ATP' }])
    const out = await pptxToNote(buf, 'a.pptx')
    expect(out.content_md).toContain('*Notes:* Remember to mention ATP')
    expect(out.content_md).not.toContain('- 1')
  })
  it('gives a slide with no text a plain heading, and the note a title from the file name when no slide has text', async () => {
    const buf = await pptx([{ xml: slide() }, { xml: slide() }])
    const out = await pptxToNote(buf, 'My Lecture.pptx')
    expect(out.title).toBe('My Lecture')
    expect(out.content_md).toContain('## Slide 1')
  })
  it('reads at most the first slides', async () => {
    const slides = Array.from({ length: MAX_SLIDES + 5 }, (_, i) => ({ xml: slide([`T${i + 1}`]) }))
    const out = await pptxToNote(await pptx(slides), 'big.pptx')
    expect(out.content_md.match(/## Slide /g)).toHaveLength(MAX_SLIDES)
    expect(out.notice).toMatch(/first 200 slides/)
  })
  it('rejects a file that is not a PowerPoint', async () => {
    await expect(pptxToNote(new TextEncoder().encode('hello').buffer as ArrayBuffer, 'x.pptx')).rejects.toThrow()
    await expect(pptxToNote(await pptx([], { 'readme.txt': 'hi' }), 'x.pptx')).rejects.toThrow(/no slides/i)
  })
})

describe('textToNote', () => {
  const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
  it('uses the first heading as the title and keeps the text', () => {
    const out = textToNote(bytes('# Enzymes\n\nThey speed up reactions.\n'), 'notes.md')
    expect(out.title).toBe('Enzymes')
    expect(out.content_md).toBe('# Enzymes\n\nThey speed up reactions.')
  })
  it('uses the file name when there is no heading', () => {
    const out = textToNote(bytes('Just some words.'), 'week 4 summary.txt')
    expect(out.title).toBe('week 4 summary')
    expect(out.content_md).toBe('Just some words.')
  })
  it('turns Windows line endings into plain ones and drops a byte order mark', () => {
    const out = textToNote(bytes('﻿Line one\r\nLine two\r\n'), 'a.txt')
    expect(out.content_md).toBe('Line one\nLine two')
  })
  it('refuses a file that is too big', () => {
    expect(() => textToNote(new ArrayBuffer(MAX_TEXT_BYTES + 1), 'big.txt')).toThrow(/1 MB/)
  })
  it('accepts an empty file and leaves it for the preview to say so', () => {
    expect(textToNote(bytes('  \n'), 'e.txt').content_md).toBe('')
  })
})
