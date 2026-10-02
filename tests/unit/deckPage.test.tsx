// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Card } from '@/lib/types'

let resolveCreate: ((c: Card[]) => void) | null = null
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/decks', () => ({ getDeck: async () => ({ id: 'd', name: 'Cells', course_id: null }), deleteDeck: async () => {} }))
vi.mock('@/lib/data/cards', () => ({
  listCards: async () => [],
  createCards: () => new Promise<Card[]>(r => { resolveCreate = r }),
  updateCard: async () => {}, deleteCard: async () => {},
}))
const router = { replace: () => {}, push: () => {} } // stable, like Next's router
vi.mock('next/navigation', () => ({ useParams: () => ({ deck: 'd' }), useRouter: () => router }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import DeckPage from '@/app/(app)/flashcards/[deck]/page'

describe('Deck page', () => {
  it('keeps what you type for the next card while the previous card is still saving', async () => {
    render(<ToastProvider><DeckPage /></ToastProvider>)
    await screen.findByText('Cells')
    const front = screen.getByLabelText('Front') as HTMLTextAreaElement
    const back = screen.getByLabelText('Back') as HTMLTextAreaElement
    fireEvent.change(front, { target: { value: 'Q1' } })
    fireEvent.change(back, { target: { value: 'A1' } })
    fireEvent.submit(front.closest('form')!)
    // Start typing the next card before the first save finishes
    fireEvent.change(front, { target: { value: 'Q2' } })
    await act(async () => { resolveCreate!([{ id: 'c1', deck_id: 'd', front: 'Q1', back: 'A1', due_at: new Date().toISOString(), interval_days: 0, ease: 2.5, reps: 0, lapses: 0 }]) })
    expect(front.value).toBe('Q2')
    expect(screen.getByText('Q1')).toBeTruthy()
  })
})
