// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const chat = { id: 'c1', title: 'Krebs', course_id: null, note_id: 'n1', lecture_id: null, guided: false, created_at: '', updated_at: '' }
let guided = false
let getChatImpl: (() => Promise<unknown>) | null = null
let guidedFails = false
const setChatGuided = vi.fn(async (..._a: unknown[]) => {})
let messages: Record<string, unknown>[] = []
const saveProposals = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'n1', title: 'Krebs cycle' } }) }) }) }) }) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: () => (getChatImpl ? getChatImpl() : Promise.resolve({ ...chat, guided })), setChatGuided: (...a: unknown[]) => (guidedFails ? Promise.reject(new Error('offline')) : setChatGuided(...a)), listMessages: async () => messages, renameChat: vi.fn(), setChatCourse: vi.fn(), deleteChat: vi.fn(),
  saveProposals: (...a: unknown[]) => saveProposals(...a),
}))
const apply = vi.fn(async (..._a: unknown[]) => ({ itemId: 'd9', itemKind: 'deck' }))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: (...a: unknown[]) => apply(...a) }))
let send: (chatId: string, message: string) => Promise<unknown>
vi.mock('@/lib/tutor/stream', () => ({ sendTutorMessage: (c: string, m: string) => send(c, m) }))
const router = { push: vi.fn(), replace: vi.fn() } // stable, like Next's own router: a new object each render would reload forever
let search = ''
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(search) }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

async function* lines(list: object[]) { for (const l of list) yield l }
const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
const ask = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
}
beforeEach(() => { getChatImpl = null; guided = false; guidedFails = false; setChatGuided.mockClear(); router.replace.mockClear(); search = ''; messages = []; saveProposals.mockClear(); apply.mockClear() })
afterEach(cleanup)

