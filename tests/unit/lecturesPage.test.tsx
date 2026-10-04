// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'

let lectures: Record<string, unknown>[] = []
let used = 0
let leftover: Record<string, unknown>[] = []
const finishRecording = vi.fn(async () => ({ id: 'L9' }))
const push = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => lectures, audioUsed: async () => used }))
vi.mock('@/lib/lectures/localStore', () => ({ indexedDbStore: () => ({ sessions: async () => leftover }) }))
vi.mock('@/lib/lectures/saveRecording', () => ({ finishRecording: (...a: unknown[]) => finishRecording(...(a as [])) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import LecturesPage from '@/app/(app)/lectures/page'
import { StorageCard } from '@/components/settings/StorageCard'

const MB = 1024 * 1024
beforeEach(() => {
  lectures = [{ id: 'L1', course_id: 'c1', title: 'Krebs cycle', recorded_at: '2026-10-03T09:00:00Z', duration_seconds: 3723, transcript_status: 'done', audio_bytes: 5 * MB }]
  used = 5 * MB; leftover = []; finishRecording.mockClear(); push.mockClear()
})
afterEach(() => cleanup())
const open = async () => { await act(async () => { render(<LecturesPage />) }) }

describe('Lectures page', () => {
  it('lists lectures with course, length and transcript status, and links to record', async () => {
    await open()
    expect(screen.getByRole('link', { name: /Krebs cycle/ }).getAttribute('href')).toBe('/lectures/L1')
    expect(screen.getByText('1:02:03')).toBeTruthy()
    expect(screen.getByText('Biology')).toBeTruthy()
    expect(screen.getByText('Accurate transcript')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Record/ }).getAttribute('href')).toBe('/lectures/record')
  })
  it('warns when storage is nearly full and blocks recording when it is full', async () => {
    used = 250 * MB
    await open()
    expect(screen.getByText(/250 MB of 300 MB/)).toBeTruthy()
    cleanup()
    used = 300 * MB
    await open()
    expect(screen.getByText(/Delete old lectures to record more/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Record/ })).toBeNull()
  })
  it('offers to recover a recording that wasn\'t saved, and saves it', async () => {
    leftover = [{ id: 'L9', title: 'Lost lecture', parts: [] }]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recover unsaved recording' })) })
    expect(finishRecording).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/lectures/L9')
  })
})

describe('StorageCard', () => {
  it('shows lecture audio used', async () => {
    used = 410 * MB
    await act(async () => { render(<StorageCard />) })
    expect(screen.getByText('410 MB of 300 MB lecture audio used')).toBeTruthy()
    expect(screen.getByText(/Delete old lectures to record more/)).toBeTruthy()
  })
})
