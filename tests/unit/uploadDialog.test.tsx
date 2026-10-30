// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Profile } from '@/lib/types'

let resolveDocx: ((n: { title: string; content_md: string }) => void) | null = null
let lastSignal: AbortSignal | undefined
let pdfResult: Record<string, unknown> | null = null
const createNote = vi.fn(async () => ({ id: 'new' }))

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ createNote: () => createNote() }))
const keepMaterial = vi.fn(async (..._a: unknown[]) => ({ id: 'kept' }))
const updateMaterial = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/materials', async importOriginal => ({ ...(await importOriginal<object>()), keepMaterial: (...a: unknown[]) => keepMaterial(...a), updateMaterial: (...a: unknown[]) => updateMaterial(...a) }))
vi.mock('@/lib/import/docxToNote', () => ({ docxToNote: () => new Promise(r => { resolveDocx = r }) }))
let pptxFails = false
vi.mock('@/lib/import/pptxToNote', () => ({ pptxToNote: async (_b: ArrayBuffer, name: string) => { if (pptxFails) throw new Error('This file is damaged.'); return { title: 'Deck ' + name, content_md: '## Slide 1: Intro' } } }))
vi.mock('@/lib/import/pdfImport', () => ({
  importPdf: (_f: File, _u: string, signal?: AbortSignal) => { lastSignal = signal; return pdfResult ? Promise.resolve(pdfResult) : new Promise(() => {}) },
}))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { setRecording } from '@/lib/lectures/recordingGuard'
import { UploadDialog } from '@/components/notes/UploadDialog'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile

