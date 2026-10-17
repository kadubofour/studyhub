// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const chat: Record<string, unknown> = { id: 'c1', title: 'Krebs', course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: async () => ({ ...chat }), listMessages: async () => messages, renameChat: vi.fn(),
  setChatCourse: vi.fn(), setChatGuided: vi.fn(), deleteChat: vi.fn(), saveProposals: vi.fn(), setChatContext: vi.fn(),
}))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: vi.fn() }))
vi.mock('@/components/billing/usePlan', async orig => ({ ...(await orig<object>()), usePlan: () => ({ billing: false, isPremium: false, loading: false, tutorToday: 0 }) }))
let send: (chatId: string, message: string, signal?: AbortSignal) => Promise<unknown>
vi.mock('@/lib/tutor/stream', () => ({ sendTutorMessage: (c: string, m: string, s?: AbortSignal) => send(c, m, s) }))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams('') }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

class FakeRecognition {
  static last: FakeRecognition | null = null
  continuous = false; interimResults = false; lang = ''
  onresult: ((e: unknown) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null
  started = false; stopped = false
  constructor() { FakeRecognition.last = this }
  start() { this.started = true }
  stop() { this.stopped = true; this.onend?.() }
  abort() { this.stopped = true }
  say(...parts: string[]) { this.onresult?.({ results: parts.map(t => [{ transcript: t }]) }) }
}
const win = window as unknown as { webkitSpeechRecognition?: unknown }
const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
const box = () => screen.getByLabelText('Message') as HTMLTextAreaElement
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  messages = []; FakeRecognition.last = null; win.webkitSpeechRecognition = FakeRecognition
  send = async () => ({ ok: true, lines: (async function* () { yield { t: 'done', proposals: [] } })() })
})
afterEach(() => { cleanup(); delete win.webkitSpeechRecognition })

describe('the message bar', () => {
  it('holds the Guided switch, next to where the message is written', async () => {
    await open()
    const bar = within(box().closest('form')!)
    expect(bar.getByRole('switch', { name: 'Guided' })).toBeTruthy()
    expect(screen.getAllByRole('switch')).toHaveLength(1) // and not also at the top
  })
})

describe('dictation', () => {
  it('has no microphone where the browser cannot do it', async () => {
    delete win.webkitSpeechRecognition
    await open()
    expect(screen.queryByRole('button', { name: 'Dictate' })).toBeNull()
  })

  it('fills the box with what is said, after what was already typed, and stops when asked', async () => {
    await open()
    fireEvent.change(box(), { target: { value: 'Explain' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    const rec = FakeRecognition.last!
    expect(rec.started).toBe(true)
    expect(screen.getByRole('button', { name: 'Stop dictating' }).getAttribute('aria-pressed')).toBe('true')
    act(() => rec.say('the krebs'))
    expect(box().value).toBe('Explain the krebs')
    act(() => rec.say('the krebs', ' cycle')) // the browser sends the whole of it each time
    expect(box().value).toBe('Explain the krebs cycle')
    fireEvent.click(screen.getByRole('button', { name: 'Stop dictating' }))
    expect(rec.stopped).toBe(true)
    expect(screen.getByRole('button', { name: 'Dictate' }).getAttribute('aria-pressed')).toBe('false')
    expect(box().value).toBe('Explain the krebs cycle') // what was said stays, to read and send
  })

  it('stops listening when the message is sent', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    const rec = FakeRecognition.last!
    act(() => rec.say('why NADH'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(rec.stopped).toBe(true)
  })

  it('says when the microphone is blocked', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    act(() => FakeRecognition.last!.onerror?.({ error: 'not-allowed' }))
    expect(screen.getByText(/microphone is blocked/i)).toBeTruthy()
  })

  it('does not call a pause in speaking an error', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    act(() => FakeRecognition.last!.onerror?.({ error: 'no-speech' }))
    expect(screen.queryByText(/microphone/i)).toBeNull()
  })
})
