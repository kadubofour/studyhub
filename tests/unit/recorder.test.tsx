// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import { memoryStore } from '@/lib/lectures/localStore'

const push = vi.fn()
let used = 0
const finishRecording = vi.fn(async (...a: unknown[]) => ({ id: (a[2] as { id: string }).id }))
const uploadPart = vi.fn(async (...a: unknown[]) => a[2])
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/lectures', () => ({ audioUsed: async () => used }))
vi.mock('@/lib/lectures/saveRecording', () => ({
  finishRecording: (...a: unknown[]) => finishRecording(...a), uploadPart: (...a: unknown[]) => uploadPart(...a),
}))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { Recorder } from '@/components/lectures/Recorder'

class FakeRecorder {
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus'
  ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null
  start() {} pause() {} resume() {}
  stop() { this.ondataavailable?.({ data: new Blob(['x']) }); this.onstop?.() }
}
const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
let getUserMedia = vi.fn(async () => stream)
const deps = (over: object = {}) => ({ getUserMedia, MediaRecorder: FakeRecorder as never, Recognition: null, store: memoryStore(), partSeconds: 1200, ...over })
const renderRecorder = async (over: object = {}) => {
  await act(async () => { render(<ProfileProvider initial={profile}><Recorder deps={deps(over)} /></ProfileProvider>) })
}

beforeEach(() => { vi.useFakeTimers(); used = 0; push.mockClear(); finishRecording.mockClear(); getUserMedia = vi.fn(async () => stream) })
afterEach(() => { cleanup(); vi.useRealTimers(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

describe('Recorder', () => {
  it('asks for the lecturer\'s permission and explains live transcripts aren\'t available here', async () => {
    await renderRecorder()
    expect(screen.getByText('Ask your lecturer before recording.')).toBeTruthy()
    const live = screen.getByLabelText(/Live, free/) as HTMLInputElement
    expect(live.disabled).toBe(true)
    expect(screen.getByText(/can't do live transcripts/)).toBeTruthy()
    expect((screen.getByLabelText('None') as HTMLInputElement).checked).toBe(true)
  })

  it('choosing Accurate on Free shows that it\'s a Premium feature', async () => {
    await renderRecorder()
    fireEvent.click(screen.getByLabelText(/Accurate, after recording/))
    expect(screen.getByText('This is a Premium feature')).toBeTruthy()
  })

  it('records with a running clock, then saves and opens the lecture', async () => {
    await renderRecorder()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Krebs cycle' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(getUserMedia).toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('0:03')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop & save' })) })
    const saved = finishRecording.mock.calls[0][2] as { title: string; userId: string; choice: string }
    expect(saved).toMatchObject({ title: 'Krebs cycle', userId: 'u1', choice: 'none' })
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/lectures\/[0-9a-f-]{36}$/))
  })

  it('a denied microphone gets a tip on allowing it', async () => {
    getUserMedia = vi.fn(async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }) })
    await renderRecorder({ getUserMedia })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Allow the microphone/)
  })

  it('if the upload fails at Stop, the recording stays on the device with Retry upload', async () => {
    finishRecording.mockRejectedValueOnce(new Error('upload_failed'))
    await renderRecorder()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop & save' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/kept on this device/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry upload' })) })
    expect(push).toHaveBeenCalled()
  })

  it('warns at 1h55m and stops by itself at 2 hours', async () => {
    await renderRecorder()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    await act(async () => { vi.advanceTimersByTime(6900 * 1000) })
    expect(screen.getByText(/stops at 2 hours/)).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(300 * 1000) })
    expect(finishRecording).toHaveBeenCalled()
  })

  it('is blocked when lecture storage is full', async () => {
    used = 300 * 1024 * 1024
    await renderRecorder()
    expect((screen.getByRole('button', { name: 'Start recording' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Delete old lectures to record more/)).toBeTruthy()
  })
})
