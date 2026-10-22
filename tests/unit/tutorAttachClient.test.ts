// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const uploads: [string, Blob, unknown][] = []
const removed: string[][] = []
let uploadFails = false
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ storage: { from: () => ({
  upload: async (path: string, blob: Blob, o: unknown) => { uploads.push([path, blob, o]); return { error: uploadFails ? { message: 'no' } : null } },
  remove: async (paths: string[]) => { removed.push(paths); return { error: null } },
}) } }) }))
vi.mock('@/lib/import/docxToNote', () => ({ docxToNote: async () => ({ title: 'Notes', content_md: '# Notes\nMitosis has four phases.' }) }))
vi.mock('@/lib/import/pptxToNote', () => ({ pptxToNote: async () => { throw new Error('This file is damaged.') } }))
let pdfPages = 3
vi.mock('@/lib/scan/scanClient', () => ({ countPdfPagesInBrowser: async () => pdfPages, prepareImage: async () => new Blob(['small'], { type: 'image/jpeg' }) }))
import { addPending, readFile, uploadAttachments, type Pending } from '@/lib/tutor/attachClient'

const file = (name: string, type = '', size = 10) => { const f = new File(['x'.repeat(size)], name, { type }); return f }
beforeEach(() => { uploads.length = 0; removed.length = 0; uploadFails = false; pdfPages = 3 })

describe('readFile', () => {
  it('a photo is ready at once, with a picture to show', async () => {
    const p = await readFile(file('q1.png', 'image/png'))
    expect(p).toMatchObject({ kind: 'photo', name: 'q1.png', pages: 1 })
  })
  it('a PDF says how many pages it has', async () => {
    expect(await readFile(file('week3.pdf', 'application/pdf'))).toMatchObject({ kind: 'pdf', pages: 3 })
  })
  it('a Word document is read into text here', async () => {
    expect(await readFile(file('notes.docx'))).toMatchObject({ kind: 'document', text: '# Notes\nMitosis has four phases.' })
  })
  it('says why a file cannot be added', async () => {
    expect(await readFile(file('lecture.mp3', 'audio/mpeg'))).toEqual({ error: "Audio and video can't be added here. Record lectures in Lectures." })
    expect(await readFile(file('old.doc'))).toEqual({ error: "Old .doc files can't be read. Save it as .docx first." })
    expect(await readFile(file('x.exe'))).toEqual({ error: 'Add photos (JPEG, PNG, WebP), PDFs, or Word, PowerPoint and text files.' })
    expect(await readFile(file('slides.pptx'))).toEqual({ error: 'This file is damaged.' })
    expect(await readFile(file('big.pdf', 'application/pdf', 25 * 1024 * 1024))).toEqual({ error: 'This PDF is larger than 24 MB.' })
  })
})

describe('addPending', () => {
  const photo = (n: number): Pending => ({ id: `p${n}`, kind: 'photo', name: `p${n}.jpg`, pages: 1, file: file(`p${n}.jpg`, 'image/jpeg') })
  it('adds up to four, and says so after that', () => {
    const four = [photo(1), photo(2), photo(3), photo(4)]
    expect(addPending(four.slice(0, 3), photo(4))).toEqual({ list: four })
    expect(addPending(four, photo(5))).toEqual({ list: four, error: 'Up to 4 files a message.' })
  })
  it('keeps photos and PDF pages to 10 together', () => {
    const pdf: Pending = { id: 'd', kind: 'pdf', name: 'w.pdf', pages: 10, file: file('w.pdf', 'application/pdf') }
    expect(addPending([photo(1)], pdf).error).toBe('Up to 10 photos and PDF pages a message. This one would make 11.')
  })
})

describe('uploadAttachments', () => {
  it('shrinks and uploads photos and PDFs into the chat\'s folder, and sends documents as text', async () => {
    const list: Pending[] = [
      { id: 'a', kind: 'photo', name: 'q.png', pages: 1, file: file('q.png', 'image/png') },
      { id: 'b', kind: 'pdf', name: 'w.pdf', pages: 2, file: file('w.pdf', 'application/pdf') },
      { id: 'c', kind: 'document', name: 'n.docx', text: 'Mitosis' },
    ]
    const out = await uploadAttachments(list, 'u1', 'c1')
    expect(uploads.map(u => u[0])).toEqual([expect.stringMatching(/^u1\/c1\/[0-9a-f-]{36}\.jpg$/), expect.stringMatching(/^u1\/c1\/[0-9a-f-]{36}\.pdf$/)])
    expect(uploads[0][2]).toEqual({ contentType: 'image/jpeg' })
    expect(out).toEqual([
      { kind: 'photo', name: 'q.png', path: uploads[0][0], pages: 1 },
      { kind: 'pdf', name: 'w.pdf', path: uploads[1][0], pages: 2 },
      { kind: 'document', name: 'n.docx', text: 'Mitosis' },
    ])
  })
  it('uploads a file only once when it is sent again', async () => {
    const sent = { kind: 'photo' as const, name: 'q.png', path: 'u1/c1/x.jpg', pages: 1 as const }
    const out = await uploadAttachments([{ id: 'a', kind: 'photo', name: 'q.png', pages: 1, sent }], 'u1', 'c1')
    expect(uploads).toEqual([])
    expect(out).toEqual([sent])
  })
  it('stops when an upload fails, and removes what it had uploaded', async () => {
    const list: Pending[] = [{ id: 'a', kind: 'photo', name: 'q.png', pages: 1, file: file('q.png', 'image/png') }]
    uploadFails = true
    await expect(uploadAttachments(list, 'u1', 'c1')).rejects.toThrow("Couldn't upload your files. Check your connection and try again.")
  })
})
