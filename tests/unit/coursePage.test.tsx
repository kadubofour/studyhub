// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { LibraryItem } from '@/lib/library/items'
import type { TopicStat } from '@/lib/topics/types'

const course = { id: 'bio', name: 'Biology', color: '#1D9E75' }
const item = (kind: LibraryItem['kind'], id: string, title: string, at: string, extra: Partial<LibraryItem> = {}): LibraryItem =>
  ({ kind, id, title, course_id: 'bio', at, meta: '', href: `/${kind}/${id}`, ...extra })
const topic = (id: string, name: string, status: TopicStat['status'], extra: Partial<TopicStat> = {}): TopicStat =>
  ({ topic_id: id, name, position: 0, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 1, lectures: 0, decks: 0, status, ...extra })

type Page = { course: typeof course; items: LibraryItem[] | null; topics: TopicStat[] | null; exam: { id: string; title: string; due_at: string } | null } | null
let page: Page
let loadError = false
let loadCalls = 0
const push = vi.fn()
const requestUpload = vi.fn()
const createChat = vi.fn(async (..._a: unknown[]) => ({ id: 'chat1' }))
const startRevision = vi.fn(async (..._a: unknown[]) => '/tutor/rev1?ask=Quiz')
// what is in the course is the browser's own business (tests/unit/libraryPage.test.tsx)
vi.mock('@/components/library/MaterialBrowser', () => ({ MaterialBrowser: (p: { course: string; embedded?: boolean }) => <div data-testid="browser" data-course={p.course} data-embedded={String(!!p.embedded)} /> }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'bio' }), useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/coursePage', () => ({ loadCoursePage: async () => { loadCalls++; if (loadError) throw new Error('offline'); return page } }))
vi.mock('@/lib/data/tutor', () => ({ createChat: (...a: unknown[]) => createChat(...a) }))
vi.mock('@/lib/tutor/revise', () => ({ startRevision: (...a: unknown[]) => startRevision(...a) }))
vi.mock('@/lib/scan/events', () => ({ requestUpload: () => requestUpload() }))
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { timezone: 'UTC' } }) }))
import CoursePage from '@/app/(app)/courses/[id]/page'
import { ToastProvider } from '@/components/providers/ToastProvider'

const open = async () => { await act(async () => { render(<ToastProvider><CoursePage /></ToastProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const FULL = (): NonNullable<Page> => ({
  course,
  items: [
    item('note', 'n1', 'Krebs cycle', '2026-10-10T10:00:00Z'),
    item('deck', 'd1', 'Cells', '2026-10-09T10:00:00Z', { meta: '12 cards · 3 due', due: 3 }),
    item('deck', 'd2', 'Genetics', '2026-10-08T10:00:00Z', { meta: '8 cards · 2 due', due: 2 }),
    item('lecture', 'l1', 'Week 3 lecture', '2026-10-07T10:00:00Z', { meta: '45 min' }),
  ],
  topics: [topic('t1', 'Glycolysis', 'weak', { answers_30d: 6, correct_30d: 2, answers_all: 6 }), topic('t2', 'Mitosis', 'mastered')],
  exam: { id: 'x', title: 'Midterm', due_at: new Date(Date.now() + 9 * 86_400_000).toISOString() },
})
beforeEach(() => { page = FULL(); loadError = false; loadCalls = 0; push.mockClear(); requestUpload.mockClear(); createChat.mockClear(); startRevision.mockClear() })
afterEach(cleanup)

describe('Course page', () => {
  it('shows the course with a summary of what is in it', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Biology' })).toBeTruthy()
    expect(screen.getByText('1 note · 2 decks · 1 lecture')).toBeTruthy()
  })
  it('shows everything in the course through the material browser, scoped to it', async () => {
    await open()
    const b = screen.getByTestId('browser')
    expect(b.getAttribute('data-course')).toBe('bio')
    expect(b.getAttribute('data-embedded')).toBe('true')
  })
  it('totals the cards due across decks and links to review', async () => {
    await open()
    expect(screen.getByText('5 cards due')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review all courses' }).getAttribute('href')).toBe('/review')
  })
  it('names the next exam and points to the planner', async () => {
    await open()
    expect(screen.getByText('Midterm · in 9 days')).toBeTruthy()
    expect(screen.getByRole('link', { name: /study plan/i }).getAttribute('href')).toBe('/planner')
  })
  it('shows topics with their status and a Revise button on a weak one', async () => {
    await open()
    expect(screen.getByText('Glycolysis')).toBeTruthy()
    expect(screen.getByText('Mastered')).toBeTruthy()
    await click(screen.getByRole('button', { name: /Revise Glycolysis/ }))
    expect(startRevision).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/tutor/rev1?ask=Quiz')
  })
  it('a second tap on Revise does not make a second chat', async () => {
    await open()
    const b = screen.getByRole('button', { name: /Revise Glycolysis/ })
    await click(b); await click(b)
    expect(startRevision).toHaveBeenCalledTimes(1)
  })
  it('Ask the tutor starts a chat in this course', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Ask the tutor' }))
    expect(createChat).toHaveBeenCalledWith({}, expect.objectContaining({ course_id: 'bio' }))
    expect(push).toHaveBeenCalledWith('/tutor/chat1')
  })
  it('can start a note or a deck in this course from the header', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'New note' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New deck' }).getAttribute('href')).toBe('/flashcards?new=1&course=bio')
  })
  it('Upload opens the upload dialog, and there is no second way into a Library', async () => {
    await open()
    await click(screen.getByRole('button', { name: /Upload/ }))
    expect(requestUpload).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: /Library/ })).toBeNull()
  })
  it('an empty course still has its actions and no due or exam strips', async () => {
    page = { course, items: [], topics: [], exam: null }
    await open()
    expect(screen.getByRole('button', { name: /Upload/ })).toBeTruthy()
    expect(screen.queryByText(/cards due/)).toBeNull()
  })
  it('a course with no topics points to Progress', async () => {
    page!.topics = []
    await open()
    expect(screen.getByRole('link', { name: /See them on Progress/ }).getAttribute('href')).toBe('/progress')
  })
  it('says there is no such course', async () => {
    page = null
    await open()
    expect(screen.getByText(/couldn.t find that course/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Courses' }).getAttribute('href')).toBe('/courses')
  })
  it('keeps the header when the summary of what is in it could not load', async () => {
    page!.items = null
    await open()
    expect(screen.getByRole('heading', { name: 'Biology' })).toBeTruthy()
    expect(screen.getByTestId('browser')).toBeTruthy()
  })
  it('Review opens the one deck that is due, so the count matches what is reviewed', async () => {
    page!.items = [item('deck', 'd1', 'Cells', '2026-10-09T10:00:00Z', { due: 3 }), item('deck', 'd2', 'Genetics', '2026-10-08T10:00:00Z', { due: 0 })]
    await open()
    expect(screen.getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/review?deck=d1')
  })
  it('with several decks due, Review is labelled as covering every course', async () => {
    await open()
    expect(screen.getByRole('link', { name: 'Review all courses' }).getAttribute('href')).toBe('/review')
  })
  it('offers retry when the whole page cannot load', async () => {
    loadError = true
    await open()
    expect(screen.getByRole('alert').textContent).toMatch(/Could not load/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
