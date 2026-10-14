// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const runScan = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let coursesFail = false
vi.mock('@/lib/data/courses', () => ({
  listCourses: async () => { if (coursesFail) throw new Error('offline'); return [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] },
  createCourse: vi.fn(),
}))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [], createDeck: async () => ({ id: 'd-new' }) }))
vi.mock('@/lib/scan/scanClient', async orig => ({
  ...(await orig<typeof import('@/lib/scan/scanClient')>()),
  runScan: (...a: unknown[]) => runScan(...a),
  countPdfPagesInBrowser: async () => 3,
}))
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ScanDialog } from '@/components/scan/ScanDialog'

const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' })

beforeAll(() => {
  // jsdom has no <dialog> methods
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => { runScan.mockReset(); coursesFail = false })
afterEach(() => { cleanup(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

const openDialog = async (initialTarget: 'note' | 'cards' | 'planner' = 'note') => {
  await act(async () => {
    render(<ProfileProvider initial={profile}><ToastProvider><ScanDialog open onClose={vi.fn()} initialTarget={initialTarget} /></ToastProvider></ProfileProvider>)
  })
}
const add = async (...files: File[]) => {
  await act(async () => { fireEvent.change(screen.getByLabelText('Images or a PDF to scan'), { target: { files } }) })
}
const pageTexts = () => within(screen.getByRole('list', { name: 'Pages' })).getAllByRole('listitem').map(li => li.textContent ?? '')
const scanButton = (n: number) => screen.getByRole('button', { name: `✦ Scan ${n} page${n === 1 ? '' : 's'}` })

describe('ScanDialog', () => {
  it('starts with the photos it was given, so they are not picked twice', async () => {
    await act(async () => {
      render(<ProfileProvider initial={profile}><ToastProvider><ScanDialog open onClose={vi.fn()} initialTarget="note" initialFiles={[photo('board.jpg')]} /></ToastProvider></ProfileProvider>)
    })
    expect(pageTexts()[0]).toContain('board.jpg')
    expect(scanButton(1)).toBeTruthy()
  })
  it('says so when a handed-over file is not something Scan can read', async () => {
    await act(async () => {
      render(<ProfileProvider initial={profile}><ToastProvider><ScanDialog open onClose={vi.fn()} initialTarget="note" initialFiles={[new File(['x'], 'pic.gif', { type: 'image/gif' })]} /></ToastProvider></ProfileProvider>)
    })
    expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG or WebP')
  })
  it('adds photos as numbered pages that can be reordered and removed', async () => {
    await openDialog()
    await add(photo('a.jpg'), photo('b.jpg'), photo('c.jpg'))
    expect(scanButton(3)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Move page 2 earlier' }))
    expect(pageTexts()[0]).toContain('b.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Remove page 3' }))
    expect(pageTexts()).toHaveLength(2)
    expect(scanButton(2)).toBeTruthy()
  })

  it('explains a PDF mixed with photos before uploading anything', async () => {
    await openDialog()
    await add(photo('a.jpg'))
    await add(pdf('w.pdf'))
    expect(screen.getByRole('alert').textContent).toContain('either photos or one PDF')
    expect(runScan).not.toHaveBeenCalled()
  })

  it('retakes a page in place', async () => {
    await openDialog()
    await add(photo('a.jpg'), photo('b.jpg'))
    fireEvent.click(screen.getByRole('button', { name: 'Retake page 1' }))
    await act(async () => { fireEvent.change(screen.getByLabelText('Retake photo'), { target: { files: [photo('a2.jpg')] } }) })
    expect(pageTexts()[0]).toContain('a2.jpg')
    expect(pageTexts()[1]).toContain('b.jpg')
  })

  it('reads the pages for the chosen result, then shows its review', async () => {
    runScan.mockResolvedValue({ ok: true, value: { cards: [{ front: 'Cell?', back: 'Unit of life' }, { front: 'ATP?', back: 'Energy' }] } })
    await openDialog()
    await add(photo('a.jpg'), photo('b.jpg'))
    fireEvent.click(screen.getByRole('radio', { name: /Flashcards/ }))
    await act(async () => { fireEvent.click(scanButton(2)) })
    const arg = runScan.mock.calls[0][0] as { pages: { file: File }[]; target: string; userId: string; today: string }
    expect(arg.pages.map(p => p.file.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(arg).toMatchObject({ target: 'cards', userId: 'u1' })
    expect(arg.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(screen.getByText(/2 cards found/)).toBeTruthy()
  })

  it('cancelling while reading stops the request and keeps the pages', async () => {
    let signal: AbortSignal | undefined
    runScan.mockImplementation((o: { signal: AbortSignal }) => { signal = o.signal; return new Promise(() => {}) })
    await openDialog()
    await add(photo('a.jpg'))
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect(screen.getByText(/Reading your pages/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel scan' })) })
    expect(signal?.aborted).toBe(true)
    expect(pageTexts()).toHaveLength(1)
  })

  it('a failed scan says why and keeps the pages; the free limit offers Premium', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    runScan.mockResolvedValueOnce({ ok: false, code: 'refused', message: 'Couldn\'t read these pages. Try clearer photos.' })
    await openDialog()
    await add(photo('a.jpg'))
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect(screen.getByText('Couldn\'t read these pages. Try clearer photos.')).toBeTruthy()
    expect(pageTexts()).toHaveLength(1)
    runScan.mockResolvedValueOnce({ ok: false, code: 'daily_limit', message: 'x' })
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect(screen.getByRole('link', { name: /Get Premium/ })).toBeTruthy()
  })

  it('a planner scan needs the course list; if it can\'t load, it says so and reads nothing', async () => {
    coursesFail = true
    await openDialog('planner')
    await add(photo('timetable.jpg'))
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect(screen.getByRole('alert').textContent).toBe('Couldn\'t load your courses. Check your connection and try again.')
    expect(runScan).not.toHaveBeenCalled()
    coursesFail = false
    runScan.mockResolvedValue({ ok: true, value: { tasks: [], classes: [{ course: 'biology', day: 1, start: '09:00', end: '10:00', room: null, kind: 'lecture', unsure: false }] } })
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect((screen.getByLabelText('Class 1 course') as HTMLSelectElement).value).toBe('c1') // matched now
  })

  it('camera inputs ask for JPEG, PNG or WebP, so phones convert HEIC photos', async () => {
    await openDialog()
    for (const label of ['Photos from camera', 'Retake photo']) {
      expect(screen.getByLabelText(label).getAttribute('accept'), label).toBe('image/jpeg,image/png,image/webp')
    }
  })

  it('after removing a page, focus moves to the next page, or to adding pages when none are left', async () => {
    await openDialog()
    await add(photo('a.jpg'), photo('b.jpg'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove page 1' })) })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove page 1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove page 1' })) })
    expect(document.activeElement?.textContent).toBe('Choose images or a PDF')
  })

  it('"Scan again" goes back to the same pages', async () => {
    runScan.mockResolvedValue({ ok: true, value: { title: 'Cells', content_md: 'body', truncated: false } })
    await openDialog()
    await add(photo('a.jpg'))
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Cells')
    fireEvent.click(screen.getByRole('button', { name: '↺ Scan again' }))
    expect(pageTexts()).toHaveLength(1)
  })

  it('offers the three results as cards, with the preset one chosen', async () => {
    await openDialog('planner')
    const cards = screen.getAllByRole('radio')
    expect(cards.map(c => c.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true'])
    expect(screen.getByRole('radiogroup', { name: 'Make' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /A note/ }))
    expect(screen.getByRole('radio', { name: /A note/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('takes pages dropped on it, with the count shown, and ignores a drop of something that is not a file', async () => {
    await openDialog()
    const zone = screen.getByRole('group', { name: 'Drop pages to scan' })
    await act(async () => { fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [photo('d1.jpg'), photo('d2.jpg')] } }) })
    expect(pageTexts()).toHaveLength(2)
    expect(screen.getByText('2 of 10')).toBeTruthy()
    await act(async () => { fireEvent.drop(zone, { dataTransfer: { types: ['text/plain'], files: [] } }) })
    expect(pageTexts()).toHaveLength(2)
  })

  it('shows a highlight while files are dragged over the drop area', async () => {
    await openDialog()
    const zone = screen.getByRole('group', { name: 'Drop pages to scan' })
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } })
    expect(zone.getAttribute('data-dragging')).toBe('true')
    fireEvent.dragLeave(zone, { dataTransfer: { types: ['Files'] } })
    expect(zone.getAttribute('data-dragging')).toBe('false')
  })
})