beforeAll(() => {
  // jsdom has no <dialog> methods
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); createNote.mockClear(); keepMaterial.mockClear(); updateMaterial.mockClear(); lastSignal = undefined; onScan.mockClear(); router.push.mockClear(); pptxFails = false; setRecording(false); pdfResult = null; delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

const onScan = vi.fn()
function Harness() {
  const [open, setOpen] = React.useState(true)
  return (
    <>
      <button onClick={() => setOpen(true)}>reopen</button>
      <UploadDialog open={open} onClose={() => setOpen(false)} courses={[]} onScan={onScan} />
    </>
  )
}
import * as React from 'react'

const file = (name: string) => new File(['x'], name)
// After a file is chosen the dialog asks what to do with it; these tests make a note
const note = async () => { const b = screen.queryByRole('button', { name: /^Make a note/ }); if (b) await act(async () => { fireEvent.click(b) }) }

describe('UploadDialog', () => {
  it('a file that finishes reading after the dialog was closed does not reappear', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.docx')] } }) }); await note()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' })) })
    await act(async () => { resolveDocx!({ title: 'Late', content_md: 'x' }) })
    await act(async () => { fireEvent.click(screen.getByText('reopen')) })
    expect(screen.queryByDisplayValue('Late')).toBeNull()
    expect(screen.getByText('Choose a file')).toBeTruthy()
  })

  it('a PDF over the free limit shows the Get Premium prompt with the plain text', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    pdfResult = { title: 'Week 3', content_md: 'Plain', via: 'text', notice: 'This PDF needs more AI actions than you have left today.', limit: 'daily_limit' }
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.pdf')] } }) }); await note()
    expect(screen.getByText('This PDF needs more AI actions than you have left today.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Get Premium/ }).getAttribute('href')).toBe('/plans')
  })

  it('cancelling a PDF upload aborts the AI request', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.pdf')] } }) }); await note()
    expect(lastSignal?.aborted).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' })) })
    expect(lastSignal?.aborted).toBe(true)
  })

  it('double-clicking Save creates the note once', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('b.docx')] } }) }); await note()
    await act(async () => { resolveDocx!({ title: 'B', content_md: 'body' }) })
    const save = screen.getByRole('button', { name: 'Save note' })
    await act(async () => { fireEvent.click(save); fireEvent.click(save) })
    expect(createNote).toHaveBeenCalledTimes(1)
  })

  const upload = async (f: File) => { render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>); await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [f] } }) }); await note() }

  it('reads a PowerPoint in the browser and shows it for review', async () => {
    await upload(file('week3.pptx'))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Deck week3.pptx')
    expect(screen.getByLabelText('Preview').textContent).toContain('Slide 1: Intro')
    expect(screen.queryByText(/Structured by AI/)).toBeNull()
  })
  it('reads a text file and uses its heading as the title', async () => {
    await upload(new File(['# Enzymes' + String.fromCharCode(10, 10) + 'They speed things up.'], 'e.md'))
    expect(((await screen.findByLabelText('Title')) as HTMLInputElement).value).toBe('Enzymes')
    expect(screen.getByLabelText('Preview').textContent).toContain('They speed things up.')
  })
  it('hands a photo to Scan and closes without reading it', async () => {
    await upload(file('board.jpg'))
    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan.mock.calls[0][0]).toHaveLength(1) // the photo goes with it, so the student does not pick it again
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false)
  })
  it('asks the app to open Scan when no hand-off is given, so a photo works from any page', async () => {
    const heard = vi.fn((e: Event) => (e as CustomEvent<File[]>).detail)
    window.addEventListener('studyhub:open-scan', heard)
    render(<ProfileProvider initial={profile}><ToastProvider><UploadDialog open onClose={() => {}} courses={[]} /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('board.jpg')] } }) }); await note()
    expect(heard).toHaveBeenCalledTimes(1)
    expect(heard.mock.results[0].value).toHaveLength(1)
    window.removeEventListener('studyhub:open-scan', heard)
  })
  it('points a recording to Lectures', async () => {
    await upload(file('talk.mp3'))
    expect(screen.getByText(/can.t be uploaded yet/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go to Lectures' })) })
    expect(router.push).toHaveBeenCalledWith('/lectures')
  })
  it('says which files it can read when given another kind', async () => {
    await upload(file('data.xlsx'))
    expect(screen.getByRole('alert').textContent).toContain('PDF, Word, PowerPoint or text')
  })
  it('tells a student with an old Word or PowerPoint file how to fix it', async () => {
    await upload(file('old.ppt'))
    expect(screen.getByRole('alert').textContent).toContain('save it as .pptx')
    cleanup()
    await upload(file('old.doc'))
    expect(screen.getByRole('alert').textContent).toContain('save it as .docx')
  })
  it('asks before leaving a recording, and saves nothing if the student stays', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    setRecording(true)
    await upload(file('b.pptx'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(screen.getByText('Stop recording?')).toBeTruthy()
    expect(createNote).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(createNote).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
  it('saves and leaves once the student confirms leaving a recording', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    setRecording(true)
    await upload(file('b.pptx'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Leave' })) })
    expect(createNote).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith('/notes/new')
  })
  it('opens the note by default after saving', async () => {
    await upload(file('b.pptx'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(router.push).toHaveBeenCalledWith('/notes/new')
  })
  it.each([['Open with Summary', 'summary'], ['Open with Flashcards', 'cards'], ['Open with Quiz', 'quiz']])('can open the note on a study tab: %s', async (label, tab) => {
    await upload(file('b.pptx'))
    fireEvent.click(screen.getByRole('radio', { name: label }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(router.push).toHaveBeenCalledWith(`/notes/new?study=${tab}`)
  })
  it('shows a file that cannot be read as one plain message and lets the student choose another', async () => {
    pptxFails = true
    await upload(file('broken.pptx'))
    expect(screen.getByRole('alert').textContent).toContain('read that file')
    expect(screen.getByLabelText('File to upload')).toBeTruthy()
  })

  it('takes a file dropped on it, like one that was chosen', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    const zone = screen.getByRole('group', { name: 'Drop a file here' })
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } })
    expect(zone.getAttribute('data-dragging')).toBe('true')
    await act(async () => { fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file('board.jpg')] } }) }); await note()
    expect(onScan).toHaveBeenCalledTimes(1) // a dropped photo goes to Scan
  })

  it('asks what to do with a chosen file, and can just keep it in the Library without reading it', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('week3.pdf')] } }) })
    expect(screen.getByText('week3.pdf')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Just keep the file/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep file' })) })
    expect(keepMaterial).toHaveBeenCalledTimes(1)
    expect(keepMaterial.mock.calls[0][3]).toBe('pdf')
    expect(keepMaterial.mock.calls[0][4]).toEqual({ course_id: null, note_id: null })
    expect(lastSignal).toBeUndefined() // nothing was read by AI
    expect(createNote).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith('/files/kept')
  })
  it('keeps a photo as a file instead of sending it to Scan, when asked to', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('board.jpg')] } }) })
    expect(onScan).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Just keep the file/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep file' })) })
    expect(keepMaterial.mock.calls[0][3]).toBe('image')
  })
  it('keeps the original beside a note made from it', async () => {
    await upload(file('b.pptx'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(keepMaterial.mock.calls[0][4]).toEqual({ course_id: null, note_id: 'new' })
  })
  it('only keeps, with no question, when opened from the Library\'s Upload file', async () => {
    const kept = vi.fn()
    render(<ProfileProvider initial={profile}><ToastProvider><UploadDialog open keepOnly onClose={() => {}} onKept={kept} courses={[]} /></ToastProvider></ProfileProvider>)
    expect(screen.queryByText(/Photos of notes or slides/)).toBeNull()
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.docx')] } }) })
    expect(screen.queryByRole('button', { name: /Make a note/ })).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep file' })) })
    expect(keepMaterial).toHaveBeenCalledTimes(1)
    expect(kept).toHaveBeenCalledTimes(1)
    expect(router.push).not.toHaveBeenCalled() // the Library reloads instead
  })
  it('makes a note from a file the Library already keeps, pointing the file at it instead of keeping it again', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><UploadDialog open onClose={() => {}} courses={[]} fromMaterial={{ id: 'm1', file: new File(['x'], 'w.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) }} /></ConfirmProvider></ToastProvider></ProfileProvider>)
    expect(screen.queryByRole('button', { name: /Just keep the file/ })).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Make a note from it/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(keepMaterial).not.toHaveBeenCalled()
    expect(updateMaterial).toHaveBeenCalledWith(expect.anything(), 'm1', { note_id: 'new' })
  })

  it('offers Scan for photos and Lectures for recordings from the first screen', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><Harness /></ConfirmProvider></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Photos of notes or slides/ })) })
    expect(onScan).toHaveBeenCalledWith([])
  })
})
