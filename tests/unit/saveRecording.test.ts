import { describe, it, expect, beforeEach } from 'vitest'
import { memoryStore, type LocalSession } from '@/lib/lectures/localStore'
import { finishRecording, partPath, uploadPart, uploadPartFile } from '@/lib/lectures/saveRecording'

let failUploads = false
const uploads: string[] = []
let saved: Record<string, unknown> | null = null
const sb = {
  storage: { from: () => ({
    upload: async (path: string) => { if (failUploads) return { error: { message: 'offline' } }; uploads.push(path); return { error: null } },
  }) },
  from: () => ({ upsert: async (row: Record<string, unknown>) => { saved = row; return { error: null } } }),
} as never
const session = (over: Partial<LocalSession> = {}): LocalSession => ({
  id: 'L1', userId: 'u1', title: 'Cell biology', courseId: 'c1', mime: 'audio/webm', ext: 'webm', startedAt: '2026-10-04T09:00:00.000Z',
  choice: 'live', lines: [{ start: 1, end: 3, text: 'Welcome.' }], parts: [], ...over,
})
const blob = (n: number) => new Blob([new Uint8Array(n)], { type: 'audio/webm' })
beforeEach(() => { failUploads = false; uploads.length = 0; saved = null })

describe('uploadPart', () => {
  it('uploads a finished part to the student\'s folder and records it in the safety copy', async () => {
    const store = memoryStore()
    const s = await uploadPart(sb, store, session(), { index: 0, start: 0, duration: 1200, blob: blob(5000) })
    expect(uploads).toEqual([partPath('u1', 'L1', 0, 'webm')])
    expect(partPath('u1', 'L1', 0, 'webm')).toBe('u1/L1-0.webm')
    expect(s.parts).toEqual([{ index: 0, start: 0, duration: 1200, uploaded: { path: 'u1/L1-0.webm', bytes: 5000 } }])
    expect((await store.sessions())[0].parts).toEqual(s.parts)
  })
  it('when the upload fails, the part stays on the device, marked not uploaded', async () => {
    const store = memoryStore()
    failUploads = true
    await expect(uploadPart(sb, store, session(), { index: 0, start: 0, duration: 1200, blob: blob(10) })).rejects.toThrow('upload_failed')
    expect((await store.sessions())[0].parts).toEqual([{ index: 0, start: 0, duration: 1200, uploaded: null }])
  })
})

describe('finishRecording', () => {
  it('uploads what\'s left from the safety copy, saves the lecture with the live transcript, and clears the copy', async () => {
    const store = memoryStore()
    let s = await uploadPart(sb, store, session(), { index: 0, start: 0, duration: 1200, blob: blob(4000) })
    s = { ...s, parts: [...s.parts, { index: 1, start: 1200, duration: 300, uploaded: null }] }
    await store.addChunk('L1', 1, blob(600)); await store.addChunk('L1', 1, blob(400))
    expect(await finishRecording(sb, store, s)).toEqual({ id: 'L1' })
    expect(uploads).toEqual(['u1/L1-0.webm', 'u1/L1-1.webm'])
    expect(saved).toEqual({
      id: 'L1', title: 'Cell biology', course_id: 'c1', recorded_at: '2026-10-04T09:00:00.000Z', duration_seconds: 1500, audio_bytes: 5000,
      mime: 'audio/webm', transcript: [{ start: 1, end: 3, text: 'Welcome.' }], transcript_status: 'live', transcript_source: 'browser',
      parts: [
        { path: 'u1/L1-0.webm', start: 0, duration: 1200, bytes: 4000, transcribed: false },
        { path: 'u1/L1-1.webm', start: 1200, duration: 300, bytes: 1000, transcribed: false },
      ],
    })
    expect(await store.sessions()).toEqual([])
  })
  it('recovers a part that never finished (the tab closed): its length comes from its size at 32 kbps', async () => {
    const store = memoryStore()
    const s = session({ lines: [], parts: [{ index: 0, start: 0, duration: null, uploaded: null }] })
    await store.addChunk('L1', 0, blob(40000)) // 10 s at 32 kbps
    await finishRecording(sb, store, s)
    expect(saved).toMatchObject({ duration_seconds: 10, transcript_status: 'none', transcript_source: null })
  })
  it('keeps everything on the device if an upload fails, and says when nothing was recorded', async () => {
    const store = memoryStore()
    const s = session({ parts: [{ index: 0, start: 0, duration: 5, uploaded: null }] })
    await store.addChunk('L1', 0, blob(100))
    await store.saveSession(s)
    failUploads = true
    await expect(finishRecording(sb, store, s)).rejects.toThrow('upload_failed')
    expect(saved).toBeNull()
    expect(await store.sessions()).toHaveLength(1)
    await expect(finishRecording(sb, memoryStore(), session({ parts: [] }))).rejects.toThrow('nothing_recorded')
  })
})

describe('uploadPartFile', () => {
  const part = { index: 0, start: 0, duration: 5, blob: blob(10) }
  const s = session()
  it('tries a failed upload again before giving up', async () => {
    let calls = 0
    const flaky = { storage: { from: () => ({ upload: async () => { calls++; return { error: calls < 3 ? { message: 'offline' } : null } } }) } } as never
    expect(await uploadPartFile(flaky, s, part, { wait: async () => {} })).toEqual({ path: 'u1/L1-0.webm', bytes: 10 })
    expect(calls).toBe(3)
  })
  it('gives up on an upload that hangs, so Stop can offer Retry upload', async () => {
    const hangs = { storage: { from: () => ({ upload: () => new Promise(() => {}) }) } } as never
    await expect(uploadPartFile(hangs, s, part, { attempts: 1, timeoutMs: 20, wait: async () => {} })).rejects.toThrow('upload_failed')
  })
})
