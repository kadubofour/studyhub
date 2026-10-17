// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Card } from '@/lib/types'

const card = (id: string): Card => ({ id, deck_id: 'd', front: `Q ${id}`, back: `A ${id}`, due_at: '2030-01-01T00:00:00Z', interval_days: 9, ease: 2.5, reps: 3, lapses: 0 })
let params = new URLSearchParams('practice=1&deck=d')
const rateCard = vi.fn(async (_sb: unknown, c: Card) => c)
const listPracticeCards = vi.fn(async (..._a: unknown[]) => [card('a'), card('b')])
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/cards', () => ({
  listDueCards: async () => [] as Card[], rateCard: (sb: unknown, c: Card) => rateCard(sb, c),
  listPracticeCards: (...a: unknown[]) => listPracticeCards(...a),
}))
vi.mock('next/navigation', () => ({ useSearchParams: () => params }))
import { ToastProvider } from '@/components/providers/ToastProvider'
import ReviewPage from '@/app/(app)/review/page'

const open = async () => { await act(async () => { render(<ToastProvider><ReviewPage /></ToastProvider>) }) }
const rate = async (name: RegExp) => { fireEvent.click(await screen.findByRole('button', { name: /Show answer/ })); await act(async () => { fireEvent.click(screen.getByRole('button', { name })) }) }
beforeEach(() => { localStorage.clear(); params = new URLSearchParams('practice=1&deck=d'); rateCard.mockClear(); listPracticeCards.mockClear() })
afterEach(cleanup)

describe('practising cards that are not due', () => {
  it('loads the deck whatever its due dates, and says the schedule will not change', async () => {
    await open()
    expect(listPracticeCards).toHaveBeenCalledWith(expect.anything(), 'd')
    expect(await screen.findByText('Q a')).toBeTruthy()
    expect(screen.getByText(/schedule won.t change/i)).toBeTruthy()
  })

  it('rating a card moves on without saving anything, and shows no due times', async () => {
    await open()
    await screen.findByText('Q a')
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }))
    expect(screen.getByRole('button', { name: /^Good/ }).textContent).not.toMatch(/\d+\s?(d|m|h|mo)\b/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Good/ })) })
    expect(rateCard).not.toHaveBeenCalled()
    expect(await screen.findByText('Q b')).toBeTruthy()
  })

  it('brings an Again card back at the end, and finishes with a way to go again', async () => {
    await open()
    await screen.findByText('Q a')
    await rate(/^Again/)
    expect(await screen.findByText('Q b')).toBeTruthy()
    await rate(/^Good/)
    expect(await screen.findByText('Q a')).toBeTruthy() // came back
    await rate(/^Easy/)
    expect(screen.getByText('Practice complete')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Practise again' }).getAttribute('href')).toBe('/review?practice=1&deck=d')
  })

  it('has nothing to practise in an empty deck', async () => {
    listPracticeCards.mockResolvedValueOnce([])
    await open()
    expect(await screen.findByText('No cards to practise')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Practise again' })).toBeNull()
  })
})

describe('when nothing is due', () => {
  it('offers to practise the deck anyway, or every deck when none was chosen', async () => {
    params = new URLSearchParams('deck=d')
    await open()
    expect((await screen.findByRole('link', { name: 'Practise these cards' })).getAttribute('href')).toBe('/review?practice=1&deck=d')
    cleanup()
    params = new URLSearchParams('')
    await open()
    expect((await screen.findByRole('link', { name: 'Practise these cards' })).getAttribute('href')).toBe('/review?practice=1')
  })
})
