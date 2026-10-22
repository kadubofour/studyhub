// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, act, renderHook } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'note1' }))
const createChat = vi.fn(async (..._a: unknown[]) => ({ id: 'chat1' }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('@/lib/data/tutor', () => ({ createChat: (...a: unknown[]) => createChat(...a) }))
vi.mock('@/lib/import/pptxToNote', () => ({ pptxToNote: async (_b: ArrayBuffer, name: string) => ({ title: 'Deck ' + name, content_md: '## Slide 1: Intro' }) }))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { UploadDialog } from '@/components/notes/UploadDialog'
import { requestUpload, useOpenUpload } from '@/lib/scan/events'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); createNote.mockClear(); createChat.mockClear(); router.push.mockClear() })

const reviewing = async (defaultNext?: 'tutor') => {
  render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider>
    <UploadDialog open onClose={() => {}} courses={[]} defaultNext={defaultNext} />
  </ConfirmProvider></ToastProvider></ProfileProvider>)
  await act(async () => { fireEvent.change(screen.getByLabelText('File to upload'), { target: { files: [new File(['x'], 'week3.pptx')] } }) })
}

describe('upload from the Tutor', () => {
  it('offers "Chat about it with the tutor" after saving, and has it chosen when asked for from the Tutor', async () => {
    await reviewing('tutor')
    expect(screen.getByRole('radio', { name: 'Chat about it with the tutor' }).getAttribute('aria-checked')).toBe('true')
  })
  it('does not have it chosen otherwise: the note opens as before', async () => {
    await reviewing()
    expect(screen.getByRole('radio', { name: 'Chat about it with the tutor' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('radio', { name: 'Open the note' }).getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(router.push).toHaveBeenCalledWith('/notes/note1')
    expect(createChat).not.toHaveBeenCalled()
  })
  it('saves the note and opens a chat about it', async () => {
    await reviewing('tutor')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(createChat).toHaveBeenCalledWith(expect.anything(), { title: 'Deck week3.pptx', course_id: null, note_id: 'note1' })
    expect(router.push).toHaveBeenCalledWith('/tutor/chat1')
  })
  it('still opens the note, and says so, when the chat cannot be started', async () => {
    createChat.mockRejectedValueOnce(new Error('offline'))
    await reviewing('tutor')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save note' })) })
    expect(router.push).toHaveBeenCalledWith('/notes/note1')
    expect(screen.getByText(/Couldn.t start the chat/)).toBeTruthy()
  })
})

describe('asking the app to open Upload', () => {
  it('passes along where it should lead, and nothing for a plain request or a click', () => {
    const heard = vi.fn()
    renderHook(() => useOpenUpload(heard))
    requestUpload({ next: 'tutor' })
    expect(heard).toHaveBeenLastCalledWith({ next: 'tutor' })
    requestUpload()
    expect(heard).toHaveBeenLastCalledWith(undefined)
    ;(requestUpload as unknown as (e: unknown) => void)({ type: 'click', target: {} }) // used straight as a click handler
    expect(heard).toHaveBeenLastCalledWith(undefined)
  })
})
