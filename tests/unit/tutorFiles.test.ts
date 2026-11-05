import { beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { fileLine, filesAsked, tutorFiles, type FileRow } from '@/lib/ai/tutorFiles'
import { MAX_MATERIAL_TEXT, materialText } from '@/lib/import/materialText'
import { buildContext } from '@/lib/ai/tutorContext'

const PDF = 'application/pdf'
const row = (id: string, name: string, over: Partial<FileRow> = {}): FileRow => ({ id, course_id: null, note_id: null, name, mime: PDF, path: `u/${id}.pdf`, bytes: 10, body_status: 'ready', created_at: '', ...over })

// A real PDF with a line of text on each page, with no cross-reference table: pdf.js rebuilds it
function pdfBytes(lines: string[]): Uint8Array {
  const kids = lines.map((_, i) => `${3 + i * 2} 0 R`).join(' ')
  const objs = ['1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', `2 0 obj<</Type/Pages/Kids[${kids}]/Count ${lines.length}>>endobj`]
  lines.forEach((line, i) => {
    const stream = `BT /F1 12 Tf 20 100 Td (${line}) Tj ET`
    objs.push(`${3 + i * 2} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents ${4 + i * 2} 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj`)
    objs.push(`${4 + i * 2} 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`)
  })
  return new TextEncoder().encode(`%PDF-1.4\n${objs.join('\n')}\ntrailer<</Root 1 0 R>>\n%%EOF`)
}

describe('taking the text out of a kept file', () => {
  it('reads a PDF, saying which page each part is from', async () => {
    const text = await materialText(pdfBytes(['The Krebs cycle runs in the mitochondrial matrix of the cell', 'Oxidative phosphorylation follows it across the membrane']), PDF)
    expect(text).toContain('[Page 1]')
    expect(text).toContain('mitochondrial matrix')
    expect(text).toContain('[Page 2]')
    expect(text).toContain('Oxidative phosphorylation')
  })
  it('gives nothing for a PDF with no real text (a scan)', async () => {
    expect(await materialText(pdfBytes(['']), PDF)).toBe('')
    expect(await materialText(pdfBytes(['x']), PDF)).toBe('')
  })
  it('reads slides in order, by slide number', async () => {
    const zip = new JSZip()
    const slide = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`
    zip.file('ppt/slides/slide10.xml', slide('Tenth slide with several more words in it'))
    zip.file('ppt/slides/slide2.xml', slide('Second slide about bonds &amp; energy here'))
    const text = await materialText(await zip.generateAsync({ type: 'uint8array' }), 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(text.indexOf('[Slide 2]')).toBeLessThan(text.indexOf('[Slide 10]'))
    expect(text).toContain('bonds & energy')
  })
  it('reads text files, takes out what the database cannot hold, and keeps within the limit', async () => {
    const bytes = (s: string) => new TextEncoder().encode(s)
    expect(await materialText(bytes('one two three\u0000 four five six seven eight'), 'text/plain')).toBe('one two three four five six seven eight')
    expect((await materialText(bytes('word '.repeat(MAX_MATERIAL_TEXT)), 'text/markdown')).length).toBe(MAX_MATERIAL_TEXT)
  })
  it('has nothing to say about a photo', async () => {
    expect(await materialText(new Uint8Array([1, 2, 3]), 'image/jpeg')).toBe('')
  })
})

describe('which files a message is about', () => {
  const week3 = row('a', 'Week 3 Thermodynamics.pdf'), krebs = row('b', 'krebs.pdf'), slides = row('c', 'lecture slides.pptx')
  const all = [week3, krebs, slides]
  it('finds a file by its name, with or without the extension, in any case', () => {
    expect(filesAsked('summarise KREBS please', all, all)).toEqual([krebs])
    expect(filesAsked('what is in krebs.pdf?', all, all)).toEqual([krebs])
    expect(filesAsked('explain week 3 thermodynamics', all, all)).toEqual([week3])
  })
  it('finds a file by all its telling words, in any order', () => {
    expect(filesAsked('the thermodynamics one from week three', [row('d', 'thermodynamics week three.pdf')], [])).toHaveLength(1)
  })
  it('takes "the PDF" to mean the newest in the chat\'s course, and a general question to mean no file', () => {
    expect(filesAsked('can you go through the PDF?', all, [slides, krebs])).toEqual([slides])
    expect(filesAsked('why does entropy increase?', all, all)).toEqual([])
    expect(filesAsked('go through the PDF', all, [])).toEqual([])
  })
  it('does not mistake one common word of a name for the file', () => {
    expect(filesAsked('what are lecture notes for?', [row('e', 'lecture notes.pdf')], [])).toEqual([])
  })
  it('names at most two', () => {
    const many = [row('1', 'alpha.pdf'), row('2', 'beta.pdf'), row('3', 'gamma.pdf')]
    expect(filesAsked('compare alpha beta gamma', many, many)).toHaveLength(2)
  })
})

describe('what the tutor is told', () => {
  it('says what kind of file each is, and when it has no text', () => {
    expect(fileLine(row('a', 'x.pdf'))).toBe('x.pdf (PDF)')
    expect(fileLine(row('a', 'x.pdf', { body_status: 'no_text' }))).toBe('x.pdf (PDF, no text in it)')
  })
  it('lists the files, gives a named one the room of an attached note and names it as a source, and does not repeat it', () => {
    const text = 'y'.repeat(9000)
    const c = buildContext({ attached: null, courses: [], decks: [], files: ['week3.pdf (PDF)', 'a<b.pdf (PDF)'], named: [{ kind: 'file', id: 'f1', title: 'week3.pdf', text }], matches: [{ kind: 'file', id: 'f1', title: 'week3.pdf', text: 'short' }] })
    expect(c.text).toContain('<files>\n- week3.pdf (PDF)\n- a‹b.pdf (PDF)\n</files>')
    expect(c.text).toContain(text)
    expect(c.sources).toEqual([{ kind: 'file', id: 'f1', title: 'week3.pdf' }])
  })
})

describe('tutorFiles', () => {
  let rows: FileRow[], bodies: Record<string, string>, files: Record<string, Uint8Array>
  const updates: [string, unknown][] = []
  const downloads: string[] = []
  const sb = () => ({
    storage: { from: () => ({ download: async (p: string) => { downloads.push(p); return p in files ? { data: new Blob([files[p] as BlobPart]) } : { data: null } } }) },
    from: () => ({
      select: (cols: string) => cols === 'body'
        ? { eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: { body: bodies[id] } }) }) }
        : { order: () => ({ limit: async () => ({ data: rows }) }) },
      update: (patch: unknown) => ({ eq: async (_c: string, id: string) => { updates.push([id, patch]) } }),
    }),
  }) as never
  const TEXT = new TextEncoder().encode('The citric acid cycle makes carriers of energy for the cell')
  beforeEach(() => { rows = []; bodies = {}; files = {}; updates.length = 0; downloads.length = 0 })

  it('reads a file for the first time and keeps its text, so it never has to be read again', async () => {
    rows = [row('a', 'cycle.txt', { mime: 'text/plain', body_status: 'pending', path: 'u/a' })]
    files = { 'u/a': TEXT }
    const got = await tutorFiles(sb(), { courseId: null, message: 'what is in cycle?' })
    expect(updates).toEqual([['a', { body: expect.stringContaining('citric acid'), body_status: 'ready' }]])
    expect(got.named).toEqual([{ kind: 'file', id: 'a', title: 'cycle.txt', text: expect.stringContaining('citric acid') }])
    downloads.length = 0
    rows[0].body_status = 'ready'; bodies.a = 'kept text'
    expect((await tutorFiles(sb(), { courseId: null, message: 'what is in cycle?' })).named[0].text).toBe('kept text')
    expect(downloads).toEqual([])
  })
  it('marks a PDF with no text, and hands it over to be read as it is when asked about', async () => {
    rows = [row('a', 'scan.pdf', { body_status: 'pending', path: 'u/a' })]
    files = { 'u/a': pdfBytes(['']) }
    const got = await tutorFiles(sb(), { courseId: null, message: 'read scan please' })
    expect(updates).toEqual([['a', { body: null, body_status: 'no_text' }]])
    expect(got.named).toEqual([])
    expect(got.scanned.map(f => f.id)).toEqual(['a'])
    expect(got.list).toEqual(['scan.pdf (PDF, no text in it)'])
  })
  it('leaves a file that cannot be fetched to be tried again', async () => {
    rows = [row('a', 'gone.txt', { mime: 'text/plain', body_status: 'pending', path: 'u/a' })]
    await tutorFiles(sb(), { courseId: null, message: 'hello' })
    expect(updates).toEqual([])
  })
  it('reads only a few on one message, the chat\'s course first, and leaves out ones with a note unless asked', async () => {
    const pending = (id: string, over: Partial<FileRow> = {}) => row(id, `${id}.txt`, { mime: 'text/plain', body_status: 'pending', path: `u/${id}`, ...over })
    rows = [pending('o1'), pending('o2'), pending('o3'), pending('o4'), pending('c1', { course_id: 'C' }), pending('c2', { course_id: 'C' }), pending('noted', { note_id: 'n' })]
    files = Object.fromEntries(rows.map(r => [r.path, TEXT]))
    const got = await tutorFiles(sb(), { courseId: 'C', message: 'hello' })
    expect(updates.map(u => u[0])).toEqual(['c1', 'c2', 'o1', 'o2', 'o3'])
    expect(got.list.map(l => l.split('.')[0])).toEqual(['c1', 'c2']) // it sees the chat's course's files
  })
  it('never stops the tutor: a failure means no files', async () => {
    const broken = { from: () => { throw new Error('down') } } as never
    expect(await tutorFiles(broken, { courseId: null, message: 'x' })).toEqual({ list: [], named: [], scanned: [] })
  })
})
vi.mock('server-only', () => ({}))
