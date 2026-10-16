// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

let chat: Record<string, unknown> = { id: 'c1', title: 'Krebs', course_id: null, note_id: 'n1', lecture_id: null, guided: false, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'n1', title: 'Krebs cycle' } }) }) }) }) }) }))
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
import { timeOf, transcript } from '@/lib/tutor/conversation'

const m = (id: string, role: 'user' | 'assistant', content: string, created_at = '') => ({ id, role, content, sources: [], proposals: [], status: 'ok', created_at })
async function* lines(list: object[]) { for (const l of list) yield l }
const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
const ask = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
}
const pointer = (coarse: boolean) => Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (q: string) => ({ matches: coarse && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
})
const press = (key: string, extra: object = {}) => fireEvent.keyDown(screen.getByLabelText('Message'), { key, ...extra })

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  chat = { id: 'c1', title: 'Krebs', course_id: null, note_id: 'n1', lecture_id: null, guided: false, created_at: '', updated_at: '' }
  messages = []; pointer(false)
})
afterEach(cleanup)

describe('an empty chat', () => {
  it('offers four ideas about what the chat is about; one puts its message in the box and sends nothing', async () => {
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: true, lines: lines([{ t: 'done', proposals: [] }]) } }
    await open()
    const ideas = within(screen.getByRole('group', { name: 'Ideas to start with' }))
    expect(ideas.getAllByRole('button').map(b => b.textContent)).toEqual(['Explain a topic', 'Quiz me', 'Plan my revision', 'Summarise my notes'])
    fireEvent.click(ideas.getByRole('button', { name: 'Quiz me' }))
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Quiz me on Krebs cycle')
    expect(calls).toEqual([])
  })
  it('without a note it offers the plain messages, and a chat with messages offers none', async () => {
    chat = { ...chat, note_id: null }
    await open()
    fireEvent.click(within(screen.getByRole('group', { name: 'Ideas to start with' })).getByRole('button', { name: 'Explain a topic' }))
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Explain this topic to me in plain words: ')
    cleanup()
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    expect(screen.queryByRole('group', { name: 'Ideas to start with' })).toBeNull()
  })
})

describe('when each message was sent', () => {
  it('shows the time on each, and a heading where the day changes', async () => {
    const today = new Date(); today.setHours(9, 30, 0, 0)
    const old = new Date(today); old.setDate(old.getDate() - 3)
    messages = [m('1', 'user', 'Old?', old.toISOString()), m('2', 'assistant', 'Old.', old.toISOString()), m('3', 'user', 'New?', today.toISOString()), m('4', 'assistant', 'New.', today.toISOString())]
    await open()
    const conversation = within(screen.getByLabelText('Conversation'))
    expect(conversation.getByText('Today')).toBeTruthy()
    expect(conversation.getAllByRole('heading', { level: 2 })).toHaveLength(2) // one for each day, not one for each message
    expect(conversation.getAllByText(timeOf(today.toISOString())).length).toBeGreaterThanOrEqual(2)
  })
  it('shows neither for a message that has no time yet', async () => {
    send = async () => ({ ok: true, lines: (async function* () { await new Promise(() => {}) })() })
    await open()
    await ask('Why?')
    expect(within(screen.getByLabelText('Conversation')).queryByRole('heading', { level: 2 })).toBeNull()
  })
})

describe('taking the conversation out', () => {
  it('copies one of your own questions', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    messages = [m('1', 'user', 'Why NADH?'), m('2', 'assistant', 'Because.')]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy question' })) })
    expect(writeText).toHaveBeenCalledWith('Why NADH?')
  })
  it('copies the whole chat as plain text, and says when it cannot', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy chat' })) })
    expect(writeText).toHaveBeenCalledWith(transcript('Krebs', messages as never))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy chat' })) })
    expect(screen.getByText(/Couldn.t copy/)).toBeTruthy()
  })
  it('has nothing to copy in an empty chat', async () => {
    await open()
    expect(screen.queryByRole('button', { name: 'Copy chat' })).toBeNull()
  })
})

