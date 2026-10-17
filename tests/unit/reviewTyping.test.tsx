// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Card } from '@/lib/types'

const card = (id: string, back = `A ${id}`): Card => ({ id, deck_id: 'd', front: `Q ${id}`, back, due_at: '2026-10-01T00:00:00Z', interval_days: 0, ease: 2.5, reps: 0, lapses: 0 })
let cards: Card[] = []
const rateCard = vi.fn(async (_sb: unknown, c: Card, _r: number) => ({ ...c, reps: 1, interval_days: 1 }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/cards', () => ({ listDueCards: async () => cards, rateCard: (sb: unknown, c: Card, r: number) => rateCard(sb, c, r) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
import { ToastProvider } from '@/components/providers/ToastProvider'
import ReviewPage from '@/app/(app)/review/page'

const open = async () => { await act(async () => { render(<ToastProvider><ReviewPage /></ToastProvider>) }) }
const typeMode = () => fireEvent.click(screen.getByRole('radio', { name: 'Type answer' }))
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))
beforeEach(() => { localStorage.clear(); cards = [card('a', 'Mitochondria'), card('b')]; rateCard.mockClear() })
afterEach(cleanup)

describe('answering by typing', () => {
  it('defaults to flip, and the choice is remembered', async () => {
    await open()
    expect(screen.getByRole('radio', { name: 'Flip' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('button', { name: /Show answer/ })).toBeTruthy()
    typeMode()
    expect(screen.queryByRole('button', { name: /Show answer/ })).toBeNull()
    cleanup()
    await open()
    expect(screen.getByRole('radio', { name: 'Type answer' }).getAttribute('aria-checked')).toBe('true')
  })

  it('checks what was typed, shows both, and suggests a rating that can still be changed', async () => {
    await open()
    typeMode()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'mitochondrion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('Close')).toBeTruthy()
    expect(screen.getByText('mitochondrion')).toBeTruthy() // what was written
    expect(screen.getByText('Mitochondria')).toBeTruthy() // the card's answer
    expect(screen.getByRole('button', { name: /Hard.*suggested/ })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Good/ })) }) // the student overrules it
    expect(rateCard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'a' }), 3)
  })

  it('says Correct and Not quite, with the matching suggestion', async () => {
    await open()
    typeMode()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'MITOCHONDRIA!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('Correct')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Good.*suggested/ })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Good/ })) })
    fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: 'nothing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('Not quite')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Again.*suggested/ })).toBeTruthy()
  })

  it('typing numbers or a space in the box never rates or reveals', async () => {
    await open()
    typeMode()
    const box = screen.getByLabelText('Your answer')
    box.focus()
    for (const k of [' ', '1', '3', 'Enter']) fireEvent.keyDown(box, { key: k, bubbles: true })
    await act(async () => { key('1') })
    expect(rateCard).not.toHaveBeenCalled()
    expect(screen.queryByText('Correct')).toBeNull()
    expect(screen.queryByText('Not quite')).toBeNull()
  })

  it('Enter checks, Shift+Enter does not, and an empty answer cannot be checked', async () => {
    await open()
    typeMode()
    const box = screen.getByLabelText('Your answer')
    expect((screen.getByRole('button', { name: 'Check' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'Mitochondria' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(screen.queryByText('Correct')).toBeNull()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.getByText('Correct')).toBeTruthy()
  })

  it('"I don\'t know" shows the answer without marking it, and the keys 1 to 4 then rate', async () => {
    await open()
    typeMode()
    fireEvent.click(screen.getByRole('button', { name: "I don't know" }))
    expect(screen.getByText('Mitochondria')).toBeTruthy()
    expect(screen.queryByText('Not quite')).toBeNull()
    expect(screen.queryByText(/suggested/)).toBeNull()
    await act(async () => { key('1') })
    expect(rateCard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'a' }), 1)
  })

  it('in flip mode nothing changes: Space shows the answer and no box appears', async () => {
    await open()
    expect(screen.queryByLabelText('Your answer')).toBeNull()
    await act(async () => { key(' ') })
    expect(screen.getByText('Mitochondria')).toBeTruthy()
  })

  it('the next card starts with an empty box', async () => {
    await open()
    typeMode()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'mitochondria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Good/ })) })
    expect((await screen.findByLabelText('Your answer') as HTMLTextAreaElement).value).toBe('')
  })
})
