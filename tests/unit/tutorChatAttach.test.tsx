// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Attachment } from '@/lib/tutor/attachments'

const chat = { id: 'c1', title: 'Krebs', course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
const signed = vi.fn(async (paths: string[]) => ({ data: paths.map(p => ({ path: p, signedUrl: `https://files/${p}` })), error: null }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ storage: { from: () => ({ createSignedUrls: (p: string[]) => signed(p) }) } }) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: async () => ({ ...chat }), listMessages: async () => messages, renameChat: vi.fn(),
  setChatCourse: vi.fn(), setChatGuided: vi.fn(), deleteChat: vi.fn(), saveProposals: vi.fn(), setChatContext: vi.fn(),
}))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: vi.fn() }))
vi.mock('@/components/billing/usePlan', async orig => ({ ...(await orig<object>()), usePlan: () => ({ billing: false, isPremium: false, loading: false, tutorToday: 0 }) }))
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { id: 'u', display_name: 'Kwadwo' } }) }))
const calls: { message: string; attachments?: Attachment[] }[] = []
let reply: () => Promise<unknown> = async () => ({ ok: true, lines: (async function* () { yield { t: 'done', proposals: [] } })() })
vi.mock('@/lib/tutor/stream', () => ({ sendTutorMessage: (_c: string, message: string, _s?: AbortSignal, attachments?: Attachment[]) => { calls.push({ message, attachments }); return reply() } }))
const uploaded = vi.fn()
let uploadFails = false
vi.mock('@/lib/tutor/attachClient', async orig => ({
  ...(await orig<object>()),
  readFile: async (f: File) => (f.name.endsWith('.mp3') ? { error: "Audio and video can't be added here. Record lectures in Lectures." }
    : f.name.endsWith('.docx') ? { id: crypto.randomUUID(), kind: 'document', name: f.name, text: 'Mitosis' }
      : { id: crypto.randomUUID(), kind: 'photo', name: f.name, pages: 1, file: f }),
  uploadAttachments: async (list: { kind: string; name: string; text?: string; sent?: Attachment }[], userId: string, chatId: string) => {
    uploaded(list.map(p => p.name), userId, chatId)
    if (uploadFails) throw new Error("Couldn't upload your files. Check your connection and try again.")
    return list.map(p => p.sent ?? (p.kind === 'document' ? { kind: 'document', name: p.name, text: p.text } : { kind: 'photo', name: p.name, path: `u/c1/${p.name}`, pages: 1 }))
  },
}))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams('') }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
const pick = async (...names: string[]) => {
  await act(async () => { fireEvent.change(screen.getByLabelText('Files to add'), { target: { files: names.map(n => new File(['x'], n)) } }) })
}
const bar = () => within(screen.getByLabelText('Message').closest('form')!)
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  messages = []; calls.length = 0; uploaded.mockClear(); uploadFails = false; signed.mockClear()
  reply = async () => ({ ok: true, lines: (async function* () { yield { t: 'done', proposals: [] } })() })
})
afterEach(cleanup)

