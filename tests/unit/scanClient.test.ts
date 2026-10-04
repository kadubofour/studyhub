// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const uploads: { path: string; type: string }[] = []
const removed: string[][] = []
let failUploadNo = 0
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ storage: { from: () => ({
  upload: async (...a: unknown[]) => {
    const [path, , o] = a as [string, Blob, { contentType: string }]
    uploads.push({ path, type: o.contentType })
    return { error: uploads.length === failUploadNo ? { message: 'down' } : null }
  },
  remove: async (paths: string[]) => { removed.push(paths); return { error: null } },
}) } }) }))
import { addFiles, fitWithin, prepareImage, runScan } from '@/lib/scan/scanClient'

const photo = (name: string, type = 'image/jpeg') => new File(['x'], name, { type })
const pdf = (name = 'w.pdf', size = 10) => new File([new Uint8Array(size)], name, { type: 'application/pdf' })
const count = (n: number) => async () => n
const prepare = async (f: File) => new Blob([`small ${f.name}`], { type: 'image/jpeg' })
const fetchMock = vi.fn()
const reply = (body: object, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))
beforeEach(() => { uploads.length = 0; removed.length = 0; failUploadNo = 0; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('addFiles', () => {
  it('adds photos as one page each, in order', async () => {
    const r = await addFiles([], [photo('a.jpg'), photo('b.png', 'image/png')], count(0))
    expect(r.error).toBeNull()
    expect(r.pages.map(p => [p.file.name, p.kind, p.pages])).toEqual([['a.jpg', 'image', 1], ['b.png', 'image', 1]])
  })
  it('adds one PDF, counted by its pages', async () => {
    expect((await addFiles([], [pdf()], count(4))).pages[0]).toMatchObject({ kind: 'pdf', pages: 4 })
  })
  it('refuses, with the reason, before anything is uploaded', async () => {
    const one = (await addFiles([], [photo('a.jpg')], count(0))).pages
    expect((await addFiles([], [photo('a.heic', 'image/heic')], count(0))).error).toBe('Use photos (JPEG, PNG or WebP) or a PDF.')
    expect((await addFiles(one, [pdf()], count(2))).error).toBe('Scan either photos or one PDF, not both.')
    expect((await addFiles([], [pdf()], count(12))).error).toBe('This PDF has 12 pages; Scan reads up to 10. Use Import for longer PDFs.')
    expect((await addFiles([], [pdf('big.pdf', 25 * 1024 * 1024)], count(1))).error).toBe('This PDF is larger than 24 MB.')
    expect((await addFiles([], Array.from({ length: 11 }, (_, i) => photo(`${i}.jpg`)), count(0))).error).toBe('Up to 10 pages per scan.')
    expect((await addFiles([], [pdf()], async () => { throw new Error('bad') })).error).toBe('Couldn\'t open this PDF.')
    expect(uploads).toEqual([])
  })
  it('keeps the pages already added when a later file is refused', async () => {
    const r = await addFiles([], [photo('a.jpg'), photo('x.gif', 'image/gif')], count(0))
    expect(r.pages).toHaveLength(1)
    expect(r.error).not.toBeNull()
  })
})

describe('fitWithin', () => {
  it('shrinks big photos to 2000 px on the long side and leaves small ones alone', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 })
    expect(fitWithin(1500, 3000)).toEqual({ width: 1000, height: 2000 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('prepareImage', () => {
  it('paints transparent areas white, so a transparent screenshot isn\'t sent as a black page', async () => {
    const calls: string[] = []
    const ctx = { set fillStyle(v: string) { calls.push(`fillStyle ${v}`) }, fillRect: () => calls.push('fillRect'), drawImage: () => calls.push('drawImage') }
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob) => void) => cb(new Blob(['jpg'], { type: 'image/jpeg' })) }
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : realCreate(tag))) as typeof document.createElement)
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 3000, close: () => {} }))
    await prepareImage(photo('shot.png', 'image/png'))
    expect(calls).toEqual(['fillStyle #ffffff', 'fillRect', 'drawImage'])
    expect([canvas.width, canvas.height]).toEqual([2000, 1500])
    vi.restoreAllMocks()
  })
})

describe('runScan', () => {
  const photos = async () => (await addFiles([], [photo('a.jpg'), photo('b.jpg')], count(0))).pages
  const base = { userId: 'u1', today: '2026-10-04', prepare }

  it('uploads the shrunk pages in order to the student\'s folder, reads them, then deletes the uploads', async () => {
    reply({ cards: [{ front: 'A', back: 'B' }] })
    const r = await runScan({ ...base, pages: await photos(), target: 'cards' })
    expect(r).toEqual({ ok: true, value: { cards: [{ front: 'A', back: 'B' }] } })
    expect(uploads.map(u => u.path)).toEqual([expect.stringMatching(/^u1\/[0-9a-f-]{36}-scan-1\.jpg$/), expect.stringMatching(/^u1\/[0-9a-f-]{36}-scan-2\.jpg$/)])
    expect(uploads.every(u => u.type === 'image/jpeg')).toBe(true)
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ paths: uploads.map(u => u.path), target: 'cards', today: '2026-10-04' })
    expect(removed).toEqual([uploads.map(u => u.path)])
  })
  it('uploads a PDF as it is', async () => {
    reply({ title: 'T', content_md: '', truncated: false })
    await runScan({ ...base, pages: (await addFiles([], [pdf()], count(2))).pages, target: 'note' })
    expect(uploads[0]).toMatchObject({ path: expect.stringMatching(/-scan-1\.pdf$/), type: 'application/pdf' })
  })
  it('explains unreadable pages in Scan\'s own words', async () => {
    reply({ error: 'refused' }, 422)
    expect(await runScan({ ...base, pages: await photos(), target: 'note' }))
      .toEqual({ ok: false, code: 'refused', message: 'Couldn\'t read these pages. Try clearer photos.' })
    expect(removed).toHaveLength(1)
  })
  it('stops at a failed upload and deletes what was already uploaded', async () => {
    failUploadNo = 2
    expect(await runScan({ ...base, pages: await photos(), target: 'note' })).toMatchObject({ ok: false, code: 'upload_failed' })
    expect(removed).toEqual([[uploads[0].path]])
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('says when a photo can\'t be read, without uploading', async () => {
    const bad = async () => { throw new Error('Couldn\'t read one of the photos. Try taking it again.') }
    expect(await runScan({ ...base, prepare: bad, pages: await photos(), target: 'note' }))
      .toEqual({ ok: false, code: 'photo', message: 'Couldn\'t read one of the photos. Try taking it again.' })
    expect(uploads).toEqual([])
  })
})