describe('the message box', () => {
  it('with a mouse, Enter sends and Shift+Enter starts a new line', async () => {
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: true, lines: lines([{ t: 'done', proposals: [] }]) } }
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } })
    await act(async () => { press('Enter', { shiftKey: true }) })
    expect(calls).toEqual([])
    await act(async () => { press('Enter') })
    expect(calls).toEqual(['Why?'])
  })
  it('on a touch screen, Enter starts a new line and only the Send button sends', async () => {
    pointer(true)
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: true, lines: lines([{ t: 'done', proposals: [] }]) } }
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } })
    await act(async () => { press('Enter') })
    expect(calls).toEqual([])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(calls).toEqual(['Why?'])
  })
  it('Ctrl+Enter sends on a touch screen too, and Enter that picks a word while composing does not send', async () => {
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: true, lines: lines([{ t: 'done', proposals: [] }]) } }
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } })
    await act(async () => { press('Enter', { isComposing: true }) })
    expect(calls).toEqual([])
    pointer(true)
    await act(async () => { press('Enter', { ctrlKey: true }) })
    expect(calls).toEqual(['Why?'])
  })
  it('shows how much is left only near the limit', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'a'.repeat(3000) } })
    expect(screen.queryByText(/\/ 4000/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'a'.repeat(3600) } })
    expect(screen.getByText('3600 / 4000')).toBeTruthy()
  })
})

describe('the message box grows', () => {
  afterEach(() => { delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight })
  it('with what is typed, up to about eight lines', async () => {
    await open()
    const box = screen.getByLabelText('Message') as HTMLTextAreaElement
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', { configurable: true, value: 120 })
    fireEvent.change(box, { target: { value: 'a\nb\nc\nd' } })
    expect(box.style.height).toBe('120px')
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', { configurable: true, value: 600 })
    fireEvent.change(box, { target: { value: 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl' } })
    expect(box.style.height).toBe('192px')
  })
})

describe('following a reply', () => {
  const scrollTo = (y: number) => { Object.defineProperty(window, 'scrollY', { configurable: true, value: y }); window.dispatchEvent(new Event('scroll')) }
  const into = vi.fn()
  beforeEach(() => {
    Element.prototype.scrollIntoView = into; into.mockClear()
    // the end of the conversation is 3000 down the page, and the window is 768 high
    Element.prototype.getBoundingClientRect = function () { return { top: 3000 - window.scrollY, bottom: 3000 - window.scrollY, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} } }
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2300 })
  })
  afterEach(() => { Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 }) })

  it('stays put when the student has scrolled up, offers Latest, and the button takes them to the newest text', async () => {
    let release!: () => void
    const gate = new Promise<void>(r => { release = r })
    send = async () => ({ ok: true, lines: (async function* () { yield { t: 'delta', text: 'one ' }; await gate; yield { t: 'delta', text: 'two ' }; yield { t: 'done', proposals: [] } })() })
    messages = [m('1', 'user', 'Earlier?'), m('2', 'assistant', 'Earlier.')]
    await open()
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
    await ask('Why?')
    await act(async () => { scrollTo(300) }) // scrolled up to re-read, mid reply
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeTruthy()
    into.mockClear()
    await act(async () => { release() })
    expect(into).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' })) })
    expect(into).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
  })

  it('a small scroll upward is enough to stop following, even close to the bottom', async () => {
    messages = [m('1', 'user', 'Earlier?'), m('2', 'assistant', 'Earlier.')]
    await open()
    await act(async () => { scrollTo(2300) })
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
    await act(async () => { scrollTo(2240) }) // 60 up: still within sight of the end, but going up
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeTruthy()
  })

  it('a reader scrolled up is not carried down when the reply finishes and is saved', async () => {
    send = async () => ({ ok: true, lines: (async function* () { yield { t: 'delta', text: 'one ' }; await new Promise(r => setTimeout(r, 20)); yield { t: 'done', proposals: [] } })() })
    await open()
    await ask('Why?')
    await act(async () => { scrollTo(300) })
    into.mockClear()
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
    expect(into).not.toHaveBeenCalled()
  })

  it('sending a message always goes to the bottom, even from further up', async () => {
    send = async () => ({ ok: true, lines: lines([{ t: 'done', proposals: [] }]) })
    messages = [m('1', 'user', 'Earlier?'), m('2', 'assistant', 'Earlier.')]
    await open()
    await act(async () => { scrollTo(300) })
    into.mockClear()
    await ask('And then?')
    expect(into).toHaveBeenCalled()
  })

  it('keeps following while the student is at the bottom', async () => {
    send = async () => ({ ok: true, lines: lines([{ t: 'delta', text: 'a' }, { t: 'delta', text: 'b' }, { t: 'done', proposals: [] }]) })
    await open()
    into.mockClear()
    await ask('Why?')
    expect(into).toHaveBeenCalled()
  })
})
