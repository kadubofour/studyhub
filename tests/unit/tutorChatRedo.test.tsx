// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'

const chat = { id: 'c1', title: 'Krebs', course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: async () => ({ ...chat }), listMessages: async () => messages, renameChat: vi.fn(), setChatCourse: vi.fn(), setChatGuided: vi.fn(),
  deleteChat: vi.fn(), saveProposals: vi.fn(), setChatContext: vi.fn(),
}))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: vi.fn() }))
const plan = { billing: false, isPremium: false, loading: false, tutorToday: 0 } // one object: the chat watches it
vi.mock('@/components/billing/usePlan', async orig => ({ ...(await orig<object>()), usePlan: () => plan }))
type Sent = { message: string; replace?: string }
let sent: Sent[] = []
let answer: () => unknown = () => ({ ok: true, lines: lines([{ t: 'done', proposals: [] }]) })
vi.mock('@/lib/tutor/stream', () => ({
  sendTutorMessage: async (_c: string, message: string, _s?: AbortSignal, _a?: unknown, replace?: string) => { sent.push({ message, replace }); return answer() },
}))
const router = { push: vi.fn(), replace: vi.fn() } // one object, like the real router: the chat reloads when it changes
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams('') }))
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { id: 'u1', display_name: 'Ama' } }) }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const m = (id: string, role: 'user' | 'assistant', content: string, status: 'ok' | 'cut_off' = 'ok') => ({ id, role, content, sources: [], proposals: [], status, created_at: '', attachments: [] })
async function* lines(list: object[]) { for (const l of list) yield l }
const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }

// The browser's speech: what was said aloud, and a way to finish it
const spoken: string[] = []
let finish: (() => void) | null = null
class Utterance { text: string; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t } }
const synth = { speak: vi.fn((u: Utterance) => { if (u.text) { spoken.push(u.text); finish = () => u.onend?.() } }), cancel: vi.fn() }
// The browser's speech recognition: the latest one started, to say words into
let mic: { onresult: ((e: unknown) => void) | null; onend: (() => void) | null; onerror: unknown; started: boolean } | null = null
class Recognition { continuous = false; interimResults = false; lang = ''; onresult = null; onerror = null; onend: (() => void) | null = null; started = false
  start() { this.started = true; mic = this as never } stop() { this.onend?.() } abort() {} }
const say = (words: string) => act(() => { mic!.onresult!({ results: [[{ transcript: words }]] }) })

beforeEach(() => {
  messages = [m('q1', 'user', 'What is ATP?'), m('a1', 'assistant', 'ATP is **energy**.'), m('q2', 'user', 'And NADH?'), m('a2', 'assistant', 'NADH carries electrons.')]
  sent = []; spoken.length = 0; finish = null; mic = null; synth.speak.mockClear(); synth.cancel.mockClear()
  answer = () => ({ ok: true, lines: lines([{ t: 'done', proposals: [] }]) })
  Object.assign(window, { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance, SpeechRecognition: Recognition })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('asking again in place of an earlier question', () => {
  it('Regenerate replaces the last question and its reply, instead of adding them again', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Regenerate reply' })) })
    expect(sent).toEqual([{ message: 'And NADH?', replace: 'q2' }])
  })
  it('a question can be edited and asked again; what came after it is replaced', async () => {
    await open()
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit question' })[0])
    expect(screen.getByText('The answers after this one are replaced.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Edit your question'), { target: { value: 'What is ATP made of?' } })
    let shown: string[] = []
    // looked at while the reply is being written, once the page has drawn the new question
    answer = () => ({ ok: true, lines: (async function* () { await new Promise(r => setTimeout(r, 0)); shown = screen.queryAllByText(/NADH/).map(e => e.textContent!); yield { t: 'done', proposals: [] } })() })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask again' })) })
    expect(sent).toEqual([{ message: 'What is ATP made of?', replace: 'q1' }])
    expect(shown).toEqual([]) // while it is answered, the later questions and replies are already gone from the page
  })
  it('editing can be cancelled, and the last question says nothing about replacing others', async () => {
    await open()
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit question' })[1])
    expect(screen.queryByText('The answers after this one are replaced.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Edit your question')).toBeNull()
    expect(sent).toEqual([])
  })
  it('Try again replaces a question that was saved without an answer', async () => {
    messages = [m('q1', 'user', 'What is ATP?'), m('a1', 'assistant', 'Energy.'), m('q2', 'user', 'And NADH?')]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(sent).toEqual([{ message: 'And NADH?', replace: 'q2' }])
  })
  it('Try again after a refused question (never saved) replaces nothing, even an older one with the same words', async () => {
    messages = [m('q1', 'user', 'Hi'), m('a1', 'assistant', 'Hello.')]
    answer = () => ({ ok: false, error: 'ai_failed', message: 'Couldn\'t reach the AI.' })
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hi' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(sent).toEqual([{ message: 'Hi', replace: undefined }, { message: 'Hi', replace: undefined }])
  })
})

describe('listening to answers', () => {
  it('reads a reply aloud without its Markdown marks, and stops when asked', async () => {
    await open()
    fireEvent.click(screen.getAllByRole('button', { name: 'Read aloud' })[0])
    expect(spoken).toEqual(['ATP is energy.'])
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading aloud' }))
    expect(synth.cancel).toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Read aloud' })).toHaveLength(2)
  })
  it('voice mode: speaking then pausing sends the question; the answer is read aloud; then it listens again', async () => {
    messages = []
    answer = () => { messages = [m('q9', 'user', 'Why NADH'), m('a9', 'assistant', 'Because it *carries* electrons.')]; return { ok: true, lines: lines([{ t: 'done', proposals: [] }]) } }
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Voice mode' })) })
    expect(mic?.started).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/Listening/)
    await say('Why NADH')
    await waitFor(() => expect(sent).toEqual([{ message: 'Why NADH', replace: undefined }]), { timeout: 3000 })
    await waitFor(() => expect(spoken).toEqual(['Because it carries electrons.']))
    const first = mic
    await act(async () => { finish!() }) // the reading ends
    await waitFor(() => expect(mic).not.toBe(first)) // and it listens for the next question
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'End voice mode', pressed: true })) })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
