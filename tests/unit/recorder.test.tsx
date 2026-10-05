// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import { memoryStore } from '@/lib/lectures/localStore'

const push = vi.fn()
let used = 0
const finishRecording = vi.fn(async (...a: unknown[]) => ({ id: (a[2] as { id: string }).id }))
const uploadPartFile = vi.fn(async (...a: unknown[]) => { const part = a[2] as { index: number; blob: Blob }; return { path: `u1/L-${part.index}.webm`, bytes: part.blob.size } })
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/lectures', () => ({ audioUsed: async () => used }))
vi.mock('@/lib/lectures/saveRecording', async orig => ({
  ...(await orig<typeof import('@/lib/lectures/saveRecording')>()),
  finishRecording: (...a: unknown[]) => finishRecording(...a), uploadPartFile: (...a: unknown[]) => uploadPartFile(...a),
}))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { Recorder } from '@/components/lectures/Recorder'
import type { LocalSession } from '@/lib/lectures/localStore'
import { isRecording } from '@/lib/lectures/recordingGuard'

class FakeRecorder {
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus'
  ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null
  start() {} pause() {} resume() {}
  stop() { this.ondataavailable?.({ data: new Blob(['x']) }); this.onstop?.() }
}
const heard: FakeRecognition[] = []
class FakeRecognition {
  continuous = false; interimResults = false; lang = ''
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
  onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null
  constructor() { heard.push(this) }
  start() {} stop() {}
  say(text: string) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] }) }
}
const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
let getUserMedia = vi.fn(async () => stream)
const deps = (over: object = {}) => ({ getUserMedia, MediaRecorder: FakeRecorder as never, Recognition: null, store: memoryStore(), partSeconds: 1200, now: () => Date.now(), ...over })
const renderRecorder = async (over: object = {}) => {
  await act(async () => { render(<ProfileProvider initial={profile}><Recorder deps={deps(over)} /></ProfileProvider>) })
}

beforeEach(() => { vi.useFakeTimers(); used = 0; heard.length = 0; push.mockClear(); finishRecording.mockClear(); uploadPartFile.mockClear(); getUserMedia = vi.fn(async () => stream) })
afterEach(() => { cleanup(); vi.useRealTimers(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

describe('Recorder', () => {
  it('a slow part upload loses neither the next part nor live lines, and the device lists the next part at once', async () => {
    let finishFirstUpload!: () => void
    uploadPartFile.mockImplementationOnce(async () => { await new Promise<void>(r => { finishFirstUpload = r }); return { path: 'u1/L-0.webm', bytes: 1 } })
    const store = memoryStore()
    await renderRecorder({ partSeconds: 2, store, Recognition: FakeRecognition })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    await act(async () => { vi.advanceTimersByTime(2000) }) // part 0 is full: its upload starts and hangs
    expect((await store.sessions())[0].parts.map(p => p.index)).toEqual([0, 1])
    await act(async () => { heard[0].say('Mitochondria make ATP.') })
    await act(async () => { vi.advanceTimersByTime(1000) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Stop & save' })) }) // part 1 uploads at once
    await act(async () => { finishFirstUpload() }) // part 0's upload finishes last
    const saved = finishRecording.mock.calls[0][2] as LocalSession
    expect(saved.parts.map(p => [p.index, p.duration != null, !!p.uploaded])).toEqual([[0, true, true], [1, true, true]])
    expect(saved.lines.map(l => l.text)).toEqual(['Mitochondria make ATP.'])
  })

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
    // Recording with no transcript coming would waste the lecture: choose another option first
    expect((screen.getByRole('button', { name: 'Start recording' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('records with a running clock, then saves and opens the lecture', async () => {
    await renderRecorder()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Krebs cycle' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(getUserMedia).toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('timer', { name: 'Recording time' }).textContent).toBe('0:03')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop & save' })) })
    const saved = finishRecording.mock.calls[0][2] as { title: string; userId: string; choice: string }
    expect(saved).toMatchObject({ title: 'Krebs cycle', userId: 'u1', choice: 'none' })
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/lectures\/[0-9a-f-]{36}$/))
  })

  it('while recording, closing the tab warns and the app knows a recording is running', async () => {
    await renderRecorder()
    const leave = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented }
    expect(leave()).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(isRecording()).toBe(true)
    expect(leave()).toBe(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop & save' })) })
    expect(isRecording()).toBe(false)
    expect(leave()).toBe(false)
  })

  it('says so when the device can\'t keep its safety copy (e.g. storage full)', async () => {
    const store = { ...memoryStore(), addChunk: async () => { throw new Error('QuotaExceededError') } }
    // A recorder that hands over a chunk as soon as it starts, as a real one does every 5 s
    class ChunkyRecorder extends FakeRecorder { start() { this.ondataavailable?.({ data: new Blob(['x']) }) } }
    await renderRecorder({ store, MediaRecorder: ChunkyRecorder })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/safety copy/)
    expect(screen.getByRole('button', { name: 'Stop & save' })).toBeTruthy() // still recording
  })

  it('a second click while the microphone opens doesn\'t start a second recording', async () => {
    let grant!: (s: MediaStream) => void
    getUserMedia = vi.fn(() => new Promise<MediaStream>(r => { grant = r })) // Chrome is slow to open the mic
    await renderRecorder({ getUserMedia, Recognition: FakeRecognition })
    const button = screen.getByRole('button', { name: 'Start recording' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { grant(stream) })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(heard).toHaveLength(1) // one live transcriber, not two fighting over speech recognition
  })

  it('if live transcription can\'t start, it records anyway and says so', async () => {
    class Broken extends FakeRecognition { start() { throw new Error('InvalidStateError') } }
    await renderRecorder({ Recognition: Broken })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(screen.getByRole('timer', { name: 'Recording time' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Live transcript couldn.t start/)
  })

  it('if starting fails after the microphone opened, it says so and lets go of the microphone', async () => {
    const stop = vi.fn()
    const mic = { getTracks: () => [{ stop }] } as unknown as MediaStream
    const store = { ...memoryStore(), saveSession: async () => { throw new Error('QuotaExceededError') } }
    await renderRecorder({ getUserMedia: vi.fn(async () => mic), store })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn.t start recording/)
    expect(stop).toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Start recording' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows why live text isn\'t coming through while it retries', async () => {
    await renderRecorder({ Recognition: FakeRecognition })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    await act(async () => { heard[0].onerror?.({ error: 'network' }) })
    expect(screen.getByLabelText('Live transcript').textContent).toMatch(/can.t reach the speech service/)
    await act(async () => { heard[0].onend?.(); vi.advanceTimersByTime(1000) })
    await act(async () => { heard[1].say('Back again.') })
    expect(screen.getByLabelText('Live transcript').textContent).not.toMatch(/speech service/)
  })

  it('live transcript listens in the chosen language, English (Ghana) by default, and remembers it', async () => {
    localStorage.removeItem('studyhub:live-language')
    await renderRecorder({ Recognition: FakeRecognition })
    const language = screen.getByLabelText('Language') as HTMLSelectElement
    expect(language.value).toBe('en-GH')
    fireEvent.change(language, { target: { value: 'fr-FR' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })) })
    expect(heard[0].lang).toBe('fr-FR')
    cleanup()
    await renderRecorder({ Recognition: FakeRecognition })
    expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe('fr-FR')
    localStorage.removeItem('studyhub:live-language')
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
