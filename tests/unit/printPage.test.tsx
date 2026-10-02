// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ getNotesForExport: () => Promise.reject(new Error('invalid input syntax for type uuid')) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('ids=not-a-uuid') }))

import PrintNotesPage from '@/app/print/notes/page'

describe('print page', () => {
  it('shows a message instead of hanging on "Preparing…" when the notes can\'t be loaded', async () => {
    render(<PrintNotesPage />)
    expect(await screen.findByText(/couldn't load these notes/i)).toBeTruthy()
  })
})
