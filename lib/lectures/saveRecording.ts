'use client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_LECTURE_SECONDS, type LecturePart } from './time'
import type { LocalPart, LocalSession, RecordingStore } from './localStore'
import type { RecordedPart } from './recorder'

export const partPath = (userId: string, lectureId: string, index: number, ext: string) => `${userId}/${lectureId}-${index}.${ext}`
// A part that never finished has no recorded length: at 32 kbps, 4000 bytes are one second
const secondsFromBytes = (bytes: number) => Math.round((bytes * 8) / 32000)

/** The session with one part's entry added or replaced */
export function withPart(s: LocalSession, part: LocalPart): LocalSession {
  return { ...s, parts: [...s.parts.filter(p => p.index !== part.index), part].sort((a, b) => a.index - b.index) }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Upload one part's file, trying again after a short wait when it fails (campus Wi-Fi drops) and
// giving up on an attempt that hangs. Throws 'upload_failed'; the part stays on the device. The
// caller records the result in its latest session (others may have changed it meanwhile).
export async function uploadPartFile(
  sb: SupabaseClient, s: Pick<LocalSession, 'userId' | 'id' | 'ext' | 'mime'>, part: RecordedPart,
  o: { attempts?: number; timeoutMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<{ path: string; bytes: number }> {
  const attempts = o.attempts ?? 3, timeoutMs = o.timeoutMs ?? 90_000, wait = o.wait ?? sleep
  const path = partPath(s.userId, s.id, part.index, s.ext)
  for (let i = 0; i < attempts; i++) {
    if (i) await wait(500 * 3 ** (i - 1)) // 0.5 s, then 1.5 s
    let timer: ReturnType<typeof setTimeout> | undefined
    const gaveUp = new Promise<{ error: string }>(resolve => { timer = setTimeout(() => resolve({ error: 'timeout' }), timeoutMs) })
    const { error } = await Promise.race([sb.storage.from('lectures').upload(path, part.blob, { contentType: s.mime, upsert: true }), gaveUp])
    clearTimeout(timer)
    if (!error) return { path, bytes: part.blob.size }
  }
  throw new Error('upload_failed')
}

// Upload one part and record the result in the safety copy either way; a failed upload throws
// 'upload_failed' and the part stays on the device for later.
export async function uploadPart(sb: SupabaseClient, store: RecordingStore, s: LocalSession, part: RecordedPart): Promise<LocalSession> {
  let uploaded: { path: string; bytes: number } | null = null
  try { uploaded = await uploadPartFile(sb, s, part) } catch { /* recorded below as not uploaded */ }
  const next = withPart(s, { index: part.index, start: part.start, duration: part.duration, uploaded })
  await store.saveSession(next)
  if (!uploaded) throw new Error('upload_failed')
  return next
}

// After Stop, or when recovering: upload every part still on the device, save the lecture, then
// delete the device's copy. Throws 'upload_failed' (everything stays on the device) or
// 'nothing_recorded'.
export async function finishRecording(sb: SupabaseClient, store: RecordingStore, s: LocalSession): Promise<{ id: string }> {
  let cur = s
  for (const p of s.parts) {
    if (p.uploaded) continue
    const blob = await store.partBlob(s.id, p.index, s.mime)
    if (!blob?.size) { cur = { ...cur, parts: cur.parts.filter(x => x.index !== p.index) }; continue }
    cur = await uploadPart(sb, store, cur, { index: p.index, start: p.start, duration: p.duration ?? secondsFromBytes(blob.size), blob })
  }
  const parts: LecturePart[] = cur.parts.flatMap(p => (p.uploaded
    ? [{ path: p.uploaded.path, start: p.start, duration: p.duration ?? secondsFromBytes(p.uploaded.bytes), bytes: p.uploaded.bytes, transcribed: false }]
    : []))
  if (!parts.length) throw new Error('nothing_recorded')
  const last = parts[parts.length - 1]
  const live = cur.lines.length > 0
  const { error } = await sb.from('lectures').upsert({
    id: cur.id, title: cur.title.trim().slice(0, 200) || 'Lecture', course_id: cur.courseId, recorded_at: cur.startedAt,
    duration_seconds: Math.min(MAX_LECTURE_SECONDS, Math.round(last.start + last.duration)),
    audio_bytes: parts.reduce((n, p) => n + p.bytes, 0), mime: cur.mime, parts,
    transcript: cur.lines, transcript_status: live ? 'live' : 'none', transcript_source: live ? 'browser' : null,
  })
  if (error) throw new Error('upload_failed')
  await store.remove(cur.id)
  return { id: cur.id }
}
