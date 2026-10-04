// Lecture lengths, parts, transcripts and storage: shared by the browser and the server

export const PART_SECONDS_DEFAULT = 1200 // 20 minutes: one part stays well under OpenAI's 25 MB
export const MAX_LECTURE_SECONDS = 7200
export const WARN_LECTURE_SECONDS = 6900 // 1h55m
export const AUDIO_QUOTA_BYTES = 300 * 1024 * 1024 // ~20 hours at 32 kbps

export type AudioMime = 'audio/webm' | 'audio/mp4' | 'audio/ogg'
export type TranscriptLine = { start: number; end: number; text: string }
/** One recorded file. `segments` holds a part's accurate transcript until every part is done. */
export type LecturePart = { path: string; start: number; duration: number; bytes: number; transcribed: boolean; segments?: TranscriptLine[] }

// E2E sets NEXT_PUBLIC_LECTURE_PART_SECONDS to a few seconds to record several parts quickly
export function partSeconds(): number {
  const n = Number(process.env.NEXT_PUBLIC_LECTURE_PART_SECONDS)
  return Number.isFinite(n) && n > 0 ? n : PART_SECONDS_DEFAULT
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`
}

// A time in the whole lecture → which part plays it, and where in that part
export function locate(parts: { start: number; duration: number }[], t: number): { index: number; offset: number } {
  const time = Math.max(0, t)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (time >= parts[i].start) return { index: i, offset: Math.min(time - parts[i].start, parts[i].duration) }
  }
  return { index: 0, offset: 0 }
}

// The line being spoken at time t (the last one that has started), or -1 before the first
export function lineAt(lines: TranscriptLine[], t: number): number {
  let found = -1
  for (let i = 0; i < lines.length && lines[i].start <= t; i++) found = i
  return found
}

export function searchLines(lines: TranscriptLine[], q: string): number[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  return lines.flatMap((l, i) => (l.text.toLowerCase().includes(needle) ? [i] : []))
}

export function storageState(usedBytes: number): 'ok' | 'warn' | 'full' {
  if (usedBytes >= AUDIO_QUOTA_BYTES) return 'full'
  return usedBytes >= AUDIO_QUOTA_BYTES * 0.8 ? 'warn' : 'ok'
}

export const formatMb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`
