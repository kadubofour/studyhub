// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

let chat: Record<string, unknown> = { id: 'c1', title: 'Krebs', course_id: null, note_id: 'n1', lecture_id: null, guided: false, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
const renameChat = vi.fn(async (..._a: unknown[]) => {})
const setChatContext = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'n1', title: 'Krebs cycle' } }) }) }) }) }) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
const notesLoads = vi.fn(async () => [{ id: 'n2', title: 'Glycolysis', course_id: null }])
vi.mock('@/lib/data/notes', () => ({ listNotes: () => notesLoads() }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [{ id: 'l1', title: 'Week 3', course_id: null }] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: async () => ({ ...chat }), listMessages: async () => messages, renameChat: (...a: unknown[]) => renameChat(...a),
  setChatCourse: vi.fn(), setChatGuided: vi.fn(), deleteChat: vi.fn(), saveProposals: vi.fn(),
  setChatContext: (...a: unknown[]) => setChatContext(...a),
}))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: vi.fn() }))
let plan = { billing: false, isPremium: false, loading: false, tutorToday: 0 }
vi.mock('@/components/billing/usePlan', async orig => ({ ...(await orig<object>()), usePlan: () => plan }))
let send: (chatId: string, message: string, signal?: AbortSignal) => Promise<unknown>
vi.mock('@/lib/tutor/stream', () => ({ sendTutorMessage: (c: string, m: string, s?: AbortSignal) => send(c, m, s) }))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams('') }))
const profileName: string | null = 'Kwadwo'
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { display_name: profileName } }) }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const m = (id: string, role: 'user' | 'assistant', content: string, status: 'ok' | 'cut_off' = 'ok') => ({ id, role, content, sources: [], proposals: [], status })
async function* lines(list: object[]) { for (const l of list) yield l }
const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
const ask = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  chat = { id: 'c1', title: 'Krebs', course_id: null, note_id: 'n1', lecture_id: null, guided: false, created_at: '', updated_at: '' }
  messages = []; plan = { billing: false, isPremium: false, loading: false, tutorToday: 0 }
  renameChat.mockClear(); setChatContext.mockClear(); router.push.mockClear()
})
afterEach(cleanup)

describe('stopping a reply', () => {
  it('shows Stop in place of Send while a reply is being written, and stopping ends it without an error', async () => {
    let signal: AbortSignal | undefined
    send = async (_c, _m, s) => {
      signal = s
      return { ok: true, lines: (async function* () {
        yield { t: 'delta', text: 'NADH ' }
        await new Promise((_, reject) => s!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
      })() }
    }
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000)
    await open()
    await ask('Why?')
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    now.mockReturnValue(5_000) // not a double tap
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
    now.mockRestore()
    expect(signal!.aborted).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull() // the student asked for it: not a failure
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
  })

  it('stopping before the reply begins is fine too', async () => {
    send = async (_c, _m, s) => { await new Promise((_, reject) => s!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))); return { ok: false } }
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000)
    await open()
    await ask('Why?')
    now.mockReturnValue(5_000)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
    now.mockRestore()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
  })
})

describe('trying again', () => {
  it('a reply that broke off offers Try again, which asks the same question', async () => {
    const calls: string[] = []
    // the server saves the question as it takes it, so it is there when the messages are read again
    send = async (_c, msg) => { calls.push(msg); messages = [m('1', 'user', msg)]; return { ok: true, lines: (async function* () { yield { t: 'delta', text: 'NADH ' }; throw new Error('lost') })() } }
    await open()
    await ask('Why NADH?')
    expect(screen.getByRole('alert').textContent).toMatch(/cut off/i)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(calls).toEqual(['Why NADH?', 'Why NADH?'])
  })

  it('a saved question with no answer offers it, and so does a saved cut-off reply', async () => {
    messages = [m('1', 'user', 'Why NADH?')]
    await open()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    cleanup()
    messages = [m('1', 'user', 'Why NADH?'), m('2', 'assistant', 'It carries', 'cut_off')]
    await open()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('does not offer it after a complete reply, or when the limit is reached (trying again would only hit it again)', async () => {
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    cleanup()
    messages = []
    send = async () => ({ ok: false, error: 'tutor_limit', message: 'x' })
    await open()
    await ask('One more?')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})

describe('on a reply', () => {
  it('copies the reply', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because **NADH** carries electrons.')]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy reply' })) })
    expect(writeText).toHaveBeenCalledWith('Because **NADH** carries electrons.')
    expect(screen.getByText('Copied.')).toBeTruthy()
  })

  it('says when it cannot copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy reply' })) })
    expect(screen.getByText(/Couldn.t copy/)).toBeTruthy()
  })

  it('regenerates only the newest reply, by asking the same question again', async () => {
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: true, lines: lines([{ t: 'delta', text: 'x' }, { t: 'done', proposals: [] }]) } }
    messages = [m('1', 'user', 'First?'), m('2', 'assistant', 'One.'), m('3', 'user', 'Second?'), m('4', 'assistant', 'Two.')]
    await open()
    expect(screen.getAllByRole('button', { name: 'Copy reply' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Regenerate reply' })).toHaveLength(1)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Regenerate reply' })) })
    expect(calls).toEqual(['Second?'])
  })
})

