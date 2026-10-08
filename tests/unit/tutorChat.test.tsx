// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const chat = { id: 'c1', title: 'Krebs', course_id: null, note_id: 'n1', lecture_id: null, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
const saveProposals = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'n1', title: 'Krebs cycle' } }) }) }) }) }) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: async () => chat, listMessages: async () => messages, renameChat: vi.fn(), setChatCourse: vi.fn(), deleteChat: vi.fn(),
  saveProposals: (...a: unknown[]) => saveProposals(...a),
}))
const apply = vi.fn(async (..._a: unknown[]) => ({ itemId: 'd9', itemKind: 'deck' }))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: (...a: unknown[]) => apply(...a) }))
let send: (chatId: string, message: string) => Promise<unknown>
vi.mock('@/lib/tutor/stream', () => ({ sendTutorMessage: (c: string, m: string) => send(c, m) }))
const router = { push: vi.fn() } // stable, like Next's own router: a new object each render would reload forever
vi.mock('next/navigation', () => ({ useRouter: () => router }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

async function* lines(list: object[]) { for (const l of list) yield l }
const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
const ask = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
}
beforeEach(() => { messages = []; saveProposals.mockClear(); apply.mockClear() })
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
})
