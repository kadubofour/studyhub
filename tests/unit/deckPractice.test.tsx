// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Card } from '@/lib/types'

const card = (id: string): Card => ({ id, deck_id: 'd', front: `Q${id}`, back: `A${id}`, due_at: '2099-01-01T00:00:00Z', interval_days: 30, ease: 2.5, reps: 5, lapses: 0 })
let cards: Card[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/decks', () => ({ getDeck: async () => ({ id: 'd', name: 'Cells', course_id: null }), deleteDeck: async () => {} }))
vi.mock('@/lib/data/cards', () => ({ listCards: async () => cards, createCards: async () => [], updateCard: async () => {}, deleteCard: async () => {} }))
const router = { replace: () => {}, push: () => {} }
vi.mock('next/navigation', () => ({ useParams: () => ({ deck: 'd' }), useRouter: () => router }))
import { ToastProvider } from '@/components/providers/ToastProvider'
import DeckPage from '@/app/(app)/flashcards/[deck]/page'
afterEach(cleanup)

describe('practising a deck', () => {
  it('can be started even when nothing is due', async () => {
    cards = [card('1'), card('2')]
    render(<ToastProvider><DeckPage /></ToastProvider>)
    await screen.findByText('Cells')
    expect(screen.queryByRole('link', { name: /^Review/ })).toBeNull() // nothing due
    expect((await screen.findByRole('link', { name: 'Practise' })).getAttribute('href')).toBe('/review?practice=1&deck=d')
  })
  it('is not offered for a deck with no cards', async () => {
    cards = []
    render(<ToastProvider><DeckPage /></ToastProvider>)
    await screen.findByText('Cells')
    expect(screen.queryByRole('link', { name: 'Practise' })).toBeNull()
  })
})