describe('follow-ups', () => {
  it('offers four after a reply, and one sends its message', async () => {
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: true, lines: lines([{ t: 'done', proposals: [] }]) } }
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    const group = within(screen.getByRole('group', { name: 'Follow-up questions' }))
    expect(group.getAllByRole('button').map(b => b.textContent)).toEqual(['Explain it simpler', 'Give an example', 'Quiz me on this', 'Make flashcards'])
    await act(async () => { fireEvent.click(group.getByRole('button', { name: 'Give an example' })) })
    expect(calls).toEqual(['Give me a worked example.'])
  })

  it('does not offer them with no conversation, in guided mode (which has its own buttons), or after a cut-off reply', async () => {
    await open()
    expect(screen.queryByRole('group', { name: 'Follow-up questions' })).toBeNull()
    cleanup()
    chat = { ...chat, guided: true }; messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    expect(screen.queryByRole('group', { name: 'Follow-up questions' })).toBeNull()
    cleanup()
    chat = { ...chat, guided: false }; messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'It car', 'cut_off')]
    await open()
    expect(screen.queryByRole('group', { name: 'Follow-up questions' })).toBeNull()
  })
})

describe('renaming', () => {
  it('turns the title into a box: Enter saves, and it is the name afterwards', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const box = screen.getByLabelText('Chat name') as HTMLInputElement
    expect(box.value).toBe('Krebs')
    fireEvent.change(box, { target: { value: '  Krebs cycle revision ' } })
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }) })
    expect(renameChat).toHaveBeenCalledWith(expect.anything(), 'c1', 'Krebs cycle revision')
    expect(screen.getByRole('heading', { name: 'Krebs cycle revision' })).toBeTruthy()
    expect(screen.queryByLabelText('Chat name')).toBeNull()
  })
  it('Escape leaves the name as it was; an empty name is not saved', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Chat name'), { target: { value: 'Other' } })
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Chat name'), { key: 'Escape' }) })
    expect(screen.getByRole('heading', { name: 'Krebs' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Chat name'), { target: { value: '   ' } })
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Chat name'), { key: 'Enter' }) })
    expect(renameChat).not.toHaveBeenCalled()
  })
  it('says when it cannot save, and keeps the old name', async () => {
    renameChat.mockRejectedValueOnce(new Error('offline'))
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Chat name'), { target: { value: 'New name' } })
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Chat name'), { key: 'Enter' }) })
    expect(screen.getByText(/Couldn.t rename/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Krebs' })).toBeTruthy()
  })
})

describe('what the chat is about', () => {
  it('can be changed to another note, or to a lecture', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    const picker = screen.getByRole('dialog')
    await act(async () => {})
    await act(async () => { fireEvent.click(within(within(picker).getByRole('list', { name: 'Notes' })).getByRole('button', { name: /Glycolysis/ })) })
    expect(setChatContext).toHaveBeenLastCalledWith(expect.anything(), 'c1', { note_id: 'n2' })
    expect(screen.getByRole('link', { name: 'Glycolysis' }).getAttribute('href')).toBe('/notes/n2')
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    await act(async () => {})
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Lectures' }))
    await act(async () => { fireEvent.click(within(within(screen.getByRole('dialog')).getByRole('list', { name: 'Lectures' })).getByRole('button', { name: /Week 3/ })) })
    expect(setChatContext).toHaveBeenLastCalledWith(expect.anything(), 'c1', { lecture_id: 'l1' })
    expect(screen.getByRole('link', { name: 'Week 3' }).getAttribute('href')).toBe('/lectures/l1')
  })

  it('can be removed, and a chat about nothing can be pointed at something', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove' })) })
    expect(setChatContext).toHaveBeenLastCalledWith(expect.anything(), 'c1', null)
    expect(screen.getByText('Not about a note or lecture')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose one' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('says when it cannot be changed, and keeps what it was', async () => {
    setChatContext.mockRejectedValueOnce(new Error('offline'))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove' })) })
    expect(screen.getByText(/Couldn.t change what this chat is about/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Krebs cycle' })).toBeTruthy()
  })
})

describe('the allowance of tutor messages', () => {
  it('is shown on the free plan, as what is left today', async () => {
    plan = { billing: true, isPremium: false, loading: false, tutorToday: 5 }
    await open()
    expect(screen.getByText('15 of 20 tutor messages left today')).toBeTruthy()
  })
  it('never goes below none, and is not shown to Premium, while loading, or when payments are off', async () => {
    plan = { billing: true, isPremium: false, loading: false, tutorToday: 25 }
    await open()
    expect(screen.getByText('0 of 20 tutor messages left today')).toBeTruthy()
    cleanup()
    for (const p of [{ billing: true, isPremium: true, loading: false, tutorToday: 3 }, { billing: true, isPremium: false, loading: true, tutorToday: 0 }, { billing: false, isPremium: false, loading: false, tutorToday: 0 }]) {
      plan = p
      await open()
      expect(screen.queryByText(/tutor messages left today/)).toBeNull()
      cleanup()
    }
  })
})

describe('on a phone', () => {
  it('keeps the message box above the bottom bar', async () => {
    await open()
    expect(screen.getByLabelText('Message').closest('form')!.className).toContain('max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]')
  })
})

describe('after the review', () => {
  it('keeps what had been written when the student stops, and says it was stopped (the server saves the partial reply a moment later)', async () => {
    send = async (_c, msg, s) => {
      messages = [m('1', 'user', msg)] // only the question is saved by the time the messages are read again
      return { ok: true, lines: (async function* () {
        yield { t: 'delta', text: 'NADH ' }
        await new Promise((_, reject) => s!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
      })() }
    }
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000)
    await open()
    await ask('Why?')
    now.mockReturnValue(5_000) // some time later
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
    expect(screen.getByText('NADH')).toBeTruthy()
    expect(screen.getByText('Stopped.')).toBeTruthy()
    now.mockRestore()
  })

  it('ignores a Stop that is really the second tap of a double tap on Send', async () => {
    let signal: AbortSignal | undefined
    send = async (_c, _m, s) => { signal = s; return { ok: true, lines: (async function* () { await new Promise(() => {}) })() } }
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000)
    await open()
    await ask('Why?')
    now.mockReturnValue(1_200) // 0.2 seconds: too soon to be meant
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
    expect(signal!.aborted).toBe(false)
    now.mockReturnValue(2_000)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
    expect(signal!.aborted).toBe(true)
    now.mockRestore()
  })

  it('tells the usage line that a message was used, even when the reply was stopped', async () => {
    send = async (_c, _m, s) => ({ ok: true, lines: (async function* () { await new Promise((_, reject) => s!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) })() })
    const used = vi.fn()
    window.addEventListener('studyhub:ai-used', used)
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000)
    await open()
    await ask('Why?')
    now.mockReturnValue(5_000)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
    expect(used).toHaveBeenCalled()
    window.removeEventListener('studyhub:ai-used', used)
    now.mockRestore()
  })

  it('Try again after a failed send asks the question that failed, not the one answered before', async () => {
    messages = [m('1', 'user', 'Q1'), m('2', 'assistant', 'A1')]
    const calls: string[] = []
    send = async (_c, msg) => { calls.push(msg); return { ok: false, error: 'ai_failed', message: 'x' } } // the failed question was never saved
    await open()
    await ask('Q2')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(calls).toEqual(['Q2', 'Q2'])
  })

  it('does not reload the notes and lectures each time the chat redraws while the picker is open', async () => {
    send = async () => ({ ok: true, lines: (async function* () { await new Promise(r => setTimeout(r, 30)); yield { t: 'delta', text: 'a' }; yield { t: 'delta', text: 'b' }; yield { t: 'done', proposals: [] } })() })
    notesLoads.mockClear()
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Change' })) })
    const before = notesLoads.mock.calls.length
    await ask('Why?') // the reply arrives in pieces, and each piece redraws the chat
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
    expect(notesLoads.mock.calls.length).toBe(before)
  })

  it('renames once on Enter even though the box then loses focus, and not at all on Escape', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    let box = screen.getByLabelText('Chat name')
    fireEvent.change(box, { target: { value: 'One' } })
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }); fireEvent.blur(box) })
    expect(renameChat).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    box = screen.getByLabelText('Chat name')
    fireEvent.change(box, { target: { value: 'Two' } })
    await act(async () => { fireEvent.keyDown(box, { key: 'Escape' }); fireEvent.blur(box) })
    expect(renameChat).toHaveBeenCalledTimes(1)
  })

  it('keeps the follow-ups and Copy big enough to tap on a phone', async () => {
    messages = [m('1', 'user', 'Why?'), m('2', 'assistant', 'Because.')]
    await open()
    expect(screen.getByRole('button', { name: 'Copy reply' }).className).toContain('pointer-coarse:')
    expect(screen.getByRole('button', { name: 'Give an example' }).className).toContain('pointer-coarse:')
  })
})
