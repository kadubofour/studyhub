// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const ID = '7d1f5c2a-4b6e-4c8d-9a0b-1c2d3e4f5a6b'
let lecture: Record<string, unknown>
let accurateParam: string | null = null
const push = vi.fn()
const updateLecture = vi.fn(async (...a: unknown[]) => { void a })
const deleteLecture = vi.fn(async (...a: unknown[]) => { void a })
const createNote = vi.fn(async (...a: unknown[]) => { void a; return { id: 'n1' } })
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/lectures', () => ({
  getLecture: async () => lecture, partUrls: async () => ['https://x/0', 'https://x/1'],
  updateLecture: (...a: unknown[]) => updateLecture(...a), deleteLecture: (...a: unknown[]) => deleteLecture(...a),
}))
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: ID }), useSearchParams: () => ({ get: () => accurateParam }) }))
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import LecturePage from '@/app/(app)/lectures/[id]/page'
import { runAccurate } from '@/lib/lectures/accurate'

const part = (i: number, transcribed = false) => ({ path: `u1/${ID}-${i}.webm`, start: i * 1200, duration: 1200, bytes: 1, transcribed })
const fetchMock = vi.fn()
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(async () => {}); HTMLMediaElement.prototype.pause = vi.fn()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => {
  lecture = { id: ID, course_id: null, title: 'Krebs cycle', recorded_at: '2026-10-03T09:00:00Z', duration_seconds: 2400, audio_bytes: 2, mime: 'audio/webm',
    parts: [part(0), part(1)], transcript: [{ start: 0, end: 3, text: 'Welcome.' }], transcript_status: 'live', transcript_source: 'browser', note_id: null }
  accurateParam = null; push.mockClear(); updateLecture.mockClear(); createNote.mockClear(); deleteLecture.mockClear()
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const open = async () => { await act(async () => { render(<ConfirmProvider><LecturePage /></ConfirmProvider>) }) }

describe('runAccurate', () => {
  it('transcribes the unfinished parts in order, reporting progress', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 'done', done: 2, total: 2 }))
    const progress: [number, number][] = []
    expect(await runAccurate({ id: ID, parts: [part(0, true), part(1)] }, { onProgress: (d, t) => progress.push([d, t]) })).toEqual({ ok: true })
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([`/api/lectures/${ID}/transcribe?part=1`])
    expect(progress).toEqual([[1, 2], [2, 2]])
  })
  it('stops at a failed part with the reason', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'premium_required' }, 402))
    expect(await runAccurate({ id: ID, parts: [part(0)] }, { onProgress: vi.fn() })).toMatchObject({ ok: false, code: 'premium_required' })
  })
})

describe('Lecture page', () => {
  it('shows the lecture, its live transcript and the player', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Krebs cycle' })).toBeTruthy()
    expect(screen.getByText('Live transcript (free)')).toBeTruthy()
    expect(screen.getByRole('button', { name: /0:00 Welcome\./ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
  it('gets an accurate transcript part by part, then shows it', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 'processing', done: 1, total: 2 })).mockResolvedValueOnce(reply({ status: 'done', done: 2, total: 2 }))
    await open()
    lecture = { ...lecture, transcript: [{ start: 0, end: 2, text: 'Accurate welcome.' }], transcript_status: 'done', transcript_source: 'openai', parts: [part(0, true), part(1, true)] }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '↻ Get accurate transcript' })) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: /Accurate welcome/ })).toBeTruthy()
    expect(screen.getByText('Accurate transcript')).toBeTruthy()
  })
  it('a failed part offers to resume from where it stopped, keeping the live transcript', async () => {
    lecture = { ...lecture, parts: [part(0, true), part(1)], transcript_status: 'failed' }
    await open()
    expect(screen.getByText(/Transcript failed/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /0:00 Welcome\./ })).toBeTruthy()
    fetchMock.mockResolvedValueOnce(reply({ status: 'done', done: 2, total: 2 }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '↻ Resume accurate transcript (1 of 2 parts done)' })) })
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([`/api/lectures/${ID}/transcribe?part=1`])
  })
  it('on Free, asking for an accurate transcript says it\'s a Premium feature', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'premium_required' }, 402))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '↻ Get accurate transcript' })) })
    expect(screen.getByText('This is a Premium feature')).toBeTruthy()
  })
  it('starts the accurate transcript on arrival when it was chosen before recording', async () => {
    accurateParam = '1'
    fetchMock.mockResolvedValue(reply({ status: 'processing', done: 1, total: 2 }))
    await open()
    expect(fetchMock).toHaveBeenCalled()
  })
  it('makes a note from the transcript, links it to the lecture and opens it', async () => {
    fetchMock.mockResolvedValueOnce(reply({ title: 'Krebs cycle notes', content_md: '## Matrix', truncated: false }))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '✦ Make a note' })) })
    expect(createNote.mock.calls[0][1]).toEqual({ title: 'Krebs cycle notes', content_md: '## Matrix', course_id: null })
    expect(updateLecture).toHaveBeenCalledWith(expect.anything(), ID, { note_id: 'n1' })
    expect(push).toHaveBeenCalledWith('/notes/n1')
  })
  it('a lecture with a note links to it', async () => {
    lecture = { ...lecture, note_id: 'n7' }
    await open()
    expect(screen.getByRole('link', { name: 'Open note' }).getAttribute('href')).toBe('/notes/n7')
  })
  it('deletes the lecture and its audio after confirming', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete lecture' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
    expect(deleteLecture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: ID }))
    expect(push).toHaveBeenCalledWith('/lectures')
  })
})
