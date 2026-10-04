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
vi.mock('@/lib/import/pdfImport', () => ({
  importPdf: (_f: File, _u: string, signal?: AbortSignal) => { lastSignal = signal; return pdfResult ? Promise.resolve(pdfResult) : new Promise(() => {}) },
}))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ImportDialog } from '@/components/notes/ImportDialog'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile

beforeAll(() => {
  // jsdom has no <dialog> methods
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); createNote.mockClear(); pdfResult = null; delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

function Harness() {
  const [open, setOpen] = React.useState(true)
  return (
    <>
      <button onClick={() => setOpen(true)}>reopen</button>
      <ImportDialog open={open} onClose={() => setOpen(false)} courses={[]} />
    </>
  )
}
import * as React from 'react'

const file = (name: string) => new File(['x'], name)

describe('ImportDialog', () => {
  it('a file that finishes reading after the dialog was closed does not reappear', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to import'), { target: { files: [file('a.docx')] } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel import' })) })
    await act(async () => { resolveDocx!({ title: 'Late', content_md: 'x' }) })
    await act(async () => { fireEvent.click(screen.getByText('reopen')) })
    expect(screen.queryByDisplayValue('Late')).toBeNull()
    expect(screen.getByText('Choose a Word document or PDF')).toBeTruthy()
  })

  it('a PDF over the free limit shows the Get Premium prompt with the plain text', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    pdfResult = { title: 'Week 3', content_md: 'Plain', via: 'text', notice: 'This PDF needs more AI actions than you have left today.', limit: 'daily_limit' }
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to import'), { target: { files: [file('a.pdf')] } }) })
    expect(screen.getByText('This PDF needs more AI actions than you have left today.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Get Premium/ }).getAttribute('href')).toBe('/plans')
  })

  it('cancelling a PDF import aborts the AI request', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to import'), { target: { files: [file('a.pdf')] } }) })
    expect(lastSignal?.aborted).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel import' })) })
    expect(lastSignal?.aborted).toBe(true)
  })

  it('double-clicking Save creates the note once', async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><Harness /></ToastProvider></ProfileProvider>)
    await act(async () => { fireEvent.change(screen.getByLabelText('File to import'), { target: { files: [file('b.docx')] } }) })
    await act(async () => { resolveDocx!({ title: 'B', content_md: 'body' }) })
    const save = screen.getByRole('button', { name: 'Save note' })
    await act(async () => { fireEvent.click(save); fireEvent.click(save) })
    expect(createNote).toHaveBeenCalledTimes(1)
  })
})