describe('adding files and photos in the message bar', () => {
  it('has a button for them in the bar, and what is picked shows as chips that can be removed', async () => {
    await open()
    expect(bar().getByRole('button', { name: 'Add files or photos' })).toBeTruthy()
    await pick('q1.jpg', 'notes.docx')
    expect(bar().getByText('q1.jpg')).toBeTruthy()
    expect(bar().getByText('notes.docx')).toBeTruthy()
    fireEvent.click(bar().getByRole('button', { name: 'Remove q1.jpg' }))
    expect(bar().queryByText('q1.jpg')).toBeNull()
  })

  it('says why a file cannot be added, and keeps the others', async () => {
    await open()
    await pick('q1.jpg', 'lecture.mp3')
    expect(screen.getByRole('alert').textContent).toMatch(/Audio and video/)
    expect(bar().getByText('q1.jpg')).toBeTruthy()
  })

  it('sends them with the question, uploading into this chat\'s folder, and empties the bar', async () => {
    await open()
    await pick('q1.jpg')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Solve question 2' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(uploaded).toHaveBeenCalledWith(['q1.jpg'], 'u', 'c1')
    expect(calls).toEqual([{ message: 'Solve question 2', attachments: [{ kind: 'photo', name: 'q1.jpg', path: 'u/c1/q1.jpg', pages: 1 }] }])
    expect(bar().queryByText('q1.jpg')).toBeNull()
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('')
  })

  it('can send files without any text', async () => {
    await open()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
    await pick('q1.jpg')
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(calls[0].message).toBe('')
  })

  it('keeps the text and the files, and sends nothing, when the upload fails', async () => {
    uploadFails = true
    await open()
    await pick('q1.jpg')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Help' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(calls).toEqual([])
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn.t upload your files/)
    expect(bar().getByText('q1.jpg')).toBeTruthy()
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Help')
  })

  it('takes a photo pasted into the box', async () => {
    await open()
    const photo = new File(['x'], 'pasted.png', { type: 'image/png' })
    await act(async () => { fireEvent.paste(screen.getByLabelText('Message'), { clipboardData: { files: [photo], items: [] } }) })
    expect(bar().getByText('pasted.png')).toBeTruthy()
  })
})

describe('attachments in the conversation', () => {
  const q = (atts: Attachment[], content = 'What is this?') => ({ id: 'm1', role: 'user', content, sources: [], proposals: [], status: 'ok', created_at: '', attachments: atts })
  const a = { id: 'm2', role: 'assistant', content: 'A cell.', sources: [], proposals: [], status: 'ok', created_at: '', attachments: [] }

  it('shows a question\'s files under it: photos and PDFs open in a new tab, documents are named', async () => {
    messages = [q([{ kind: 'photo', name: 'q1.jpg', path: 'u/c1/a.jpg', pages: 1 }, { kind: 'pdf', name: 'week3.pdf', path: 'u/c1/w.pdf', pages: 2 }, { kind: 'document', name: 'notes.docx', text: 'x' }]), a]
    await open()
    const list = within(screen.getByRole('list', { name: 'Attached' }))
    expect(list.getByRole('link', { name: /q1\.jpg/ }).getAttribute('href')).toBe('https://files/u/c1/a.jpg')
    expect(list.getByRole('link', { name: /q1\.jpg/ }).getAttribute('target')).toBe('_blank')
    expect(list.getByRole('link', { name: /week3\.pdf/ }).getAttribute('href')).toBe('https://files/u/c1/w.pdf')
    expect(list.getByText('notes.docx')).toBeTruthy()
    expect(signed).toHaveBeenCalledTimes(1)
  })

  it('Regenerate sends the question again with its files', async () => {
    const atts: Attachment[] = [{ kind: 'photo', name: 'q1.jpg', path: 'u/c1/a.jpg', pages: 1 }]
    messages = [q(atts), a]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Regenerate reply' })) })
    expect(calls).toEqual([{ message: 'What is this?', attachments: atts }])
    expect(uploaded).not.toHaveBeenCalled() // already uploaded
  })

  it('Try again after a failed reply sends the same files, without uploading them again', async () => {
    reply = async () => ({ ok: false, error: 'ai_failed', message: 'x' })
    await open()
    await pick('q1.jpg')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Help' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    reply = async () => ({ ok: true, lines: (async function* () { yield { t: 'done', proposals: [] } })() })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(calls.map(c => c.attachments)).toEqual([[{ kind: 'photo', name: 'q1.jpg', path: 'u/c1/q1.jpg', pages: 1 }], [{ kind: 'photo', name: 'q1.jpg', path: 'u/c1/q1.jpg', pages: 1 }]])
    expect(uploaded).toHaveBeenCalledTimes(1)
  })
})
