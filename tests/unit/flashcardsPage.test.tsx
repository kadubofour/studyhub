// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'

let search = ''
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [], createDeck: vi.fn() }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/scan/events', () => ({ useScanSaved: () => {} }))
import FlashcardsPage from '@/app/(app)/flashcards/page'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { shown } from './dropdown'

const open = async () => { await act(async () => { render(<ToastProvider><FlashcardsPage /></ToastProvider>) }) }
beforeEach(() => {
  search = ''
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

describe('Flashcards: arriving from a quick action', () => {
  it('opens the new deck dialog when the address says new', async () => {
    search = 'new=1'
    await open()
    expect(screen.getByRole('heading', { name: 'New deck' }).closest('dialog')!.hasAttribute('open')).toBe(true)
  })
  it('has the course already chosen when the address names one', async () => {
    search = 'new=1&course=bio'
    await open()
    expect(shown('Course')).toBe('Biology')
  })
  it('stays closed otherwise', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'New deck', hidden: true }).closest('dialog')!.hasAttribute('open')).toBe(false)
  })
})
