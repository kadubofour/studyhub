// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor, within } from '@testing-library/react'

let cardRows: { id: string; front: string; back: string }[] = []
let deckMissing = false
let saveFails = false
let game = 'speed'
const replace = vi.fn()
const record = vi.fn(async (..._a: unknown[]) => { if (saveFails) throw new Error('offline') })
const router = { replace }
vi.mock('next/navigation', () => ({ useParams: () => ({ deck: 'd1' }), useRouter: () => router, useSearchParams: () => new URLSearchParams(`game=${game}`) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/decks', () => ({ getDeck: async () => { if (deckMissing) throw new Error('gone'); return { id: 'd1', name: 'Cells', course_id: null } } }))
vi.mock('@/lib/data/cards', () => ({ listCards: async () => cardRows }))
vi.mock('@/lib/data/games', () => ({ recordGamePlay: (...a: unknown[]) => record(...a) }))
import PlayPage from '@/app/(app)/flashcards/[deck]/play/page'

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `Front ${i}`, back: `Back ${i}` }))
const open = async () => { await act(async () => { render(<PlayPage />) }) }
// Answers every Speed question right by reading the front, then reaches the results
async function playSpeed(total: number) {
  for (let n = 0; n < total; n++) {
    const front = screen.getByText(/^Front \d+$/).textContent!.replace('Front', 'Back')
    fireEvent.click(screen.getByRole('button', { name: front }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: n === total - 1 ? 'See results' : 'Next' })) })
  }
}
beforeEach(() => { cardRows = rows(5); deckMissing = false; saveFails = false; game = 'speed'; replace.mockClear(); record.mockClear() })
afterEach(cleanup)

describe('play page', () => {
  it('says a game needs 4 cards when the deck is small', async () => {
    cardRows = rows(3)
    await open()
    expect(screen.getByText(/needs at least 4 cards/)).toBeTruthy()
  })
  it('sends the student back to the decks when the deck is gone', async () => {
    deckMissing = true
    await open()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/flashcards'))
  })
  it('records the play and shows the score', async () => {
    await open()
    await playSpeed(5)
    expect(screen.getByText('Score 5 / 5')).toBeTruthy()
    expect(record).toHaveBeenCalledWith({}, { deckId: 'd1', game: 'speed', score: 5, total: 5 })
  })
  it('still shows the score, and says so, when saving fails', async () => {
    saveFails = true
    await open()
    await playSpeed(5)
    expect(screen.getByText('Score 5 / 5')).toBeTruthy()
    expect(screen.getByText('Could not save this play.')).toBeTruthy()
  })
  it('Play again starts a fresh game with no save note', async () => {
    saveFails = true
    await open()
    await playSpeed(5)
    saveFails = false
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play again' })) })
    expect(screen.getByText('Question 1 of 5')).toBeTruthy()
    expect(screen.queryByText('Could not save this play.')).toBeNull()
    expect(within(document.body).queryByText(/Score/)).toBeNull()
  })
})
