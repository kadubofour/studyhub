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
import { UploadDialog } from '@/components/notes/UploadDialog'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile

beforeAll(() => {
  // jsdom has no <dialog> methods
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); createNote.mockClear(); onScan.mockClear(); router.push.mockClear(); pptxFails = false; pdfResult = null; delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

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

describe('UploadDialog', () => {
  it('a file that finishes reading after the dialog was closed does not reappear', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.docx')] } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' })) })
    await act(async () => { resolveDocx!({ title: 'Late', content_md: 'x' }) })
    await act(async () => { fireEvent.click(screen.getByText('reopen')) })
    expect(screen.queryByDisplayValue('Late')).toBeNull()
    expect(screen.getByText('Choose a file')).toBeTruthy()
  })

  it('a PDF over the free limit shows the Get Premium prompt with the plain text', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    pdfResult = { title: 'Week 3', content_md: 'Plain', via: 'text', notice: 'This PDF needs more AI actions than you have left today.', limit: 'daily_limit' }
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.pdf')] } }) })
    expect(screen.getByText('This PDF needs more AI actions than you have left today.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Get Premium/ }).getAttribute('href')).toBe('/plans')
  })

  it('cancelling a PDF upload aborts the AI request', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('a.pdf')] } }) })
    expect(lastSignal?.aborted).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' })) })
    expect(lastSignal?.aborted).toBe(true)
  })

  it('double-clicking Save creates the note once', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('b.docx')] } }) })
    await act(async () => { resolveDocx!({ title: 'B', content_md: 'body' }) })
    const save = screen.getByRole('button', { name: 'Save note' })
    await act(async () => { fireEvent.click(save); fireEvent.click(save) })
    expect(createNote).toHaveBeenCalledTimes(1)
  })

  const upload = async (f: File) => { render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>); await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [f] } }) }) }

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
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false)
  })
  it('asks the app to open Scan when no hand-off is given, so a photo works from any page', async () => {
    const heard = vi.fn()
    window.addEventListener('studyhub:open-scan', heard)
    render(<ProfileProvider initial={profile}><ToastProvider><UploadDialog open onClose={() => {}} courses={[]} /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [file('board.jpg')] } }) })
    expect(heard).toHaveBeenCalledTimes(1)
    window.removeEventListener('studyhub:open-scan', heard)
  })
  it('points a recording to Lectures', async () => {
    await upload(file('talk.mp3'))
    expect(screen.getByText(/recorded or uploaded in Lectures/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go to Lectures' })) })
    expect(router.push).toHaveBeenCalledWith('/lectures')
  })
  it('says which files it can read when given another kind', async () => {
    await upload(file('old.doc'))
    expect(screen.getByRole('alert').textContent).toContain('PDF, Word, PowerPoint or text')
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
})
