// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { fileKind } from '@/lib/import/fileKind'
import { pptxToNote, MAX_SLIDES } from '@/lib/import/pptxToNote'
import { textToNote, MAX_TEXT_BYTES } from '@/lib/import/textToNote'

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const run = (t: string) => `<a:r><a:t>${t}</a:t></a:r>`
const para = (...runs: string[]) => `<a:p>${runs.map(run).join('')}</a:p>`
const sp = (paras: string, ph = '') => `<p:sp>${ph ? `<p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr>` : ''}<p:txBody>${paras}</p:txBody></p:sp>`
const shapes = (...lists: string[][]) => lists.map(runs => sp(para(...runs))).join('')
const spTree = (inner: string) => `<?xml version="1.0"?><p:sld ${A} ${P}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`
const slide = (...lists: string[][]) => spTree(shapes(...lists))
const numberShape = sp(para('1'), '<p:ph type="sldNum"/>')
const notesXml = (text: string) => `<?xml version="1.0"?><p:notes ${A} ${P}><p:cSld><p:spTree>${numberShape}${shapes([text])}</p:spTree></p:cSld></p:notes>`
const table = (rows: string[][]) => `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${rows.map(r => `<a:tr>${r.map(c => `<a:tc><a:txBody>${para(c)}</a:txBody></a:tc>`).join('')}</a:tr>`).join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
type S = { xml: string; notes?: string }
async function pptx(slides: S[], extra: Record<string, string> = {}): Promise<ArrayBuffer> {
  const zip = new JSZip()
  slides.forEach((s, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, s.xml)
    if (s.notes !== undefined) zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, notesXml(s.notes))
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
    expect(fileKind(file('clip.mp4'))).toBe('audio')
  })
  it('falls back to the media type when the name has no extension', () => {
    expect(fileKind(file('upload', 'application/pdf'))).toBe('pdf')
    expect(fileKind(file('photo', 'image/jpeg'))).toBe('image')
    expect(fileKind(file('voice', 'audio/webm'))).toBe('audio')
    expect(fileKind(file('words', 'text/plain'))).toBe('text')
    expect(fileKind(file('words', 'text/markdown'))).toBe('text')
    expect(fileKind(file('deck', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'))).toBe('pptx')
    expect(fileKind(file('doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe('docx')
  })
  it('says unknown for anything else, including old Office formats', () => {
    expect(fileKind(file('old.doc'))).toBeNull()
    expect(fileKind(file('old.ppt'))).toBeNull()
    expect(fileKind(file('data.xlsx'))).toBeNull()
    expect(fileKind(file('noextension'))).toBeNull()
  })
})

describe('pptxToNote: pictures', () => {
  const pic = (rid: string, descr: string) => `<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture" descr="${descr}"/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`
  const withPics = (inner: string) => `<?xml version="1.0"?><p:sld ${A} ${P} ${R}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`
  const rels = `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`
  it('keeps a slide\'s picture where it sits among the text, with its description', async () => {
    const kept: { type: string; alt: string }[] = []
    const keep = async (b: Blob, alt: string) => { kept.push({ type: b.type, alt }); return `![${alt}](studyhub-image:a.webp)` }
    const out = await pptxToNote(await pptx([{ xml: withPics(shapes(['Krebs cycle'], ['Before the diagram']) + pic('rId2', 'The cycle') + shapes(['After it'])) }],
      { 'ppt/slides/_rels/slide1.xml.rels': rels, 'ppt/media/image1.png': 'png-bytes' }), 'k.pptx', keep)
    expect(kept).toEqual([{ type: 'image/png', alt: 'The cycle' }])
    expect(out.content_md).toBe('## Slide 1: Krebs cycle\n\n- Before the diagram\n\n![The cycle](studyhub-image:a.webp)\n\n- After it')
  })
  it('leaves a picture out when it is not kept, or when there is no keeper', async () => {
    const deck = await pptx([{ xml: withPics(shapes(['T']) + pic('rId2', 'x')) }], { 'ppt/slides/_rels/slide1.xml.rels': rels, 'ppt/media/image1.png': 'png' })
    expect((await pptxToNote(deck, 'a.pptx', async () => null)).content_md).toBe('## Slide 1: T')
    expect((await pptxToNote(deck, 'a.pptx')).content_md).toBe('## Slide 1: T')
  })
})

