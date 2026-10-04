// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const runScan = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }], createCourse: vi.fn() }))
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
beforeEach(() => { runScan.mockReset() })
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
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'cards' } })
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

  it('"Scan again" goes back to the same pages', async () => {
    runScan.mockResolvedValue({ ok: true, value: { title: 'Cells', content_md: 'body', truncated: false } })
    await openDialog()
    await add(photo('a.jpg'))
    await act(async () => { fireEvent.click(scanButton(1)) })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Cells')
    fireEvent.click(screen.getByRole('button', { name: '↺ Scan again' }))
    expect(pageTexts()).toHaveLength(1)
  })
})
