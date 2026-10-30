// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [
  { id: '1', name: 'Cells', course_id: null, due: 2, total: 10, created_at: '2026-10-01' },
  { id: '2', name: 'atoms', course_id: null, due: 9, total: 12, created_at: '2026-09-01' },
  { id: '3', name: 'Bonds', course_id: null, due: 0, total: 3, created_at: '2026-10-05' },
], createDeck: vi.fn() }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/scan/events', () => ({ useScanSaved: () => {} }))
import FlashcardsPage from '@/app/(app)/flashcards/page'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { choose } from './dropdown'

const open = async () => { await act(async () => { render(<ToastProvider><FlashcardsPage /></ToastProvider>) }) }
const names = () => screen.getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/flashcards/')).map(l => l.querySelector('[data-title]')?.textContent)
beforeEach(() => {
  localStorage.clear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

describe('how the decks are shown', () => {
  it('most due first in a grid, and can be a list, by name or newest', async () => {
    await open()
    expect(names()).toEqual(['atoms', 'Cells', 'Bonds'])
    expect(screen.getByRole('list', { name: 'Decks' }).getAttribute('data-layout')).toBe('grid')
    choose('Sort by', 'Name (A to Z)')
    expect(names()).toEqual(['atoms', 'Bonds', 'Cells'])
    choose('Sort by', 'Newest')
    expect(names()).toEqual(['Bonds', 'Cells', 'atoms'])
    fireEvent.click(screen.getByRole('radio', { name: 'List' }))
    expect(screen.getByRole('list', { name: 'Decks' }).getAttribute('data-layout')).toBe('list')
  })
})

describe('decks as icons', () => {
  it('shows a big icon with the number due on it', async () => {
    await open()
    fireEvent.click(screen.getByRole('radio', { name: 'Icons' }))
    expect(screen.getByRole('list', { name: 'Decks' }).getAttribute('data-layout')).toBe('icons')
    const atoms = screen.getByRole('link', { name: /atoms/ })
    expect(atoms.querySelector('[data-badge]')!.textContent).toBe('9')
    expect(screen.getByRole('link', { name: /Bonds/ }).querySelector('[data-badge]')).toBeNull() // nothing due: no badge
    expect(atoms.textContent).toContain('9 due')
  })
})

describe('decks in the grid', () => {
  it('keep their own tile: the number due, large, and how many cards', async () => {
    await open()
    const atoms = screen.getByRole('link', { name: /atoms/ })
    expect(atoms.textContent).toContain('due now')
    expect(atoms.textContent).toContain('12 cards')
    expect(screen.getByRole('link', { name: /Bonds/ }).textContent).toContain('all caught up')
  })
})

describe('the deck tile is the model for the others', () => {
  it('draws index cards in the corner', async () => {
    await open()
    expect(screen.getByRole('link', { name: /atoms/ }).querySelector('[data-motif="cards"]')).toBeTruthy()
  })
})