describe('pptxToNote', () => {
  it('turns each slide into a titled section with its other text as bullets, in slide order', async () => {
    const out = await pptxToNote(await pptx([
      { xml: slide(['Krebs cycle'], ['Takes place in the matrix'], ['Makes NADH']) },
      { xml: slide(['Glycolysis'], ['Splits glucose']) },
    ]), 'Biology week 3.pptx')
    expect(out.title).toBe('Krebs cycle')
    expect(out.content_md).toBe('## Slide 1: Krebs cycle\n\n- Takes place in the matrix\n- Makes NADH\n\n## Slide 2: Glycolysis\n\n- Splits glucose')
  })
  it('puts slide 10 after slide 9, not after slide 1', async () => {
    const slides = Array.from({ length: 11 }, (_, i) => ({ xml: slide([`Title ${i + 1}`]) }))
    const out = await pptxToNote(await pptx(slides), 'deck.pptx')
    expect([...out.content_md.matchAll(/## Slide (\d+):/g)].map(m => Number(m[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })
  it('follows the order of the presentation, which can differ from the file numbers', async () => {
    const rels = `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="x/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="x/slide" Target="slides/slide2.xml"/></Relationships>`
    const pres = `<?xml version="1.0"?><p:presentation ${P} ${R}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>`
    const out = await pptxToNote(await pptx([{ xml: slide(['First file']) }, { xml: slide(['Second file']) }], { 'ppt/presentation.xml': pres, 'ppt/_rels/presentation.xml.rels': rels }), 'a.pptx')
    expect(out.content_md).toBe('## Slide 1: Second file\n\n## Slide 2: First file')
  })
  it('joins the runs of one paragraph and keeps special characters', async () => {
    const out = await pptxToNote(await pptx([{ xml: spTree(sp(para('Intro')) + sp(para('Fish ', '&amp; ', 'chips') + para('x &lt; y'))) }]), 'a.pptx')
    expect(out.content_md).toContain('- Fish & chips')
    expect(out.content_md).toContain('- x < y')
  })
  it('turns a line break inside a title into a space', async () => {
    const title = `<a:p><a:r><a:t>Chapter 3</a:t></a:r><a:br/><a:r><a:t>Cell Biology</a:t></a:r></a:p>`
    const out = await pptxToNote(await pptx([{ xml: spTree(sp(title)) }]), 'a.pptx')
    expect(out.title).toBe('Chapter 3 Cell Biology')
  })
  it('uses the title placeholder as the heading even when another text comes first', async () => {
    const xml = spTree(sp(para('Tuesday 3 March')) + sp(para('The real title'), '<p:ph type="title"/>') + sp(para('A point')))
    const out = await pptxToNote(await pptx([{ xml }]), 'a.pptx')
    expect(out.content_md).toBe('## Slide 1: The real title\n\n- Tuesday 3 March\n- A point')
  })
  it('reads text in tables and in grouped shapes, in place', async () => {
    const group = `<p:grpSp>${sp(para('Inside a group'))}</p:grpSp>`
    const xml = spTree(sp(para('Comparison')) + table([['Organelle', 'Job'], ['Nucleus', 'Holds DNA | genes']]) + group)
    const out = await pptxToNote(await pptx([{ xml }]), 'a.pptx')
    expect(out.content_md).toBe('## Slide 1: Comparison\n\n| Organelle | Job |\n| --- | --- |\n| Nucleus | Holds DNA \\| genes |\n\n- Inside a group')
  })
  it('adds the speaker notes the slide really points to, not the note with the same number', async () => {
    const slideRels = `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`
    const out = await pptxToNote(await pptx([{ xml: slide(['One']) }, { xml: slide(['Two']) }], {
      'ppt/notesSlides/notesSlide1.xml': notesXml('Only slide two has notes'), 'ppt/slides/_rels/slide2.xml.rels': slideRels,
    }), 'a.pptx')
    expect(out.content_md).toBe('## Slide 1: One\n\n## Slide 2: Two\n\n*Notes:* Only slide two has notes')
  })
  it('falls back to the note with the same number when a slide lists no relationships, and skips the slide number', async () => {
    const out = await pptxToNote(await pptx([{ xml: slide(['Topic'], ['Point']), notes: 'Remember to mention ATP' }]), 'a.pptx')
    expect(out.content_md).toContain('*Notes:* Remember to mention ATP')
    expect(out.content_md).not.toContain('- 1')
  })
  it('gives a slide with no text a plain heading, and the note a title from the file name when no slide has text', async () => {
    const out = await pptxToNote(await pptx([{ xml: slide() }, { xml: slide() }]), 'My Lecture.pptx')
    expect(out.title).toBe('My Lecture')
    expect(out.content_md).toContain('## Slide 1')
  })
  it('reads at most the first slides', async () => {
    const slides = Array.from({ length: MAX_SLIDES + 5 }, (_, i) => ({ xml: slide([`T${i + 1}`]) }))
    const out = await pptxToNote(await pptx(slides), 'big.pptx')
    expect(out.content_md.match(/## Slide /g)).toHaveLength(MAX_SLIDES)
    expect(out.notice).toMatch(/first 200 slides/)
  })
  it('skips a slide it cannot read and says so, rather than failing the whole deck', async () => {
    const out = await pptxToNote(await pptx([{ xml: slide(['Good one']) }, { xml: '<p:sld><broken' }, { xml: slide(['Good two']) }]), 'a.pptx')
    expect(out.content_md).toContain('Good one')
    expect(out.content_md).toContain('Good two')
    expect(out.notice).toMatch(/1 slide could not be read/)
  })
  it('rejects a file that is not a PowerPoint, one with no slides, and one that is too big', async () => {
    await expect(pptxToNote(new TextEncoder().encode('hello').buffer as ArrayBuffer, 'x.pptx')).rejects.toThrow()
    await expect(pptxToNote(await pptx([], { 'readme.txt': 'hi' }), 'x.pptx')).rejects.toThrow(/no slides/i)
    await expect(pptxToNote(new ArrayBuffer(101 * 1024 * 1024), 'x.pptx')).rejects.toThrow(/100 MB/)
  })
})

describe('textToNote', () => {
  const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
  it('uses the first heading as the title and keeps Markdown as it is', () => {
    const out = textToNote(bytes('# Enzymes\n\nThey speed up reactions.\nSecond line.\n'), 'notes.md')
    expect(out.title).toBe('Enzymes')
    expect(out.content_md).toBe('# Enzymes\n\nThey speed up reactions.\nSecond line.')
  })
  it('uses the file name when there is no heading', () => {
    const out = textToNote(bytes('Just some words.'), 'week 4 summary.txt')
    expect(out.title).toBe('week 4 summary')
    expect(out.content_md).toBe('Just some words.')
  })
  it('keeps the line breaks of a plain text file, drops indentation and does not turn dollar amounts into maths', () => {
    const out = textToNote(bytes('Mitosis\n    prophase\n    metaphase\n\nCost: $5 or $10'), 'terms.txt')
    expect(out.content_md).toBe('Mitosis  \nprophase  \nmetaphase\n\nCost: \\$5 or \\$10')
  })
  it('turns Windows line endings into plain ones and drops a byte order mark', () => {
    expect(textToNote(bytes('﻿Line one\r\nLine two\r\n'), 'a.md').content_md).toBe('Line one\nLine two')
  })
  it('reads a UTF-16 file saved by Windows Notepad', () => {
    const units = Array.from('Café notes').map(c => c.charCodeAt(0))
    const buf = new Uint8Array([0xff, 0xfe, ...units.flatMap(u => [u & 255, u >> 8])]).buffer
    expect(textToNote(buf, 'a.txt').content_md).toBe('Café notes')
  })
  it('reads an old Windows-1252 file with accents and curly quotes', () => {
    const buf = new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0x93, 0x68, 0x69, 0x94]).buffer // Café “hi”
    expect(textToNote(buf, 'a.md').content_md).toBe('Café “hi”')
  })
  it('refuses a file that is too big', () => {
    expect(() => textToNote(new ArrayBuffer(MAX_TEXT_BYTES + 1), 'big.txt')).toThrow(/1 MB/)
  })
  it('accepts an empty file and leaves it for the preview to say so', () => {
    expect(textToNote(bytes('  \n'), 'e.txt').content_md).toBe('')
  })
})