describe('ChatView', () => {
  it('shows saved messages with their sources and cut-off notice', async () => {
    messages = [
      { id: 'm1', role: 'user', content: 'Why NADH?', sources: [], proposals: [], status: 'ok' },
      { id: 'm2', role: 'assistant', content: 'It carries electrons.', sources: [{ kind: 'note', id: 'n1', title: 'Krebs cycle' }], proposals: [], status: 'cut_off' },
    ]
    await open()
    expect(screen.getByText('Why NADH?')).toBeTruthy()
    expect(screen.getByText('It carries electrons.')).toBeTruthy()
    // once in the "About" line under the title, once as the reply's source
    expect(screen.getAllByRole('link', { name: 'Krebs cycle' }).map(l => l.getAttribute('href'))).toEqual(['/notes/n1', '/notes/n1'])
    expect(screen.getByText(/cut off/i)).toBeTruthy()
  })
  it('sends a message, shows the reply as it arrives, then the saved messages', async () => {
    send = async () => ({ ok: true, lines: lines([{ t: 'delta', text: 'NADH ' }, { t: 'delta', text: 'carries electrons.' }, { t: 'done', messageId: 'm2', proposals: [] }]) })
    await open()
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }, { id: 'm2', role: 'assistant', content: 'NADH carries electrons.', sources: [], proposals: [], status: 'ok' }]
    await ask('Why?')
    expect(screen.getByText('NADH carries electrons.')).toBeTruthy()
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('')
  })
  it('shows the upgrade prompt when the daily tutor limit is reached', async () => {
    send = async () => ({ ok: false, error: 'tutor_limit', message: 'x' })
    await open()
    await ask('One more?')
    expect(screen.getByText(/free tutor messages/)).toBeTruthy()
  })
  it('adds a proposal as the student, saves its new state, and shows the link', async () => {
    messages = [{ id: 'm2', role: 'assistant', content: 'Here.', sources: [], status: 'ok', proposals: [
      { id: 'p1', tool: 'create_flashcards', state: 'pending', args: { deck_id: null, deck_name: 'Krebs', course_id: null, cards: [{ front: 'Q', back: 'A' }] } }] }]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
    expect(apply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'p1' }), { course_id: null, note_id: 'n1' })
    expect(saveProposals).toHaveBeenCalledWith(expect.anything(), 'm2', [expect.objectContaining({ id: 'p1', state: 'added', itemId: 'd9', itemKind: 'deck' })])
    expect(screen.getByRole('link', { name: /Open/ }).getAttribute('href')).toBe('/flashcards/d9')
  })
  it('discarding saves the state and nothing else', async () => {
    messages = [{ id: 'm2', role: 'assistant', content: 'Here.', sources: [], status: 'ok', proposals: [
      { id: 'p1', tool: 'create_task', state: 'pending', args: { title: 'Read', type: 'reading', due_at: null, priority: 'normal', course_id: null } }] }]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Discard' })) })
    expect(apply).not.toHaveBeenCalled()
    expect(saveProposals).toHaveBeenCalledWith(expect.anything(), 'm2', [expect.objectContaining({ state: 'discarded' })])
  })
  it('two proposals added at once are both kept (one save must not undo the other)', async () => {
    const task = (id: string) => ({ id, tool: 'create_task', state: 'pending', args: { title: id, type: 'other', due_at: null, priority: 'normal', course_id: null } })
    messages = [{ id: 'm2', role: 'assistant', content: 'Here.', sources: [], status: 'ok', proposals: [task('p1'), task('p2')] }]
    await open()
    await act(async () => { for (const b of screen.getAllByRole('button', { name: 'Add' })) fireEvent.click(b) })
    const last = saveProposals.mock.calls.at(-1)![2] as { id: string; state: string }[]
    expect(last.map(p => [p.id, p.state])).toEqual([['p1', 'added'], ['p2', 'added']])
  })
  it('an item that was added but whose state could not be saved shows as added, and is not added twice', async () => {
    messages = [{ id: 'm2', role: 'assistant', content: 'Here.', sources: [], status: 'ok', proposals: [
      { id: 'p1', tool: 'create_task', state: 'pending', args: { title: 'Read', type: 'reading', due_at: null, priority: 'normal', course_id: null } }] }]
    saveProposals.mockRejectedValueOnce(new Error('offline'))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('link', { name: /Open/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
    expect(apply).toHaveBeenCalledTimes(1)
  })
  it('a reply that breaks off with an exception says so instead of showing nothing', async () => {
    send = async () => ({ ok: true, lines: (async function* () { yield { t: 'delta', text: 'NADH ' }; throw new Error('connection lost') })() })
    await open()
    await ask('Why?')
    expect(screen.getByRole('alert').textContent).toMatch(/cut off/i)
  })
  it('keeps what you typed when the message is refused', async () => {
    send = async () => ({ ok: false, error: 'tutor_limit', message: 'x' })
    await open()
    await ask('One more?')
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('One more?')
  })
  it('starts with the message from the address in the box, and does not send it', async () => {
    search = 'ask=Quiz%20me%20on%20Krebs%20cycle'
    send = vi.fn()
    await open()
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Quiz me on Krebs cycle')
    expect(send).not.toHaveBeenCalled()
    expect(screen.getByText(/Ask anything/)).toBeTruthy() // no conversation started
  })
  it('cuts a very long message from the address to the 4,000-character limit', async () => {
    search = `ask=${'x'.repeat(5000)}`
    await open()
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toHaveLength(4000)
  })
  it('takes the message from the address once: the address is cleaned so a reload or Back does not fill it again', async () => {
    search = 'ask=Quiz%20me%20on%20Krebs%20cycle'
    await open()
    expect(router.replace).toHaveBeenCalledWith('/tutor/c1')
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Quiz me on Krebs cycle')
  })
  it('leaves the address alone when there is no message in it', async () => {
    await open()
    expect(router.replace).not.toHaveBeenCalled()
  })
  it('shows the Guided switch off for a normal chat, and turning it on saves it', async () => {
    await open()
    const sw = screen.getByRole('switch', { name: 'Guided' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await act(async () => { fireEvent.click(sw) })
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true')
    expect(setChatGuided).toHaveBeenCalledWith(expect.anything(), 'c1', true)
  })
  it('goes back and says so when guided mode cannot be saved', async () => {
    guidedFails = true
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Guided' })) })
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Couldn\'t change guided mode.')).toBeTruthy()
  })
  it('a guided chat starts with the switch on', async () => {
    guided = true
    await open()
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true')
  })
  it('the hint and answer buttons show only in a guided chat that has messages', async () => {
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    await open()
    expect(screen.queryByRole('button', { name: 'Give me a hint' })).toBeNull() // not guided
    cleanup()
    guided = true; messages = []
    await open()
    expect(screen.queryByRole('button', { name: 'Give me a hint' })).toBeNull() // no messages yet
    cleanup()
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    await open()
    expect(screen.getByRole('button', { name: 'Give me a hint' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show the answer' })).toBeTruthy()
  })
  it('the buttons send their message at once and leave a half-typed one alone', async () => {
    guided = true
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    send = vi.fn(async () => ({ ok: true, lines: lines([{ t: 'done', proposals: [] }]) })) as never
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'my half-typed question' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Give me a hint' })) })
    expect(send).toHaveBeenCalledWith('c1', 'Give me a hint.')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Show the answer' })) })
    expect(send).toHaveBeenCalledWith('c1', 'Show me the answer.')
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('my half-typed question')
  })
  it('a refused hint or answer request leaves the typed draft alone', async () => {
    guided = true
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    send = vi.fn(async () => ({ ok: false, error: 'tutor_limit', message: 'x' })) as never
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'my half-typed question' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Give me a hint' })) })
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('my half-typed question')
    expect(screen.getByText(/free tutor messages/)).toBeTruthy()
  })
  it('the buttons are off while a reply is being written', async () => {
    guided = true
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    let finish: () => void = () => {}
    const held = new Promise<void>(res => { finish = res })
    send = (async () => ({ ok: true, lines: (async function* () { yield { t: 'delta', text: 'Thinking it ' }; await held; yield { t: 'done', proposals: [] } })() })) as never
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Give me a hint' })) })
    expect((screen.getByRole('button', { name: 'Give me a hint' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Show the answer' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { finish() })
    expect((screen.getByRole('button', { name: 'Give me a hint' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('the chat refreshed after a reply does not flip a Guided switch the student just changed', async () => {
    guided = false // what the database still says when the refresh reads it
    send = (async () => ({ ok: true, lines: lines([{ t: 'delta', text: 'ok' }, { t: 'done', proposals: [] }]) })) as never
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Guided' })) })
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Where?' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true')
  })
  it('uses only the newest load, so an older answer arriving late cannot overwrite what the student did', async () => {
    const resolvers: ((c: unknown) => void)[] = []
    getChatImpl = () => new Promise(res => { resolvers.push(res) })
    await act(async () => { render(<StrictMode><ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider></StrictMode>) })
    expect(resolvers.length).toBeGreaterThanOrEqual(2) // strict mode runs the load twice
    // the newer one answers first, then the older one limps in with other data
    await act(async () => { resolvers[resolvers.length - 1]({ ...chat, title: 'Newest answer' }) })
    await act(async () => { resolvers[0]({ ...chat, title: 'Old answer' }) })
    expect(screen.getByRole('heading', { name: 'Newest answer' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Old answer' })).toBeNull()
  })
})
