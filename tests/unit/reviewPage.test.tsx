// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { Card } from '@/lib/types'

const card = (id: string): Card => ({ id, deck_id: 'd', front: `Q ${id}`, back: `A ${id}`, due_at: '2026-10-01T00:00:00Z', interval_days: 0, ease: 2.5, reps: 0, lapses: 0 })
const rateCard = vi.fn(async (_sb: unknown, c: Card) => ({ ...c, reps: 1, interval_days: 1 }))

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/cards', () => ({
  listDueCards: async () => [card('a'), card('b')],
  rateCard: (sb: unknown, c: Card) => rateCard(sb, c),
}))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import ReviewPage from '@/app/(app)/review/page'

const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))

describe('Review page', () => {
  it('a second key press landing after the save but before the screen updates does not re-rate the card', async () => {
    render(<ToastProvider><ReviewPage /></ToastProvider>)
    await screen.findByText('Q a')
    await act(async () => { key(' ') })
    // Outside act(): React hasn't committed the next card yet, like a fast double-press in the browser
    key('3')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    key('3')
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(rateCard).toHaveBeenCalledTimes(1)
    expect(rateCard.mock.calls[0][1].id).toBe('a')
  })
})
