// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const createDeck = vi.fn(async (_sb: unknown, input: { name: string }) => ({ id: 'd-new', course_id: null, name: input.name }))
const createCards = vi.fn(async () => [])
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }), gte: async () => ({ data: [] }) }) }) }) }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [{ id: 'd1', name: 'Biology', course_id: null, due: 0, total: 3 }], createDeck: (...a: [unknown, { name: string }]) => createDeck(...a) }))
vi.mock('@/lib/data/cards', () => ({ createCards: (...a: unknown[]) => createCards(...(a as [])) }))

import { StudyPanel } from '@/components/notes/study/StudyPanel'
import { ToastProvider } from '@/components/providers/ToastProvider'

const fetchMock = vi.fn()
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
const fail = (status: number, error: string) => Promise.resolve(new Response(JSON.stringify({ error }), { status }))
// 42 words: long enough for a summary (the panel disables Summarise under 40)
const note = { id: 'n1', title: 'Krebs cycle', content_md: 'The Krebs cycle happens in the mitochondrial matrix. '.repeat(6).trim() }

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); createDeck.mockClear(); createCards.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const setup = (over: Partial<{ content_md: string }> = {}) => {
  const prepare = vi.fn(async () => {})
  const applyContent = vi.fn()
  render(<ToastProvider><StudyPanel note={{ ...note, ...over }} onClose={() => {}} prepare={prepare} applyContent={applyContent} /></ToastProvider>)
  return { prepare, applyContent }
}

describe('StudyPanel — summary', () => {
  it('saves pending edits first, then puts the summary at the top of the note', async () => {
    fetchMock.mockImplementation(() => ok({ summary_md: 'Makes NADH.' }))
    const { prepare, applyContent } = setup()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '✦ Summarise' })) })
    expect(prepare).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/summary')
    // The change is applied to the note as it is when the AI answers, so text typed meanwhile survives
    const apply = applyContent.mock.calls[0][0] as (md: string) => string
    expect(apply(note.content_md)).toBe('> **Summary**\n>\n> Makes NADH.\n\n' + note.content_md)
    expect(apply(note.content_md + ' Typed while waiting.')).toBe('> **Summary**\n>\n> Makes NADH.\n\n' + note.content_md + ' Typed while waiting.')
  })
  it('offers Regenerate and Remove when the note already has a summary', async () => {
    const { applyContent } = setup({ content_md: '> **Summary**\n>\n> Old.\n\nBody text' })
    expect(screen.getByRole('button', { name: '✦ Regenerate summary' })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove summary' })) })
    const apply = applyContent.mock.calls[0][0] as (md: string) => string
    expect(apply('> **Summary**\n>\n> Old.\n\nBody text and more')).toBe('Body text and more')
  })
  it('explains errors in plain words', async () => {
    fetchMock.mockImplementation(() => fail(422, 'too_short'))
    setup()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '✦ Summarise' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/too short/i)
  })
  it('shows the Get Premium prompt when the free limit is reached', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    fetchMock.mockImplementation(() => fail(402, 'daily_limit'))
    setup()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '✦ Summarise' })) })
    expect(screen.getByText("You've used today's 10 free AI actions")).toBeTruthy()
    expect(screen.getByRole('link', { name: /Get Premium/ }).getAttribute('href')).toBe('/plans')
    delete process.env.NEXT_PUBLIC_BILLING_ENABLED
  })
  it('shows free actions left under the tools on the Free plan', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    setup()
    expect(await screen.findByText('10 of 10 free AI actions left today')).toBeTruthy()
    delete process.env.NEXT_PUBLIC_BILLING_ENABLED
  })
})

describe('StudyPanel — cards', () => {
  it('generates cards for review, lets you untick and edit, and saves to a new deck named after the note', async () => {
    fetchMock.mockImplementation(() => ok({ cards: [{ front: 'Where?', back: 'Matrix' }, { front: 'Makes?', back: 'NADH' }] }))
    setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Cards' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '✦ Make flashcards' })) })
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Keep card/ })[1])
    fireEvent.change(screen.getAllByLabelText('Back')[0], { target: { value: 'Mitochondrial matrix' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 1 card' })) })
    expect(createDeck).toHaveBeenCalledWith(expect.anything(), { name: 'Krebs cycle' })
    expect(createCards).toHaveBeenCalledWith(expect.anything(), 'd-new', [{ front: 'Where?', back: 'Mitochondrial matrix' }], { noteId: 'n1' })
  })
})
