// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LibraryOverview } from '@/components/library/LibraryOverview'
import type { StudySetCard } from '@/lib/library/studySets'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ createCourse: vi.fn() }))
vi.mock('@/components/providers/ToastProvider', () => ({ useToast: () => vi.fn() }))

afterEach(() => { cleanup(); push.mockClear() })
const now = new Date('2030-05-10T12:00:00Z')
const card = (id: string, name: string, over: Partial<StudySetCard> = {}): StudySetCard => ({
  course: { id, name, color: '#1D9E75' }, materials: 2, lastAt: '2030-05-10T02:00:00Z', progress: 40, topics: 5, planLine: 'Midterm in 5 days', ...over,
})
const setup = (cards: StudySetCard[], over: Record<string, unknown> = {}) => {
  const props = { cards, now, q: '', onQ: vi.fn(), sort: 'recent' as const, onSort: vi.fn(), onMaterials: vi.fn(), onNewNotebook: vi.fn(), create: [], courses: [], onCourses: vi.fn(), onOpenMaterials: vi.fn(), ...over }
  render(<LibraryOverview {...props} />)
  return props
}

describe('LibraryOverview', () => {
  it('shows a card for each course: its link, progress, materials, last studied and plan, after a card to make a new course', () => {
    setup([card('b', 'Biology'), card('c', 'Chemistry', { materials: 1, lastAt: null, progress: 0, planLine: 'You haven\'t started a study plan yet' })])
    const list = screen.getByRole('list', { name: 'Courses' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByRole('button', { name: /New course/ })).toBeTruthy()
    expect(within(items[1]).getByRole('link', { name: 'Biology' }).getAttribute('href')).toBe('/courses/b')
    expect(within(items[1]).getByRole('progressbar', { name: 'Progress in Biology' }).getAttribute('aria-valuenow')).toBe('40')
    expect(items[1].textContent).toContain('2 materials')
    expect(items[1].textContent).toContain('10h ago')
    expect(items[1].textContent).toContain('Midterm in 5 days')
    expect(items[2].textContent).toContain('1 material')
    expect(items[2].textContent).toContain('Not yet')
  })
  it('puts Materials, New notebook and search in the toolbar', () => {
    const p = setup([card('b', 'Biology')])
    fireEvent.click(screen.getByRole('button', { name: 'Materials' }))
    fireEvent.click(screen.getByRole('button', { name: 'New notebook' }))
    fireEvent.change(screen.getByLabelText('Search courses'), { target: { value: 'bio' } })
    expect(p.onMaterials).toHaveBeenCalled()
    expect(p.onNewNotebook).toHaveBeenCalled()
    expect(p.onQ).toHaveBeenCalledWith('bio')
  })
  it('says when a search finds no course', () => {
    setup([], { q: 'zzz' })
    expect(screen.getByText(/No course matches/)).toBeTruthy()
  })
  it('a card\'s menu opens its course page or its materials', () => {
    const p = setup([card('b', 'Biology')])
    fireEvent.click(screen.getByRole('button', { name: 'Options for Biology' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'See its materials' }))
    expect(p.onOpenMaterials).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByRole('button', { name: 'Options for Biology' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open course page' }))
    expect(push).toHaveBeenCalledWith('/courses/b')
  })
})
