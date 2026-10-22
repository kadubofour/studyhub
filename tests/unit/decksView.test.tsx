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

const open = async () => { await act(async () => { render(<ToastProvider><FlashcardsPage /></ToastProvider>) }) }
const names = () => screen.getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/flashcards/')).map(l => l.querySelector('.font-semibold')?.textContent)
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
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } })
    expect(names()).toEqual(['atoms', 'Bonds', 'Cells'])
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'newest' } })
    expect(names()).toEqual(['Bonds', 'Cells', 'atoms'])
    fireEvent.click(screen.getByRole('radio', { name: 'List' }))
    expect(screen.getByRole('list', { name: 'Decks' }).getAttribute('data-layout')).toBe('list')
  })
})
